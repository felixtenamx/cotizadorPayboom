import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Home, FileText, Plus, Users, Building2, Globe, Coins, LogOut, ShieldCheck, Banknote, Activity, KeyRound } from "lucide-react";
import { roleLabel } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-cream-100 dark:bg-ink-950">
      {/* Sidebar (desktop) — turquesa oscuro corporativo */}
      <aside className="hidden md:flex md:w-64 bg-teal-950 text-white flex-col">
        <div className="p-5 border-b border-teal-900/60">
          <div className="bg-white dark:bg-ink-900 rounded-lg p-2 inline-block">
            <Image src="/logo-payboom.png" alt="PayBoom" width={150} height={45} className="h-auto w-auto max-w-[140px]" />
          </div>
          <p className="mt-3 text-xs text-teal-200">Cotizador interno</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          <NavLink href="/dashboard" icon={<Home size={18} />}>Dashboard</NavLink>
          <NavLink href="/cotizaciones" icon={<FileText size={18} />}>Cotizaciones</NavLink>
          <NavLink href="/cotizaciones/nueva" icon={<Plus size={18} />}>Nueva cotización</NavLink>
          <NavLink href="/account/2fa" icon={<KeyRound size={18} />}>Mi 2FA</NavLink>

          {isAdmin && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-teal-300 mt-5 mb-1 px-3">Admin</div>
              <NavLink href="/admin/proveedores" icon={<Building2 size={18} />}>Proveedores</NavLink>
              <NavLink href="/admin/costos" icon={<Coins size={18} />}>Costos</NavLink>
              <NavLink href="/admin/paises" icon={<Globe size={18} />}>Países</NavLink>
              <NavLink href="/admin/monedas" icon={<Coins size={18} />}>Monedas</NavLink>
              <NavLink href="/admin/metodos-pago" icon={<Banknote size={18} />}>Métodos de pago</NavLink>
              <NavLink href="/admin/usuarios" icon={<Users size={18} />}>Usuarios</NavLink>
              <NavLink href="/admin/auditoria" icon={<Activity size={18} />}>Auditoría</NavLink>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-teal-900/60 space-y-2">
          <ThemeToggle />
          <div className="px-3 py-2 text-xs">
            <div className="font-semibold truncate">{profile?.full_name || profile?.email}</div>
            <div className="text-teal-300 flex items-center gap-1 mt-0.5">
              {isAdmin && <ShieldCheck size={12} />} {roleLabel(profile?.role)}
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="btn-ghost w-full text-teal-100 hover:bg-teal-900">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden bg-teal-950 text-white flex items-center justify-between px-4 py-3 sticky top-0 z-40">
        <div className="bg-white dark:bg-ink-900 rounded p-1.5">
          <Image src="/logo-payboom.png" alt="PayBoom" width={100} height={30} className="h-auto w-auto max-w-[100px]" />
        </div>
        <div className="flex items-center gap-1">
        <ThemeToggle compact />
        <details className="relative">
          <summary className="list-none cursor-pointer p-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-semibold">
              {(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}
            </div>
          </summary>
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl text-ink-900 dark:text-ink-50 w-56 overflow-hidden">
            <div className="px-3 py-2 text-xs border-b border-ink-100 dark:border-ink-800">
              <div className="font-semibold truncate">{profile?.full_name || profile?.email}</div>
              <div className="text-ink-500 dark:text-ink-400">{roleLabel(profile?.role)}</div>
            </div>
            <Link href="/dashboard" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Dashboard</Link>
            <Link href="/cotizaciones" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Cotizaciones</Link>
            <Link href="/cotizaciones/nueva" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Nueva cotización</Link>
            {isAdmin && <>
              <div className="border-t border-ink-100 dark:border-ink-800 mt-1" />
              <Link href="/admin/proveedores" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Proveedores</Link>
              <Link href="/admin/costos" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Costos</Link>
              <Link href="/admin/paises" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Países</Link>
              <Link href="/admin/monedas" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Monedas</Link>
              <Link href="/admin/usuarios" className="block px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-950">Usuarios</Link>
            </>}
            <form action={logout} className="border-t border-ink-100 dark:border-ink-800">
              <button type="submit" className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Cerrar sesión
              </button>
            </form>
          </div>
        </details>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-teal-100 hover:bg-teal-900 hover:text-white"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
