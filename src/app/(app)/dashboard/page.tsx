import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FileText, Plus, ArrowRight, ShieldCheck } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_number, customer_name, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const { count: totalQuotes } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true });

  const { count: providersCount } = await supabase
    .from("providers")
    .select("*", { count: "exact", head: true });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-ink-900 dark:text-ink-50">
          Hola, {profile?.full_name?.split(" ")[0] || "PayBoom"} 👋
        </h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Bienvenido al cotizador interno.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Cotizaciones" value={totalQuotes ?? 0} />
        <Stat label="Proveedores" value={providersCount ?? 0} />
        <Stat label="Tu rol" value={profile?.role === "admin" ? "Admin" : "Cotizador"} icon={profile?.role === "admin" ? <ShieldCheck size={16} className="text-brand-600" /> : null} />
        <Stat label="Año" value={new Date().getFullYear()} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/cotizaciones/nueva" className="card-pad hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <div className="bg-brand-50 text-brand-600 rounded-lg p-2"><Plus size={20} /></div>
            <ArrowRight size={16} className="text-ink-300 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="mt-3 font-semibold text-ink-900 dark:text-ink-50">Nueva cotización</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Crea una propuesta comercial para un cliente.</p>
        </Link>

        <Link href="/cotizaciones" className="card-pad hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <div className="bg-teal-50 text-teal-700 rounded-lg p-2"><FileText size={20} /></div>
            <ArrowRight size={16} className="text-ink-300 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="mt-3 font-semibold text-ink-900 dark:text-ink-50">Ver cotizaciones</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Consulta y descarga propuestas existentes.</p>
        </Link>

        {profile?.role === "admin" && (
          <Link href="/admin/costos" className="card-pad hover:shadow-md transition group">
            <div className="flex items-center justify-between">
              <div className="bg-amber-50 text-amber-700 rounded-lg p-2"><ShieldCheck size={20} /></div>
              <ArrowRight size={16} className="text-ink-300 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
            </div>
            <h3 className="mt-3 font-semibold text-ink-900 dark:text-ink-50">Administrar costos</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Actualiza costos por proveedor y servicio.</p>
          </Link>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink-900 dark:text-ink-50">Cotizaciones recientes</h2>
          <Link href="/cotizaciones" className="text-sm text-brand-600 hover:underline">Ver todas</Link>
        </div>
        {!quotes || quotes.length === 0 ? (
          <div className="card-pad text-center text-ink-500 dark:text-ink-400 text-sm">
            Aún no hay cotizaciones. <Link href="/cotizaciones/nueva" className="text-brand-600 hover:underline">Crea la primera →</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Cotización</th>
                  <th className="text-left px-4 py-2 font-medium">Cliente</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th className="text-right px-4 py-2 font-medium">Actualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-ink-50 dark:hover:bg-ink-950">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/cotizaciones/${q.id}`} className="text-brand-700 hover:underline">{q.quote_number}</Link>
                    </td>
                    <td className="px-4 py-2.5">{q.customer_name}</td>
                    <td className="px-4 py-2.5"><StatusChip status={q.status} /></td>
                    <td className="px-4 py-2.5 text-right text-ink-500 dark:text-ink-400">
                      {new Date(q.updated_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="card-pad">
      <div className="text-xs text-ink-500 dark:text-ink-400 flex items-center gap-1">{icon} {label}</div>
      <div className="text-2xl font-bold text-ink-900 dark:text-ink-50 mt-1">{value}</div>
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
