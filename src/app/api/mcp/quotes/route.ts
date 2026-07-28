import { NextRequest, NextResponse } from "next/server";
import { verifyMcpRequest } from "@/lib/mcp/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/mcp/quotes
 * Query params: q, status, company, from (YYYY-MM-DD), to (YYYY-MM-DD), limit (default 50)
 */
export async function GET(req: NextRequest) {
  const auth = await verifyMcpRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status");
  const company = url.searchParams.get("company");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);

  let query = admin
    .from("quotes")
    .select("id, quote_number, customer_name, customer_company, customer_email, status, settlement_currency, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(
      `quote_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_company.ilike.%${q}%`
    );
  }
  if (status && status !== "all") query = query.eq("status", status as any);
  if (company) query = query.eq("customer_company", company);
  if (from) query = query.gte("created_at", from);
  if (to) {
    const toEnd = new Date(to + "T23:59:59").toISOString();
    query = query.lte("created_at", toEnd);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: data?.length ?? 0, quotes: data ?? [] });
}

/**
 * POST /api/mcp/quotes
 * Body: shape simplificado (ver types abajo). Campos opcionales toman defaults sensatos.
 * Ideal para dictar "cotización simple" desde el MCP.
 */
type McpCreatePayload = {
  customer_name: string;
  customer_company?: string | null;
  customer_email?: string | null;
  customer_contact?: string | null;
  notes?: string | null;
  settlement_currency?: string | null;
  minimum_monthly_billing?: number | null;

  // Cargos opcionales
  charges_3ds?: boolean;
  cost_3ds?: number | null;
  price_3ds?: number | null;
  has_monthly_fee?: boolean;
  monthly_fee?: number | null;
  has_annual_fee?: boolean;
  annual_fee?: number | null;
  has_rolling_reserve?: boolean;
  rolling_reserve_pct?: number | null;
  rolling_reserve_release_days?: number | null;

  // Líneas (todas opcionales)
  card_lines?: Array<{
    country_code: string;
    currency_code: string;
    card_type: "debit" | "credit";
    settlement_time?: string | null;
    price_variable?: number | null;
    cost_variable?: number | null;
    price_fixed?: number | null;
    cost_fixed?: number | null;
    price_chargeback?: number | null;
    cost_chargeback?: number | null;
    price_refund?: number | null;
    cost_refund?: number | null;
  }>;
  alt_lines?: Array<{
    country_code: string;
    currency_code: string;
    method: "spei" | "oxxo" | "payboom_cash";
    settlement_time?: string | null;
    price_variable?: number | null;
    cost_variable?: number | null;
    price_fixed?: number | null;
    cost_fixed?: number | null;
    price_dispersion?: number | null;
    cost_dispersion?: number | null;
  }>;
  intl_lines?: Array<{
    country_code: string;
    currency_code: string;
    payin_price_variable?: number | null;
    payin_cost_variable?: number | null;
    payin_price_fixed?: number | null;
    payin_cost_fixed?: number | null;
    payout_price_variable?: number | null;
    payout_cost_variable?: number | null;
    payout_price_fixed?: number | null;
    payout_cost_fixed?: number | null;
  }>;
};

export async function POST(req: NextRequest) {
  const auth = await verifyMcpRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: McpCreatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.customer_name?.trim()) {
    return NextResponse.json({ error: "customer_name es obligatorio" }, { status: 400 });
  }

  const cardLines = body.card_lines || [];
  const altLines = body.alt_lines || [];
  const intlLines = body.intl_lines || [];

  const admin = createAdminClient();

  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .insert({
      customer_name: body.customer_name.trim(),
      customer_company: body.customer_company || null,
      customer_email: body.customer_email || null,
      customer_contact: body.customer_contact || null,
      notes: body.notes || null,
      settlement_currency: body.settlement_currency || null,
      minimum_monthly_billing: body.minimum_monthly_billing ?? null,
      charges_3ds: !!body.charges_3ds,
      cost_3ds: body.cost_3ds ?? null,
      price_3ds: body.price_3ds ?? null,
      has_monthly_fee: !!body.has_monthly_fee,
      monthly_fee: body.monthly_fee ?? null,
      has_annual_fee: !!body.has_annual_fee,
      annual_fee: body.annual_fee ?? null,
      has_rolling_reserve: !!body.has_rolling_reserve,
      rolling_reserve_pct: body.rolling_reserve_pct ?? null,
      rolling_reserve_release_days: body.rolling_reserve_release_days ?? null,
      extra_fees: [],
      includes_card_processing: cardLines.length > 0,
      includes_alternative_payments: altLines.length > 0,
      includes_international_payments: intlLines.length > 0,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (qErr || !quote) {
    return NextResponse.json(
      { error: qErr?.message || "No se pudo crear la cotización" },
      { status: 500 }
    );
  }

  // Card processing lines
  if (cardLines.length > 0) {
    const rows = cardLines.map((l) => ({
      quote_id: quote.id,
      country_code: l.country_code,
      currency_code: l.currency_code,
      card_type: l.card_type,
      settlement_time: l.settlement_time || null,
      has_variable: l.price_variable != null || l.cost_variable != null,
      price_variable: l.price_variable ?? null,
      cost_variable: l.cost_variable ?? null,
      has_fixed: l.price_fixed != null || l.cost_fixed != null,
      price_fixed: l.price_fixed ?? null,
      cost_fixed: l.cost_fixed ?? null,
      has_chargeback: l.price_chargeback != null || l.cost_chargeback != null,
      price_chargeback: l.price_chargeback ?? null,
      cost_chargeback: l.cost_chargeback ?? null,
      has_refund: l.price_refund != null || l.cost_refund != null,
      price_refund: l.price_refund ?? null,
      cost_refund: l.cost_refund ?? null,
    }));
    const { error } = await admin.from("quote_card_processing").insert(rows);
    if (error) {
      return NextResponse.json(
        { error: `Cotización creada (id=${quote.id}) pero fallaron líneas tarjeta: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // Alternative payments
  if (altLines.length > 0) {
    const rows = altLines.map((l) => ({
      quote_id: quote.id,
      country_code: l.country_code,
      currency_code: l.currency_code,
      method: l.method,
      settlement_time: l.settlement_time || null,
      has_variable: l.price_variable != null || l.cost_variable != null,
      price_variable: l.price_variable ?? null,
      cost_variable: l.cost_variable ?? null,
      has_fixed: l.price_fixed != null || l.cost_fixed != null,
      price_fixed: l.price_fixed ?? null,
      cost_fixed: l.cost_fixed ?? null,
      has_dispersion: l.price_dispersion != null || l.cost_dispersion != null,
      price_dispersion: l.price_dispersion ?? null,
      cost_dispersion: l.cost_dispersion ?? null,
    }));
    const { error } = await admin.from("quote_alternative_payments").insert(rows);
    if (error) {
      return NextResponse.json(
        { error: `Cotización creada (id=${quote.id}) pero fallaron alternativos: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // International payments
  if (intlLines.length > 0) {
    const rows = intlLines.map((l) => ({
      quote_id: quote.id,
      country_code: l.country_code,
      currency_code: l.currency_code,
      has_payin: l.payin_price_variable != null || l.payin_cost_variable != null || l.payin_price_fixed != null || l.payin_cost_fixed != null,
      payin_price_variable: l.payin_price_variable ?? null,
      payin_cost_variable: l.payin_cost_variable ?? null,
      payin_price_fixed: l.payin_price_fixed ?? null,
      payin_cost_fixed: l.payin_cost_fixed ?? null,
      has_payout: l.payout_price_variable != null || l.payout_cost_variable != null || l.payout_price_fixed != null || l.payout_cost_fixed != null,
      payout_price_variable: l.payout_price_variable ?? null,
      payout_cost_variable: l.payout_cost_variable ?? null,
      payout_price_fixed: l.payout_price_fixed ?? null,
      payout_cost_fixed: l.payout_cost_fixed ?? null,
    }));
    const { error } = await admin.from("quote_international_payments").insert(rows);
    if (error) {
      return NextResponse.json(
        { error: `Cotización creada (id=${quote.id}) pero fallaron internacionales: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // Audit log (best-effort; no bloqueamos si falla)
  try {
    await admin.from("activity_log").insert({
      user_id: auth.userId,
      entity_type: "quote",
      entity_id: quote.id,
      entity_label: `${quote.quote_number} — ${quote.customer_name}`,
      action: "created",
      details: { source: "mcp" },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    id: quote.id,
    quote_number: quote.quote_number,
    customer_name: quote.customer_name,
    status: quote.status,
    url: `https://cotizador.tena.solutions/cotizaciones/${quote.id}`,
  }, { status: 201 });
}
