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

async function createProvider(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!name) return;
  await supabase.from("providers").insert({ name, description });
  revalidatePath("/admin/proveedores");
}

async function updateProvider(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!id || !name) return;
  await supabase.from("providers").update({ name, description }).eq("id", id);
  revalidatePath("/admin/proveedores");
  redirect("/admin/proveedores");
}

async function toggleActive(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  await supabase.from("providers").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/proveedores");
}

async function deleteProvider(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const id = String(formData.get("id") || "");
  await supabase.from("providers").delete().eq("id", id);
  revalidatePath("/admin/proveedores");
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const supabase = await ensureAdmin();
  const sp = await searchParams;
  const editId = sp.edit;

  const { data: providers } = await supabase
    .from("providers")
    .select("*")
    .order("name");

  const editing = editId ? providers?.find((p: any) => p.id === editId) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Proveedores</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Da de alta y edita los proveedores de servicios. Sólo administradores.</p>
      </header>

      <ProviderForm
        key={editing?.id || "new"}
        mode={editing ? "edit" : "create"}
        row={editing}
        action={editing ? updateProvider : createProvider}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Proveedor</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Descripción</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!providers || providers.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-ink-500 dark:text-ink-400">Aún no hay proveedores.</td></tr>
            ) : providers.map((p: any) => (
              <tr key={p.id} className={editId === p.id ? "bg-amber-50" : ""}>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300 hidden md:table-cell">{p.description || "—"}</td>
                <td className="px-4 py-2.5">
                  {p.active ? <span className="chip-green">Activo</span> : <span className="chip-ink">Inactivo</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={editId === p.id ? "/admin/proveedores" : `/admin/proveedores?edit=${p.id}`}
                      className="btn-ghost text-xs"
                      title={editId === p.id ? "Cancelar edición" : "Editar"}
                    >
                      {editId === p.id ? <X size={14} /> : <Edit2 size={14} />}
                    </Link>
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(p.active)} />
                      <button type="submit" className="btn-ghost text-xs">{p.active ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteProvider}>
                      <input type="hidden" name="id" value={p.id} />
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

function ProviderForm({ mode, row, action }: {
  mode: "create" | "edit";
  row: any;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className={`card-pad ${mode === "edit" ? "border-2 border-amber-400 bg-amber-50/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50">
          {mode === "edit" ? `Editar proveedor: ${row?.name}` : "Nuevo proveedor"}
        </h2>
        {mode === "edit" && <Link href="/admin/proveedores" className="text-xs text-ink-500 dark:text-ink-400 hover:underline">Cancelar</Link>}
      </div>
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Nombre</label>
          <input className="input" name="name" required defaultValue={row?.name || ""} placeholder="ej. Stripe, Conekta, MercadoPago" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Descripción (opcional)</label>
          <input className="input" name="description" defaultValue={row?.description || ""} placeholder="Notas internas" />
        </div>
      </div>
      <div className="mt-3">
        <button type="submit" className="btn-primary">
          <Save size={16} /> {mode === "edit" ? "Guardar cambios" : "Agregar proveedor"}
        </button>
      </div>
    </form>
  );
}
