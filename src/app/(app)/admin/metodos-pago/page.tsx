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

function normalizeCode(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
}

async function createMethod(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const inputCode = String(formData.get("code") || "").trim();
  const code = normalizeCode(inputCode || name);
  const description = String(formData.get("description") || "").trim() || null;
  const display_order = Number(formData.get("display_order") || 100) || 100;
  await supabase.from("payment_methods").insert({ code, name, description, display_order });
  revalidatePath("/admin/metodos-pago");
}

async function updateMethod(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  // Sólo permitimos editar nombre, descripción, orden y activo. El code es estable para no romper costos.
  const description = String(formData.get("description") || "").trim() || null;
  const display_order = Number(formData.get("display_order") || 100) || 100;
  await supabase.from("payment_methods").update({ name, description, display_order }).eq("id", id);
  revalidatePath("/admin/metodos-pago");
  redirect("/admin/metodos-pago");
}

async function toggleActive(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  await supabase.from("payment_methods").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/metodos-pago");
}

async function deleteMethod(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  await supabase.from("payment_methods").delete().eq("id", id);
  revalidatePath("/admin/metodos-pago");
}

export default async function MetodosPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const supabase = await ensureAdmin();
  const sp = await searchParams;
  const editId = sp.edit;

  const { data: methods } = await supabase
    .from("payment_methods")
    .select("*")
    .order("display_order")
    .order("name");

  const editing = editId ? methods?.find((m: any) => m.id === editId) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Métodos de pago alternativos</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">
          SPEI, OXXO, PayBoom Cash y los que necesites agregar (PayPal, Klarna, transferencia, etc.).
          El <code>code</code> es el identificador interno usado para conectar los costos con las cotizaciones — no se puede cambiar después de crear el método.
        </p>
      </header>

      <MethodForm
        key={editing?.id || "new"}
        mode={editing ? "edit" : "create"}
        row={editing}
        action={editing ? updateMethod : createMethod}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Nombre</th>
              <th className="text-left px-4 py-2 font-medium">Code</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Descripción</th>
              <th className="text-right px-4 py-2 font-medium">Orden</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!methods || methods.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-ink-500 dark:text-ink-400">Aún no hay métodos.</td></tr>
            ) : methods.map((m: any) => (
              <tr key={m.id} className={editId === m.id ? "bg-amber-50" : ""}>
                <td className="px-4 py-2.5 font-medium">{m.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-500 dark:text-ink-400">{m.code}</td>
                <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300 hidden md:table-cell">{m.description || "—"}</td>
                <td className="px-4 py-2.5 text-right">{m.display_order}</td>
                <td className="px-4 py-2.5">
                  {m.active ? <span className="chip-green">Activo</span> : <span className="chip-ink">Inactivo</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={editId === m.id ? "/admin/metodos-pago" : `/admin/metodos-pago?edit=${m.id}`}
                      className="btn-ghost text-xs"
                      title={editId === m.id ? "Cancelar edición" : "Editar"}
                    >
                      {editId === m.id ? <X size={14} /> : <Edit2 size={14} />}
                    </Link>
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="active" value={String(m.active)} />
                      <button type="submit" className="btn-ghost text-xs">{m.active ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteMethod}>
                      <input type="hidden" name="id" value={m.id} />
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

function MethodForm({ mode, row, action }: {
  mode: "create" | "edit";
  row: any;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className={`card-pad ${mode === "edit" ? "border-2 border-amber-400 bg-amber-50/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50">
          {mode === "edit" ? `Editar método: ${row?.name}` : "Nuevo método de pago"}
        </h2>
        {mode === "edit" && <Link href="/admin/metodos-pago" className="text-xs text-ink-500 dark:text-ink-400 hover:underline">Cancelar</Link>}
      </div>
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="label">Nombre</label>
          <input className="input" name="name" required defaultValue={row?.name || ""} placeholder="ej. PayPal, Klarna, Transferencia" />
        </div>
        {mode === "create" && (
          <div>
            <label className="label">Code (opcional, se autogenera)</label>
            <input className="input font-mono text-xs" name="code" placeholder="se infiere del nombre" />
          </div>
        )}
        {mode === "edit" && (
          <div>
            <label className="label">Code (no editable)</label>
            <input className="input font-mono text-xs bg-ink-50 dark:bg-ink-950" value={row?.code || ""} readOnly disabled />
          </div>
        )}
        <div>
          <label className="label">Orden</label>
          <input className="input" type="number" min="1" name="display_order" defaultValue={row?.display_order ?? 100} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label">Descripción (opcional)</label>
        <input className="input" name="description" defaultValue={row?.description || ""} />
      </div>
      <div className="mt-3">
        <button type="submit" className="btn-primary">
          <Save size={16} /> {mode === "edit" ? "Guardar cambios" : "Crear método"}
        </button>
      </div>
    </form>
  );
}
