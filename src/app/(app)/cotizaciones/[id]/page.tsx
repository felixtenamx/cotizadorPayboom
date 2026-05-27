import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Download, ArrowLeft, Edit2, Trash2, Pencil, Copy } from "lucide-react";
import { duplicateQuote } from "../nueva/actions";
import { logActivity } from "@/lib/audit";
import { margin, formatPercent } from "@/lib/utils";

async function deleteQuote(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  // Capturar label antes de borrar
  const { data: q } = await supabase.from("quotes").select("quote_number, customer_name").eq("id", id).single();
  await supabase.from("quotes").delete().eq("id", id);
  await logActivity({
    entity_type: "quote",
    entity_id: id,
    entity_label: q ? `${q.quote_number} — ${q.customer_name}` : id,
    action: "deleted",
  });
  revalidatePath("/cotizaciones");
  redirect("/cotizaciones");
}

async function updateStatus(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "draft");
  if (!id) return;

  // Sólo admins pueden marcar "approved" o "rejected"
  if (status === "approved" || status === "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
    if (profile?.role !== "admin") {
      redirect(`/cotizaciones/${id}?error=${encodeURIComponent("Solo los administradores pueden aprobar o rechazar cotizaciones.")}`);
    }
  }

  const updateData: any = { status };
  // Auditoría de aprobación: quién y cuándo
  if (status === "approved") {
    const { data: { user } } = await supabase.auth.getUser();
    updateData.approved_by = user?.id || null;
    updateData.approved_at = new Date().toISOString();
  }

  const { data: prev } = await supabase.from("quotes").select("status, quote_number, customer_name").eq("id", id).single();
  const { error } = await supabase.from("quotes").update(updateData).eq("id", id);
  if (error) {
    console.error("[updateStatus] Supabase error:", error);
  } else {
    const auditAction =
      status === "approved" ? "approved" :
      status === "rejected" ? "rejected" : "status_changed";
    await logActivity({
      entity_type: "quote",
      entity_id: id,
      entity_label: prev ? `${prev.quote_number} — ${prev.customer_name}` : id,
      action: auditAction as any,
      details: { from: prev?.status, to: status },
    });
  }
  revalidatePath(`/cotizaciones/${id}`);
  redirect(`/cotizaciones/${id}?updated=1`);
}

export default async function CotizacionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isAdmin = profile?.role === "admin";

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!quote) redirect("/cotizaciones");

  const [{ data: cardLines }, { data: altLines }, { data: intlLines }, { data: countries }, { data: providers }, { data: approver }] = await Promise.all([
    supabase.from("quote_card_processing").select("*").eq("quote_id", id),
    supabase.from("quote_alternative_payments").select("*").eq("quote_id", id),
    supabase.from("quote_international_payments").select("*").eq("quote_id", id),
    supabase.from("countries").select("*"),
    supabase.from("providers").select("*"),
    quote.approved_by
      ? supabase.from("profiles").select("full_name, email").eq("id", quote.approved_by).single()
      : Promise.resolve({ data: null }),
  ]);

  const countryName = (code: string) => countries?.find((c) => c.code === code)?.name || code;
  const providerName = (id: string | null) => providers?.find((p) => p.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <Link href="/cotizaciones" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-200">
        <ArrowLeft size={14} /> Volver a cotizaciones
      </Link>

      {sp.updated === "1" && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          Cotización actualizada.
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {sp.error}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{quote.customer_name}</h1>
            <StatusChip status={quote.status} />
          </div>
          <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">
            <span className="font-mono">{quote.quote_number}</span>
            {quote.customer_company && <> · {quote.customer_company}</>}
            {" · "}{new Date(quote.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {quote.status === "approved" && quote.approved_at && (
            <p className="text-emerald-700 text-xs mt-1 flex items-center gap-1">
              ✓ Aprobada por <strong>{(approver as any)?.full_name || (approver as any)?.email || "—"}</strong>
              {" · "}{new Date(quote.approved_at).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Acción primaria siempre visible: PDF en español */}
          <Link href={`/cotizaciones/${id}/pdf?lang=es`} className="btn-primary flex-1 md:flex-initial">
            <Download size={16} /> PDF
          </Link>

          {/* Más descargas (PDF EN, Word ES/EN) — desplegable */}
          <details className="relative flex-1 md:flex-initial">
            <summary className="btn-secondary cursor-pointer list-none w-full">
              <Download size={14} /> Más formatos ▾
            </summary>
            <div className="absolute right-0 md:left-0 mt-1 z-30 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-lg min-w-[180px] overflow-hidden">
              <Link href={`/cotizaciones/${id}/pdf?lang=en`} className="block px-4 py-2.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">PDF (English)</Link>
              <Link href={`/cotizaciones/${id}/word?lang=es`} className="block px-4 py-2.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">Word (Español)</Link>
              <Link href={`/cotizaciones/${id}/word?lang=en`} className="block px-4 py-2.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">Word (English)</Link>
            </div>
          </details>

          {/* Acciones secundarias (editar, duplicar, borrar) — desplegable */}
          <details className="relative flex-1 md:flex-initial">
            <summary className="btn-secondary cursor-pointer list-none w-full">
              Acciones ▾
            </summary>
            <div className="absolute right-0 mt-1 z-30 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-lg min-w-[180px] overflow-hidden">
              <Link href={`/cotizaciones/${id}/editar`} className="block px-4 py-2.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                <Pencil size={14} className="inline mr-2" /> Editar
              </Link>
              <form action={async () => { "use server"; await duplicateQuote(id); }}>
                <button type="submit" className="block w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                  <Copy size={14} className="inline mr-2" /> Duplicar
                </button>
              </form>
              <form action={deleteQuote} className="border-t border-ink-100 dark:border-ink-800">
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="block w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                  <Trash2 size={14} className="inline mr-2" /> Eliminar
                </button>
              </form>
            </div>
          </details>

          {/* Cambio de status: select + botón, en su propia fila en mobile */}
          <form action={updateStatus} className="flex items-center gap-1 w-full md:w-auto mt-1 md:mt-0">
            <input type="hidden" name="id" value={id} />
            <select name="status" defaultValue={quote.status} className="input flex-1">
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              {isAdmin && <option value="approved">Aprobada</option>}
              {isAdmin && <option value="rejected">Rechazada</option>}
            </select>
            <button type="submit" className="btn-secondary text-xs whitespace-nowrap">Actualizar</button>
          </form>
        </div>
      </header>

      {/* Información del cliente */}
      <section className="card-pad">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">Cliente</h2>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Nombre" value={quote.customer_name} />
          <Field label="Empresa" value={quote.customer_company} />
          <Field label="Email" value={quote.customer_email} />
          <Field label="Contacto" value={quote.customer_contact} />
          {quote.notes && <div className="md:col-span-2"><Field label="Notas" value={quote.notes} /></div>}
        </dl>
      </section>

      {/* Tarjetas */}
      {quote.includes_card_processing && (cardLines?.length || 0) > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="font-semibold text-ink-900 dark:text-ink-50 px-5 pt-5 pb-3">Procesamiento de tarjetas</h2>
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">País</th>
                <th className="text-left px-4 py-2 font-medium">Tarjeta</th>
                <th className="text-right px-4 py-2 font-medium">Variable</th>
                <th className="text-right px-4 py-2 font-medium">Fijo</th>
                <th className="text-right px-4 py-2 font-medium">Contracargo</th>
                <th className="text-right px-4 py-2 font-medium">Refund</th>
                <th className="text-left px-4 py-2 font-medium">Liquidación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {cardLines!.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">{countryName(l.country_code)}</td>
                  <td className="px-4 py-2.5">{cardTypeLabel(l.card_type)}</td>
                  <FeeMaskCell included={l.has_variable} price={l.price_variable} cost={l.cost_variable} unit="%" provider={providerName(l.provider_variable_id)} />
                  <FeeMaskCell included={l.has_fixed} price={l.price_fixed} cost={l.cost_fixed} unit={l.currency_code} provider={providerName(l.provider_fixed_id)} />
                  <FeeMaskCell included={l.has_chargeback} price={l.price_chargeback} cost={l.cost_chargeback} unit={l.currency_code} provider={providerName(l.provider_chargeback_id)} />
                  <FeeMaskCell included={l.has_refund} price={l.price_refund} cost={l.cost_refund} unit={l.currency_code} provider={providerName(l.provider_refund_id)} />
                  <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{l.settlement_time || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Alternativos */}
      {quote.includes_alternative_payments && (altLines?.length || 0) > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="font-semibold text-ink-900 dark:text-ink-50 px-5 pt-5 pb-3">Pagos alternativos</h2>
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">País</th>
                <th className="text-left px-4 py-2 font-medium">Método</th>
                <th className="text-right px-4 py-2 font-medium">Variable</th>
                <th className="text-right px-4 py-2 font-medium">Fijo</th>
                <th className="text-right px-4 py-2 font-medium">Dispersión</th>
                <th className="text-left px-4 py-2 font-medium">Liquidación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {altLines!.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">{countryName(l.country_code)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {{ spei: "SPEI", oxxo: "OXXO", payboom_cash: "PayBoom Cash" }[l.method]}
                  </td>
                  <FeeMaskCell included={l.has_variable} price={l.price_variable} cost={l.cost_variable} unit="%" provider={providerName(l.provider_variable_id)} />
                  <FeeMaskCell included={l.has_fixed} price={l.price_fixed} cost={l.cost_fixed} unit={l.currency_code} provider={providerName(l.provider_fixed_id)} />
                  <FeeMaskCell included={l.has_dispersion} price={l.price_dispersion} cost={l.cost_dispersion} unit={l.currency_code} provider={providerName(l.provider_dispersion_id)} />
                  <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{l.settlement_time || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Internacional */}
      {quote.includes_international_payments && (intlLines?.length || 0) > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="font-semibold text-ink-900 dark:text-ink-50 px-5 pt-5 pb-3">Pagos internacionales</h2>
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">País</th>
                <th className="text-left px-4 py-2 font-medium">Servicio</th>
                <th className="text-right px-4 py-2 font-medium">Variable</th>
                <th className="text-right px-4 py-2 font-medium">Fijo</th>
                <th className="text-left px-4 py-2 font-medium">Moneda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {intlLines!.flatMap((l) => {
                const rows = [];
                if (l.has_payin) rows.push(
                  <tr key={l.id + "-payin"}>
                    <td className="px-4 py-2.5">{countryName(l.country_code)}</td>
                    <td className="px-4 py-2.5 font-medium">Pay-In</td>
                    <FeeMaskCell included={true} price={l.payin_price_variable} cost={l.payin_cost_variable} unit="%" provider={providerName(l.payin_provider_variable_id)} />
                    <FeeMaskCell included={true} price={l.payin_price_fixed} cost={l.payin_cost_fixed} unit={l.currency_code} provider={providerName(l.payin_provider_fixed_id)} />
                    <td className="px-4 py-2.5 font-mono">{l.currency_code}</td>
                  </tr>
                );
                if (l.has_payout) rows.push(
                  <tr key={l.id + "-payout"}>
                    <td className="px-4 py-2.5">{countryName(l.country_code)}</td>
                    <td className="px-4 py-2.5 font-medium">Pay-Out</td>
                    <FeeMaskCell included={true} price={l.payout_price_variable} cost={l.payout_cost_variable} unit="%" provider={providerName(l.payout_provider_variable_id)} />
                    <FeeMaskCell included={true} price={l.payout_price_fixed} cost={l.payout_cost_fixed} unit={l.currency_code} provider={providerName(l.payout_provider_fixed_id)} />
                    <td className="px-4 py-2.5 font-mono">{l.currency_code}</td>
                  </tr>
                );
                return rows;
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Configuración final */}
      <section className="card-pad">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">Configuración y tarifas finales</h2>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Moneda de liquidación" value={quote.settlement_currency} />
          <Field label="Mínimo mensual a facturar" value={quote.minimum_monthly_billing != null ? `${quote.minimum_monthly_billing} ${quote.settlement_currency || ""}` : null} />
          {quote.charges_3ds && (
            <>
              <Field label="3DS — costo" value={quote.cost_3ds != null ? String(quote.cost_3ds) : null} />
              <Field label="3DS — precio" value={quote.price_3ds != null ? String(quote.price_3ds) : null} />
            </>
          )}
          {quote.has_monthly_fee && <Field label="Cuota mensual de plataforma" value={quote.monthly_fee != null ? String(quote.monthly_fee) : null} />}
          {quote.has_annual_fee && <Field label="Cuota anual de plataforma" value={quote.annual_fee != null ? String(quote.annual_fee) : null} />}
          {quote.has_rolling_reserve && (
            <>
              <Field label="Rolling Reserve" value={quote.rolling_reserve_pct != null ? `${quote.rolling_reserve_pct}%` : null} />
              <Field label="Período de liberación" value={quote.rolling_reserve_release_days != null ? `${quote.rolling_reserve_release_days} días` : null} />
            </>
          )}
        </dl>

        {Array.isArray(quote.extra_fees) && quote.extra_fees.length > 0 && (
          <div className="mt-5 pt-4 border-t border-ink-100 dark:border-ink-800">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-2">Cargos adicionales</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-500 dark:text-ink-400">
                <tr>
                  <th className="text-left font-medium py-1">Concepto</th>
                  <th className="text-left font-medium py-1">Frecuencia</th>
                  <th className="text-right font-medium py-1">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {quote.extra_fees.map((fee: any) => (
                  <tr key={fee.id}>
                    <td className="py-2">{fee.title}</td>
                    <td className="py-2 text-ink-600 dark:text-ink-300">{frequencyLabel(fee.frequency)}</td>
                    <td className="py-2 text-right font-medium">{Number(fee.amount).toFixed(2)} {fee.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-ink-400 italic">
        Costos y proveedores son visibles internamente; nunca aparecen en el documento Word generado para el cliente.
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="text-ink-900 dark:text-ink-50">{value || <span className="text-ink-400">—</span>}</dd>
    </div>
  );
}

function FeeMaskCell({ included, price, cost, unit, provider }: { included: boolean; price: number | null; cost: number | null; unit: string; provider: string }) {
  if (!included) return <td className="px-4 py-2.5 text-right text-ink-400">N/A</td>;
  const m = margin(price, cost);
  const marginColor = m == null ? "text-ink-400" : m >= 30 ? "text-emerald-600" : m >= 0 ? "text-amber-600" : "text-red-600";
  return (
    <td className="px-4 py-2.5 text-right">
      <div className="font-medium text-ink-900 dark:text-ink-50">{price != null ? `${price} ${unit}` : "—"}</div>
      <div className="text-[11px] text-ink-500 dark:text-ink-400">
        Costo: {cost != null ? `${cost} ${unit}` : "—"} · {provider}
      </div>
      <div className={`text-[11px] ${marginColor}`}>{m != null ? formatPercent(m) : ""}</div>
    </td>
  );
}

function cardTypeLabel(t: string) {
  return ({ debit: "Débito", credit: "Crédito", international: "Internacional", amex: "AMEX" } as Record<string,string>)[t] || t;
}

function frequencyLabel(f: string) {
  return ({
    one_time: "Pago único",
    monthly: "Mensual",
    annual: "Anual",
    per_transaction: "Por transacción",
  } as Record<string,string>)[f] || f;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "chip-ink", sent: "chip-brand", approved: "chip-green", rejected: "chip-red",
  };
  const labels: Record<string, string> = {
    draft: "Borrador", sent: "Enviada", approved: "Aprobada", rejected: "Rechazada",
  };
  return <span className={map[status]}>{labels[status]}</span>;
}
