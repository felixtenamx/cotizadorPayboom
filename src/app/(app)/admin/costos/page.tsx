import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Save } from "lucide-react";
import { PRESET_SETTLEMENT_TIMES } from "@/lib/utils";
import CostsExplorer from "./CostsExplorer";

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

async function duplicateCost(formData: FormData) {
  "use server";
  const { supabase, userId } = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const { data: src } = await supabase
    .from("provider_costs")
    .select("*")
    .eq("id", id)
    .single();
  if (!src) {
    revalidatePath("/admin/costos");
    return;
  }
  // Copia todos los campos relevantes; deja que la BD genere nuevo id y created_at.
  await supabase.from("provider_costs").insert({
    provider_id: src.provider_id,
    service_type: src.service_type,
    subtype: src.subtype,
    country_code: src.country_code,
    currency_code: src.currency_code,
    cost_variable: src.cost_variable,
    cost_fixed: src.cost_fixed,
    cost_chargeback: src.cost_chargeback,
    cost_refund: src.cost_refund,
    cost_dispersion: src.cost_dispersion,
    settlement_time: src.settlement_time,
    notes: src.notes ? `${src.notes} (copia)` : "(copia)",
    created_by: userId,
  });
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

      <CostsExplorer
        costs={(costs || []) as any}
        providers={(providers || []) as any}
        countries={(countries || []) as any}
        currencies={(currencies || []) as any}
        editId={editId}
        deleteAction={deleteCost}
        duplicateAction={duplicateCost}
      />
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

