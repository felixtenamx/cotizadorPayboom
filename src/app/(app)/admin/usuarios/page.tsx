import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ShieldCheck, User, UserPlus, AlertCircle } from "lucide-react";
import { roleLabel } from "@/lib/utils";

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, currentUserId: user.id };
}

async function setRole(formData: FormData) {
  "use server";
  const { supabase } = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "cotizador") as "admin" | "cotizador";
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

async function createUser(formData: FormData) {
  "use server";
  await ensureAdmin();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "cotizador") as "admin" | "cotizador";

  if (!email || !password || password.length < 8) {
    redirect(`/admin/usuarios?error=${encodeURIComponent("Email y contraseña (mín. 8 caracteres) son obligatorios")}`);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    redirect(`/admin/usuarios?error=${encodeURIComponent(e.message || "SUPABASE_SERVICE_ROLE_KEY no configurada")}`);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,                       // saltamos confirmación para flujo interno
    user_metadata: { full_name: fullName },
  });
  if (error) {
    redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  }

  // Asegurar el rol seleccionado (el trigger crea el profile como cotizador por defecto)
  if (data?.user) {
    await admin.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName || null,
      role,
    });
  }

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?created=${encodeURIComponent(email)}`);
}

async function deleteUser(formData: FormData) {
  "use server";
  await ensureAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  let admin;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    redirect(`/admin/usuarios?error=${encodeURIComponent(e.message)}`);
  }
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin/usuarios");
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { supabase, currentUserId } = await ensureAdmin();
  const sp = await searchParams;
  const adminConfigured = isAdminConfigured();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Usuarios</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">
          Crea nuevos miembros del equipo y gestiona sus permisos.
          Los <strong>Administradores</strong> pueden hacer todo (incluyendo aprobar cotizaciones).
          Los <strong>Boomers</strong> sólo ven Dashboard, Cotizaciones y crean nuevas, pero no acceden a Admin ni aprueban cotizaciones.
        </p>
      </header>

      {sp.created && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          ✓ Usuario <strong>{sp.created}</strong> creado. Comparte sus credenciales por canal seguro.
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{sp.error}</span>
        </div>
      )}

      {/* Form crear usuario */}
      <section className="card-pad">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={18} className="text-brand-600" />
          <h2 className="font-semibold text-ink-900 dark:text-ink-50">Crear nuevo usuario</h2>
        </div>

        {!adminConfigured ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
            <p className="font-semibold mb-1">Configuración requerida</p>
            <p>
              Para crear usuarios, agrega la variable <code className="bg-white dark:bg-ink-900 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> a tu archivo <code className="bg-white dark:bg-ink-900 px-1 rounded">.env.local</code>.
              La encuentras en Supabase Dashboard → Project Settings → API → <em>service_role key</em> (la oculta, no la <em>anon</em>).
              Luego reinicia el servidor (<code>Ctrl+C</code> y <code>npm run dev</code>).
            </p>
          </div>
        ) : (
          <form action={createUser} className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" name="full_name" placeholder="Nombre y apellido" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" name="email" type="email" required placeholder="usuario@payboom.io" />
            </div>
            <div>
              <label className="label">Contraseña inicial (mín. 8 caracteres)</label>
              <input className="input" name="password" type="text" required minLength={8} placeholder="Compártela por canal seguro" />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" name="role" defaultValue="cotizador">
                <option value="cotizador">Boomer (sólo cotiza)</option>
                <option value="admin">Administrador (acceso total)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">
                <UserPlus size={16} /> Crear usuario
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Usuario</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Rol</th>
              <th className="text-right px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!users || users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-ink-500 dark:text-ink-400">Sin usuarios.</td></tr>
            ) : users.map((u: any) => {
              const isSelf = u.id === currentUserId;
              const newRole = u.role === "admin" ? "cotizador" : "admin";
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                    {u.role === "admin" ? <ShieldCheck size={16} className="text-brand-500" /> : <User size={16} className="text-teal-600" />}
                    {u.full_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600 dark:text-ink-300">{u.email}</td>
                  <td className="px-4 py-2.5">
                    {u.role === "admin"
                      ? <span className="chip-brand">Administrador</span>
                      : <span className="chip-teal">{roleLabel(u.role)}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {!isSelf ? (
                      <div className="flex justify-end gap-2">
                        <form action={setRole}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="role" value={newRole} />
                          <button type="submit" className="btn-ghost text-xs">
                            Cambiar a {newRole === "admin" ? "Administrador" : "Boomer"}
                          </button>
                        </form>
                        {adminConfigured && (
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button type="submit" className="btn-ghost text-xs text-red-600 hover:bg-red-50" title="Eliminar usuario">
                              Eliminar
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="text-right text-xs text-ink-400">tú</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
