import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Activity, Search, X } from "lucide-react";
import Link from "next/link";

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return supabase;
}

const ACTION_LABEL: Record<string, string> = {
  created: "Creó",
  updated: "Editó",
  duplicated: "Duplicó",
  deleted: "Eliminó",
  status_changed: "Cambió status",
  approved: "Aprobó",
  rejected: "Rechazó",
  sent: "Envió",
  login: "Inició sesión",
};

const ACTION_COLOR: Record<string, string> = {
  created: "chip-teal",
  updated: "chip-amber",
  duplicated: "chip-brand",
  deleted: "chip-red",
  status_changed: "chip-ink",
  approved: "chip-green",
  rejected: "chip-red",
  sent: "chip-brand",
  login: "chip-ink",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; from?: string; to?: string }>;
}) {
  const supabase = await ensureAdmin();
  const sp = await searchParams;

  let query = supabase
    .from("activity_log")
    .select("*, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    query = query.or(`entity_label.ilike.%${q}%,actor_email.ilike.%${q}%`);
  }
  if (sp.action && sp.action !== "all") query = query.eq("action", sp.action as any);
  if (sp.from) query = query.gte("created_at", sp.from);
  if (sp.to) query = query.lte("created_at", new Date(sp.to + "T23:59:59").toISOString());

  const { data: rows } = await query;
  const hasFilters = !!(sp.q?.trim() || (sp.action && sp.action !== "all") || sp.from || sp.to);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50 flex items-center gap-2">
          <Activity size={22} className="text-teal-600 dark:text-teal-400" /> Auditoría
        </h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">
          Histórico de quién hizo qué y cuándo. Últimos 500 eventos.
        </p>
      </header>

      <form className="card-pad space-y-3" method="GET">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="label">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input name="q" defaultValue={sp.q || ""} className="input pl-9" placeholder="Cotización, cliente o email…" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Acción</label>
            <select name="action" defaultValue={sp.action || "all"} className="input">
              <option value="all">Todas</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Desde</label>
            <input type="date" name="from" defaultValue={sp.from || ""} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Hasta</label>
            <input type="date" name="to" defaultValue={sp.to || ""} className="input" />
          </div>
          <div className="md:col-span-1 flex md:items-end">
            <button type="submit" className="btn-primary w-full">Filtrar</button>
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500 dark:text-ink-400">{rows?.length || 0} evento(s)</span>
            <Link href="/admin/auditoria" className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1">
              <X size={12} /> Limpiar
            </Link>
          </div>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-ink-50 dark:bg-ink-950 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Fecha / Hora</th>
              <th className="text-left px-3 py-2 font-medium">Usuario</th>
              <th className="text-left px-3 py-2 font-medium">Acción</th>
              <th className="text-left px-3 py-2 font-medium">Entidad</th>
              <th className="text-left px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!rows || rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-ink-500 dark:text-ink-400">
                Sin actividad registrada.
              </td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-3 py-2.5 text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{r.actor?.full_name || "—"}</div>
                  <div className="text-xs text-ink-500 dark:text-ink-400">{r.actor_email || r.actor?.email || "sistema"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={ACTION_COLOR[r.action] || "chip-ink"}>
                    {ACTION_LABEL[r.action] || r.action}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-xs text-ink-500 dark:text-ink-400">{r.entity_type}</div>
                  {r.entity_id && r.entity_type === "quote" && r.action !== "deleted" ? (
                    <Link href={`/cotizaciones/${r.entity_id}`} className="text-teal-700 dark:text-teal-300 hover:underline">
                      {r.entity_label || r.entity_id}
                    </Link>
                  ) : (
                    <span>{r.entity_label || "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-600 dark:text-ink-400">
                  {r.details && Object.keys(r.details).length > 0 ? (
                    <code className="text-[10px] bg-ink-50 dark:bg-ink-950 px-1.5 py-0.5 rounded">
                      {Object.entries(r.details).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}
                    </code>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
