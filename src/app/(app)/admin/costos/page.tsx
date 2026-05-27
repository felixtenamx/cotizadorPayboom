import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Trash2, Edit2, X, Save } from "lucide-react";
import { PRESET_SETTLEMENT_TIMES } from "@/lib/utils";

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, userId: user.id };
}

const numberOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v || "").trim();
  return s ? Number(s) : null;
};
const stringOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v || "").trim();
  return s || null;
};

async function createCost(formData: FormData) {
  "use server";
  const { supabase, userId } = await ensureAdmin();
  await supabase.from("provider_costs").insert({
    provider_id: String(formData.get("provider_id")),
    service_type: String(formData.get("service_type")) as any,
    subtype: stringOrNull(formData.get("subtype")),
    country_code: stringOrNull(formData.get("country_code")),
    currency_code: String(formData.get("currency_code")),
    cost_variable: numberOrNull(formData.get("cost_variable")),
    cost_fixed: numberOrNull(formData.get("cost_fixed")),
    cost_chargeback: numberOrNull(formData.get("cost_chargeback")),
    cost_refund: numberOrNull(formData.get("cost_refund")),
    cost_dispersion: numberOrNull(formData.get("cost_dispersion")),
    settlement_time: stringOrNull(formData.get("settlement_time")),
    notes: stringOrNull(formData.get("notes")),
    created_by: userId,
  });
  revalidatePath("/admin/costos");
}

async function updateCost(formData: FormData) {
  "use server";
  const { supabase } = await ensureAdmin();
  const id = String(formData.get("id"));
  await supabase.from("provider_costs").update({
    provider_id: String(formData.get("provider_id")),
    service_type: String(formData.get("service_type")) as any,
    subtype: stringOrNull(formData.get("subtype")),
    country_code: stringOrNull(formData.get("country_code")),
    currency_code: String(formData.get("currency_code")),
    cost_variable: numberOrNull(formData.get("cost_variable")),
    cost_fixed: numberOrNull(formData.get("cost_fixed")),
    cost_chargeback: numberOrNull(formData.get("cost_chargeback")),
    cost_refund: numberOrNull(formData.get("cost_refund")),
    cost_dispersion: numberOrNull(formData.get("cost_dispersion")),
    settlement_time: stringOrNull(formData.get("settlement_time")),
    notes: stringOrNull(formData.get("notes")),
  }).eq("id", id);
  revalidatePath("/admin/costos");
  redirect("/admin/costos");
}

async function deleteCost(formData: FormData) {
  "use server";
  const { supabase } = await ensureAdmin();
  const id = String(formData.get("id") || "");
  await supabase.from("provider_costs").delete().eq("id", id);
  revalidatePath("/admin/costos");
}

export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase } = await ensureAdmin();
  const sp = await searchParams;
  const editId = sp.edit;

  const [{ data: costs }, { data: providers }, { data: countries }, { data: currencies }, { data: paymentMethods }] = await Promise.all([
    supabase.from("provider_costs").select("*, provider:providers(name)").order("created_at", { ascending: false }),
    supabase.from("providers").select("*").eq("active", true).order("name"),
    supabase.from("countries").select("*").order("name"),
    supabase.from("currencies").select("*").order("code"),
    supabase.from("payment_methods").select("*").eq("active", true).order("display_order"),
  ]);

  const editing = editId ? costs?.find((c: any) => c.id === editId) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Costos por proveedor</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Registra y edita los costos que te dan tus proveedores. Estos sirven de referencia al cotizar y nunca aparecen en el documento del cliente.</p>
      </header>

      {(!providers || providers.length === 0 || !currencies || currencies.length === 0) ? (
        <div className="card-pad text-sm text-amber-700 bg-amber-50">
          Antes de cargar costos necesitas dar de alta al menos un proveedor y una moneda.
        </div>
      ) : (
        // key fuerza un remount cuando cambia la fila editada para que defaultValue se re-evalúe.
        <CostForm
          key={editing?.id || "new"}
          mode={editing ? "edit" : "create"}
          row={editing}
          action={editing ? updateCost : createCost}
          providers={providers!}
          countries={countries || []}
          currencies={currencies!}
          paymentMethods={paymentMethods || []}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Proveedor</th>
              <th className="text-left px-3 py-2 font-medium">Servicio</th>
              <th className="text-left px-3 py-2 font-medium">Subtipo</th>
              <th className="text-left px-3 py-2 font-medium">País</th>
              <th className="text-left px-3 py-2 font-medium">Mon.</th>
              <th className="text-right px-3 py-2 font-medium">Var %</th>
              <th className="text-right px-3 py-2 font-medium">Fijo</th>
              <th className="text-right px-3 py-2 font-medium">CB</th>
              <th className="text-right px-3 py-2 font-medium">Refund</th>
              <th className="text-right px-3 py-2 font-medium">Disp.</th>
              <th className="text-left px-3 py-2 font-medium">Liq.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!costs || costs.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-6 text-ink-500 dark:text-ink-400">Sin costos cargados.</td></tr>
            ) : costs.map((c: any) => (
              <tr key={c.id} className={editId === c.id ? "bg-amber-50" : ""}>
                <td className="px-3 py-2 font-medium">{c.provider?.name || "—"}</td>
                <td className="px-3 py-2">{labelService(c.service_type)}</td>
                <td className="px-3 py-2">{c.subtype || "—"}</td>
                <td className="px-3 py-2">{c.country_code || "—"}</td>
                <td className="px-3 py-2 font-mono">{c.currency_code}</td>
                <td className="px-3 py-2 text-right">{c.cost_variable ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.cost_fixed ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.cost_chargeback ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.cost_refund ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.cost_dispersion ?? "—"}</td>
                <td className="px-3 py-2">{c.settlement_time || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={editId === c.id ? "/admin/costos" : `/admin/costos?edit=${c.id}`}
                      className="btn-ghost text-xs"
                      title={editId === c.id ? "Cancelar edición" : "Editar"}
                    >
                      {editId === c.id ? <X size={14} /> : <Edit2 size={14} />}
                    </Link>
                    <form action={deleteCost}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="btn-ghost text-xs text-red-600 hover:bg-red-50" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostForm({ mode, row, action, providers, countries, currencies, paymentMethods }: {
  mode: "create" | "edit";
  row: any;
  action: (fd: FormData) => Promise<void>;
  providers: any[];
  countries: any[];
  currencies: any[];
  paymentMethods: any[];
}) {
  // Subtypes válidos: debit/credit/international/amex para tarjetas + cualquier code de payment_method
  const subtypeOptions = ["debit", "credit", "international", "amex", ...paymentMethods.map((m) => m.code)];
  return (
    <form action={action} className={`card-pad space-y-3 ${mode === "edit" ? "border-2 border-amber-400 bg-amber-50/30" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50">
          {mode === "edit" ? "Editar costo" : "Nuevo costo"}
        </h2>
        {mode === "edit" && <Link href="/admin/costos" className="text-xs text-ink-500 dark:text-ink-400 hover:underline">Cancelar</Link>}
      </div>
      {row?.id && <input type="hidden" name="id" value={row.id} />}

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Proveedor</label>
          <select className="input" name="provider_id" required defaultValue={row?.provider_id || ""}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo de servicio</label>
          <select className="input" name="service_type" required defaultValue={row?.service_type || "card_processing"}>
            <option value="card_processing">Procesamiento de tarjetas</option>
            <option value="alternative_payment">Pago alternativo (SPEI/OXXO/etc)</option>
            <option value="international_payin">Internacional Pay-In</option>
            <option value="international_payout">Internacional Pay-Out</option>
          </select>
        </div>
        <div>
          <label className="label">Subtipo</label>
          <input
            className="input font-mono text-xs"
            name="subtype"
            defaultValue={row?.subtype || ""}
            list="subtype-options"
            placeholder="debit / credit / spei / oxxo / …"
          />
          <datalist id="subtype-options">
            {subtypeOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
          <p className="text-[10px] text-ink-400 mt-0.5">Para tarjetas usa <code>debit</code>, <code>credit</code>, <code>international</code> o <code>amex</code>. Para alternativos, el code del método.</p>
        </div>
        <div>
          <label className="label">País</label>
          <select className="input" name="country_code" defaultValue={row?.country_code || ""}>
            <option value="">— Sin país —</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Moneda</label>
          <select className="input" name="currency_code" required defaultValue={row?.currency_code || ""}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Liquidación</label>
          <input
            className="input"
            name="settlement_time"
            defaultValue={row?.settlement_time || ""}
            list="settlement-options"
            placeholder="ej. T+1, 7/7, Quincenal…"
          />
          <datalist id="settlement-options">
            {PRESET_SETTLEMENT_TIMES.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-3">
        <div>
          <label className="label">Costo variable %</label>
          <input className="input" name="cost_variable" type="number" step="0.0001" defaultValue={row?.cost_variable ?? ""} placeholder="2.50" />
        </div>
        <div>
          <label className="label">Costo fijo</label>
          <input className="input" name="cost_fixed" type="number" step="0.0001" defaultValue={row?.cost_fixed ?? ""} placeholder="0.30" />
        </div>
        <div>
          <label className="label">Contracargo</label>
          <input className="input" name="cost_chargeback" type="number" step="0.0001" defaultValue={row?.cost_chargeback ?? ""} />
        </div>
        <div>
          <label className="label">Reverso/Refund</label>
          <input className="input" name="cost_refund" type="number" step="0.0001" defaultValue={row?.cost_refund ?? ""} />
        </div>
        <div>
          <label className="label">Dispersión</label>
          <input className="input" name="cost_dispersion" type="number" step="0.0001" defaultValue={row?.cost_dispersion ?? ""} />
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <input className="input" name="notes" defaultValue={row?.notes || ""} placeholder="Notas internas (opcional)" />
      </div>

      <div>
        <button type="submit" className="btn-primary">
          <Save size={16} /> {mode === "edit" ? "Guardar cambios" : "Crear costo"}
        </button>
      </div>
    </form>
  );
}

function labelService(s: string) {
  return ({
    card_processing: "Tarjetas",
    alternative_payment: "Alt. (SPEI/OXXO)",
    international_payin: "Pay-In Intl.",
    international_payout: "Pay-Out Intl.",
  } as Record<string,string>)[s] || s;
}
