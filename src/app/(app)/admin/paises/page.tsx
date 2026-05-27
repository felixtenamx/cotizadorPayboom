import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Trash2, Edit2, X, Save } from "lucide-react";

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return supabase;
}

async function createCountry(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const code = String(formData.get("code") || "").toUpperCase().trim();
  const name = String(formData.get("name") || "").trim();
  const default_currency_code = String(formData.get("default_currency_code") || "").toUpperCase().trim() || null;
  if (!code || !name) {
    redirect(`/admin/paises?error=${encodeURIComponent("Código y nombre son obligatorios.")}`);
  }
  const { error } = await supabase.from("countries").insert({ code, name, default_currency_code });
  if (error) {
    redirect(`/admin/paises?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/paises");
}

async function updateCountry(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const default_currency_code = String(formData.get("default_currency_code") || "").toUpperCase().trim() || null;
  // El código es primary key referenciado por otras tablas — no lo permitimos editar.
  if (!id || !name) return;
  const { error } = await supabase
    .from("countries")
    .update({ name, default_currency_code })
    .eq("id", id);
  if (error) {
    redirect(`/admin/paises?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/paises");
  redirect("/admin/paises");
}

async function toggleActive(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  await supabase.from("countries").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/paises");
}

async function deleteCountry(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const code = String(formData.get("code") || "");

  // Verificar si tiene referencias antes de borrar
  const checks = await Promise.all([
    supabase.from("provider_costs").select("id", { count: "exact", head: true }).eq("country_code", code),
    supabase.from("quote_card_processing").select("id", { count: "exact", head: true }).eq("country_code", code),
    supabase.from("quote_alternative_payments").select("id", { count: "exact", head: true }).eq("country_code", code),
    supabase.from("quote_international_payments").select("id", { count: "exact", head: true }).eq("country_code", code),
  ]);

  const inUse =
    (checks[0].count || 0) + (checks[1].count || 0) +
    (checks[2].count || 0) + (checks[3].count || 0);

  if (inUse > 0) {
    redirect(`/admin/paises?error=${encodeURIComponent(
      `No se puede borrar "${code}" porque está usado en ${inUse} registro(s) (costos o cotizaciones existentes). Desactívalo en lugar de borrarlo.`
    )}`);
  }

  const { error } = await supabase.from("countries").delete().eq("id", id);
  if (error) {
    redirect(`/admin/paises?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/paises");
}

export default async function PaisesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const supabase = await ensureAdmin();
  const sp = await searchParams;
  const editId = sp.edit;

  const [{ data: countries }, { data: currencies }] = await Promise.all([
    supabase.from("countries").select("*").order("name"),
    supabase.from("currencies").select("code, name").order("code"),
  ]);

  const editing = editId ? countries?.find((c: any) => c.id === editId) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Países</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Países que se podrán cotizar.</p>
      </header>

      {sp.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {sp.error}
        </div>
      )}

      <CountryForm
        key={editing?.id || "new"}
        mode={editing ? "edit" : "create"}
        row={editing}
        action={editing ? updateCountry : createCountry}
        currencies={currencies || []}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Código</th>
              <th className="text-left px-4 py-2 font-medium">Nombre</th>
              <th className="text-left px-4 py-2 font-medium">Moneda</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!countries || countries.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-ink-500 dark:text-ink-400">Sin países.</td></tr>
            ) : countries.map((c: any) => (
              <tr key={c.id} className={editId === c.id ? "bg-amber-50" : ""}>
                <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-2.5">{c.name}</td>
                <td className="px-4 py-2.5">{c.default_currency_code || "—"}</td>
                <td className="px-4 py-2.5">
                  {c.active ? <span className="chip-green">Activo</span> : <span className="chip-ink">Inactivo</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={editId === c.id ? "/admin/paises" : `/admin/paises?edit=${c.id}`}
                      className="btn-ghost text-xs"
                      title={editId === c.id ? "Cancelar edición" : "Editar"}
                    >
                      {editId === c.id ? <X size={14} /> : <Edit2 size={14} />}
                    </Link>
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={String(c.active)} />
                      <button type="submit" className="btn-ghost text-xs">{c.active ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteCountry}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="code" value={c.code} />
                      <button type="submit" className="btn-ghost text-xs text-red-600 hover:bg-red-50" title="Eliminar (sólo si no está en uso)">
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

function CountryForm({ mode, row, action, currencies }: {
  mode: "create" | "edit";
  row: any;
  action: (fd: FormData) => Promise<void>;
  currencies: any[];
}) {
  return (
    <form action={action} className={`card-pad ${mode === "edit" ? "border-2 border-amber-400 bg-amber-50/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50">
          {mode === "edit" ? `Editar país: ${row?.code} — ${row?.name}` : "Nuevo país"}
        </h2>
        {mode === "edit" && <Link href="/admin/paises" className="text-xs text-ink-500 dark:text-ink-400 hover:underline">Cancelar</Link>}
      </div>
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <div className="grid md:grid-cols-4 gap-3">
        {mode === "create" ? (
          <div>
            <label className="label">Código (ISO alpha-2)</label>
            <input className="input uppercase font-mono" name="code" required maxLength={2} placeholder="MX" />
          </div>
        ) : (
          <div>
            <label className="label">Código (no editable)</label>
            <input className="input uppercase font-mono bg-ink-50 dark:bg-ink-950" value={row?.code || ""} readOnly disabled />
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label">Nombre</label>
          <input className="input" name="name" required defaultValue={row?.name || ""} placeholder="México" />
        </div>
        <div>
          <label className="label">Moneda predeterminada</label>
          <select className="input" name="default_currency_code" defaultValue={row?.default_currency_code || ""}>
            <option value="">— Ninguna —</option>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <button type="submit" className="btn-primary">
          <Save size={16} /> {mode === "edit" ? "Guardar cambios" : "Agregar país"}
        </button>
      </div>
    </form>
  );
}
