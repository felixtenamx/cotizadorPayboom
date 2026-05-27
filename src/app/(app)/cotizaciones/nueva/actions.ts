"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExtraFee } from "@/types/database";
import { logActivity } from "@/lib/audit";

/**
 * Quita campos auto-gestionados por la BD para que Postgres use los DEFAULT
 * (gen_random_uuid en id, now() en created_at). Si los enviamos como null,
 * el insert falla con "violates not-null constraint".
 */
function cleanRow<T extends Record<string, any>>(row: T): Omit<T, "id" | "created_at" | "_id"> {
  const { id, created_at, _id, ...rest } = row as any;
  return rest;
}

export type QuotePayload = {
  customer_name: string;
  customer_company?: string | null;
  customer_email?: string | null;
  customer_contact?: string | null;
  notes?: string | null;
  settlement_currency?: string | null;
  minimum_monthly_billing?: number | null;
  charges_3ds: boolean;
  cost_3ds?: number | null;
  price_3ds?: number | null;
  provider_3ds_id?: string | null;
  has_monthly_fee: boolean;
  monthly_fee?: number | null;
  has_annual_fee: boolean;
  annual_fee?: number | null;
  has_rolling_reserve: boolean;
  rolling_reserve_pct?: number | null;
  rolling_reserve_release_days?: number | null;
  extra_fees: ExtraFee[];
  includes_card_processing: boolean;
  includes_alternative_payments: boolean;
  includes_international_payments: boolean;
  card_lines: Array<{
    country_code: string;
    currency_code: string;
    card_type: "debit" | "credit";
    settlement_time?: string | null;
    has_variable: boolean;
    price_variable?: number | null;
    cost_variable?: number | null;
    provider_variable_id?: string | null;
    has_fixed: boolean;
    price_fixed?: number | null;
    cost_fixed?: number | null;
    provider_fixed_id?: string | null;
    has_chargeback: boolean;
    price_chargeback?: number | null;
    cost_chargeback?: number | null;
    provider_chargeback_id?: string | null;
    has_refund: boolean;
    price_refund?: number | null;
    cost_refund?: number | null;
    provider_refund_id?: string | null;
  }>;
  alt_lines: Array<{
    country_code: string;
    currency_code: string;
    method: "spei" | "oxxo" | "payboom_cash";
    settlement_time?: string | null;
    has_variable: boolean;
    price_variable?: number | null;
    cost_variable?: number | null;
    provider_variable_id?: string | null;
    has_fixed: boolean;
    price_fixed?: number | null;
    cost_fixed?: number | null;
    provider_fixed_id?: string | null;
    has_dispersion: boolean;
    price_dispersion?: number | null;
    cost_dispersion?: number | null;
    provider_dispersion_id?: string | null;
  }>;
  intl_lines: Array<{
    country_code: string;
    currency_code: string;
    has_payin: boolean;
    payin_price_variable?: number | null;
    payin_cost_variable?: number | null;
    payin_provider_variable_id?: string | null;
    payin_price_fixed?: number | null;
    payin_cost_fixed?: number | null;
    payin_provider_fixed_id?: string | null;
    has_payout: boolean;
    payout_price_variable?: number | null;
    payout_cost_variable?: number | null;
    payout_provider_variable_id?: string | null;
    payout_price_fixed?: number | null;
    payout_cost_fixed?: number | null;
    payout_provider_fixed_id?: string | null;
  }>;
};

export async function saveQuote(payload: QuotePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (!payload.customer_name?.trim()) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  // Insert quote
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .insert({
      customer_name: payload.customer_name.trim(),
      customer_company: payload.customer_company || null,
      customer_email: payload.customer_email || null,
      customer_contact: payload.customer_contact || null,
      notes: payload.notes || null,
      settlement_currency: payload.settlement_currency || null,
      minimum_monthly_billing: payload.minimum_monthly_billing ?? null,
      charges_3ds: !!payload.charges_3ds,
      cost_3ds: payload.cost_3ds ?? null,
      price_3ds: payload.price_3ds ?? null,
      provider_3ds_id: payload.provider_3ds_id || null,
      has_monthly_fee: !!payload.has_monthly_fee,
      monthly_fee: payload.monthly_fee ?? null,
      has_annual_fee: !!payload.has_annual_fee,
      annual_fee: payload.annual_fee ?? null,
      has_rolling_reserve: !!payload.has_rolling_reserve,
      rolling_reserve_pct: payload.rolling_reserve_pct ?? null,
      rolling_reserve_release_days: payload.rolling_reserve_release_days ?? null,
      extra_fees: payload.extra_fees || [],
      includes_card_processing: !!payload.includes_card_processing,
      includes_alternative_payments: !!payload.includes_alternative_payments,
      includes_international_payments: !!payload.includes_international_payments,
      created_by: user.id,
    })
    .select()
    .single();

  if (qErr || !quote) throw new Error(qErr?.message || "No se pudo crear la cotización");

  if (payload.card_lines.length > 0) {
    const rows = payload.card_lines.map((l) => ({ ...cleanRow(l), quote_id: quote.id }));
    const { error } = await supabase.from("quote_card_processing").insert(rows);
    if (error) throw new Error("Error al guardar líneas de tarjetas: " + error.message);
  }
  if (payload.alt_lines.length > 0) {
    const rows = payload.alt_lines.map((l) => ({ ...cleanRow(l), quote_id: quote.id }));
    const { error } = await supabase.from("quote_alternative_payments").insert(rows);
    if (error) throw new Error("Error al guardar pagos alternativos: " + error.message);
  }
  if (payload.intl_lines.length > 0) {
    const rows = payload.intl_lines.map((l) => ({ ...cleanRow(l), quote_id: quote.id }));
    const { error } = await supabase.from("quote_international_payments").insert(rows);
    if (error) throw new Error("Error al guardar pagos internacionales: " + error.message);
  }

  await logActivity({
    entity_type: "quote",
    entity_id: quote.id,
    entity_label: `${quote.quote_number} — ${quote.customer_name}`,
    action: "created",
  });

  redirect(`/cotizaciones/${quote.id}`);
}

/**
 * Actualiza una cotización existente: borra todos los hijos y los reinserta con la nueva data.
 * Más simple y robusto que diff/upsert para un MVP.
 */
export async function updateQuote(quoteId: string, payload: QuotePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (!payload.customer_name?.trim()) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  const { error: qErr } = await supabase
    .from("quotes")
    .update({
      customer_name: payload.customer_name.trim(),
      customer_company: payload.customer_company || null,
      customer_email: payload.customer_email || null,
      customer_contact: payload.customer_contact || null,
      notes: payload.notes || null,
      settlement_currency: payload.settlement_currency || null,
      minimum_monthly_billing: payload.minimum_monthly_billing ?? null,
      charges_3ds: !!payload.charges_3ds,
      cost_3ds: payload.cost_3ds ?? null,
      price_3ds: payload.price_3ds ?? null,
      provider_3ds_id: payload.provider_3ds_id || null,
      has_monthly_fee: !!payload.has_monthly_fee,
      monthly_fee: payload.monthly_fee ?? null,
      has_annual_fee: !!payload.has_annual_fee,
      annual_fee: payload.annual_fee ?? null,
      has_rolling_reserve: !!payload.has_rolling_reserve,
      rolling_reserve_pct: payload.rolling_reserve_pct ?? null,
      rolling_reserve_release_days: payload.rolling_reserve_release_days ?? null,
      extra_fees: payload.extra_fees || [],
      includes_card_processing: !!payload.includes_card_processing,
      includes_alternative_payments: !!payload.includes_alternative_payments,
      includes_international_payments: !!payload.includes_international_payments,
    })
    .eq("id", quoteId);

  if (qErr) throw new Error(qErr.message);

  // Reemplazar hijos: borrar y reinsertar
  await supabase.from("quote_card_processing").delete().eq("quote_id", quoteId);
  await supabase.from("quote_alternative_payments").delete().eq("quote_id", quoteId);
  await supabase.from("quote_international_payments").delete().eq("quote_id", quoteId);

  if (payload.includes_card_processing && payload.card_lines.length > 0) {
    const rows = payload.card_lines.map((l) => ({ ...cleanRow(l), quote_id: quoteId }));
    const { error } = await supabase.from("quote_card_processing").insert(rows);
    if (error) throw new Error("Error al guardar tarjetas: " + error.message);
  }
  if (payload.includes_alternative_payments && payload.alt_lines.length > 0) {
    const rows = payload.alt_lines.map((l) => ({ ...cleanRow(l), quote_id: quoteId }));
    const { error } = await supabase.from("quote_alternative_payments").insert(rows);
    if (error) throw new Error("Error al guardar alternativos: " + error.message);
  }
  if (payload.includes_international_payments && payload.intl_lines.length > 0) {
    const rows = payload.intl_lines.map((l) => ({ ...cleanRow(l), quote_id: quoteId }));
    const { error } = await supabase.from("quote_international_payments").insert(rows);
    if (error) throw new Error("Error al guardar internacionales: " + error.message);
  }

  await logActivity({
    entity_type: "quote",
    entity_id: quoteId,
    entity_label: payload.customer_name,
    action: "updated",
  });

  redirect(`/cotizaciones/${quoteId}?updated=1`);
}

/**
 * Duplica una cotización existente. La copia entra como Borrador, con un sufijo en el nombre
 * y conserva todas las líneas (tarjetas, alternativos, internacionales) + cargos extra y rolling reserve.
 * El nuevo quote_number se autogenera, y los campos de auditoría (approved_*, sent_*) NO se copian.
 */
export async function duplicateQuote(originalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: original, error: oerr } = await supabase
    .from("quotes").select("*").eq("id", originalId).single();
  if (oerr || !original) throw new Error("No se encontró la cotización original");

  const [{ data: cardLines }, { data: altLines }, { data: intlLines }] = await Promise.all([
    supabase.from("quote_card_processing").select("*").eq("quote_id", originalId),
    supabase.from("quote_alternative_payments").select("*").eq("quote_id", originalId),
    supabase.from("quote_international_payments").select("*").eq("quote_id", originalId),
  ]);

  // Crear la cotización copia (omite id, quote_number, created_at, status de aprobación)
  const {
    id: _omitId,
    quote_number: _omitNumber,
    created_at: _omitCreated,
    updated_at: _omitUpdated,
    approved_by: _omitAB,
    approved_at: _omitAA,
    ...quoteRest
  } = original as any;

  const { data: copy, error: cerr } = await supabase
    .from("quotes")
    .insert({
      ...quoteRest,
      customer_name: `${original.customer_name} (copia)`,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (cerr || !copy) throw new Error(cerr?.message || "No se pudo crear la copia");

  // Reinsertar hijos limpiando id/created_at para que Postgres use defaults
  if (cardLines?.length) {
    await supabase.from("quote_card_processing").insert(
      cardLines.map((l: any) => ({ ...cleanRow(l), quote_id: copy.id }))
    );
  }
  if (altLines?.length) {
    await supabase.from("quote_alternative_payments").insert(
      altLines.map((l: any) => ({ ...cleanRow(l), quote_id: copy.id }))
    );
  }
  if (intlLines?.length) {
    await supabase.from("quote_international_payments").insert(
      intlLines.map((l: any) => ({ ...cleanRow(l), quote_id: copy.id }))
    );
  }

  await logActivity({
    entity_type: "quote",
    entity_id: copy.id,
    entity_label: `${copy.quote_number} — ${copy.customer_name}`,
    action: "duplicated",
    details: { source_id: originalId, source_number: original.quote_number },
  });

  // Llevarlo al modo edición para que el usuario ajuste lo que cambie del cliente nuevo
  redirect(`/cotizaciones/${copy.id}/editar`);
}
