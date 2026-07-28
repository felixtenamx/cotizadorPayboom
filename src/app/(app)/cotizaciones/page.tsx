import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Search, X } from "lucide-react";

type Filters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  company?: string;
};

export default async function CotizacionesListPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Lista global de empresas (para el dropdown, no depende de los filtros aplicados).
  const { data: allCompanies } = await supabase
    .from("quotes")
    .select("customer_company")
    .not("customer_company", "is", null)
    .neq("customer_company", "");
  const companyOptions = Array.from(
    new Set(
      (allCompanies || [])
        .map((r: any) => (r.customer_company || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));

  let query = supabase
    .from("quotes")
    .select("id, quote_number, customer_name, customer_company, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  // Filtro: texto libre (cliente, empresa o número de cotización)
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    query = query.or(
      `quote_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_company.ilike.%${q}%`
    );
  }
  // Filtro: status
  if (sp.status && sp.status !== "all") {
    query = query.eq("status", sp.status as any);
  }
  // Filtro: empresa (match exacto)
  if (sp.company && sp.company !== "all") {
    query = query.eq("customer_company", sp.company);
  }
  // Filtro: rango de fechas (inclusivo)
  if (sp.from) {
    query = query.gte("created_at", sp.from);
  }
  if (sp.to) {
    // Sumamos 1 día al "to" para hacer el rango inclusivo del día completo
    const toEnd = new Date(sp.to + "T23:59:59").toISOString();
    query = query.lte("created_at", toEnd);
  }

  const { data: quotes } = await query;
  const hasFilters = !!(
    sp.q?.trim() ||
    (sp.status && sp.status !== "all") ||
    (sp.company && sp.company !== "all") ||
    sp.from ||
    sp.to
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Cotizaciones</h1>
          <p className="text-ink-500 text-sm mt-1">Tus propuestas comerciales.</p>
        </div>
        <Link href="/cotizaciones/nueva" className="btn-primary"><Plus size={16} /> Nueva cotización</Link>
      </header>

      {/* Barra de filtros (form GET) */}
      <form className="card-pad space-y-3" method="GET">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="label">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                name="q"
                defaultValue={sp.q || ""}
                className="input pl-9"
                placeholder="Número, cliente o empresa…"
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="label">Empresa (cliente)</label>
            <select name="company" defaultValue={sp.company || "all"} className="input">
              <option value="all">Todas las empresas</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Estado</label>
            <select name="status" defaultValue={sp.status || "all"} className="input">
              <option value="all">Todos</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="label">Desde</label>
            <input type="date" name="from" defaultValue={sp.from || ""} className="input" />
          </div>
          <div className="md:col-span-1">
            <label className="label">Hasta</label>
            <input type="date" name="to" defaultValue={sp.to || ""} className="input" />
          </div>
          <div className="md:col-span-1 flex gap-2 md:items-end">
            <button type="submit" className="btn-primary w-full">Filtrar</button>
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500">{quotes?.length || 0} resultado(s)</span>
            <Link href="/cotizaciones" className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1">
              <X size={12} /> Limpiar filtros
            </Link>
          </div>
        )}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 dark:bg-ink-950 text-ink-600 dark:text-ink-400 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">No.</th>
              <th className="text-left px-4 py-2 font-medium">Cliente</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Empresa</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-right px-4 py-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!quotes || quotes.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-ink-500">
                {hasFilters
                  ? <>Sin resultados con esos filtros. <Link href="/cotizaciones" className="text-teal-600 dark:text-teal-400 hover:underline">Limpiar</Link></>
                  : <>Aún no hay cotizaciones. <Link href="/cotizaciones/nueva" className="text-teal-600 dark:text-teal-400 hover:underline">Crear la primera →</Link></>}
              </td></tr>
            ) : quotes.map((q) => (
              <tr key={q.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                <td className="px-4 py-2.5 font-mono font-medium">
                  <Link href={`/cotizaciones/${q.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">{q.quote_number}</Link>
                </td>
                <td className="px-4 py-2.5">{q.customer_name}</td>
                <td className="px-4 py-2.5 text-ink-600 dark:text-ink-400 hidden md:table-cell">{q.customer_company || "—"}</td>
                <td className="px-4 py-2.5"><StatusChip status={q.status} /></td>
                <td className="px-4 py-2.5 text-right text-ink-500 text-xs">
                  {new Date(q.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "chip-ink",
    sent: "chip-brand",
    approved: "chip-green",
    rejected: "chip-red",
  };
  const labels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    approved: "Aprobada",
    rejected: "Rechazada",
  };
  return <span className={map[status] || "chip-ink"}>{labels[status] || status}</span>;
}
