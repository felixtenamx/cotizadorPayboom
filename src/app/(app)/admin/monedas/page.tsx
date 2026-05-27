import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Trash2 } from "lucide-react";

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return supabase;
}

async function createCurrency(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const code = String(formData.get("code") || "").toUpperCase().trim();
  const name = String(formData.get("name") || "").trim();
  const symbol = String(formData.get("symbol") || "").trim();
  if (!code || !name || !symbol) return;
  await supabase.from("currencies").insert({ code, name, symbol });
  revalidatePath("/admin/monedas");
}

async function deleteCurrency(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const code = String(formData.get("code") || "");
  await supabase.from("currencies").delete().eq("code", code);
  revalidatePath("/admin/monedas");
}

export default async function MonedasPage() {
  const supabase = await ensureAdmin();
  const { data: currencies } = await supabase.from("currencies").select("*").order("code");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Monedas</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Las monedas que usaremos en cotizaciones.</p>
      </header>

      <form action={createCurrency} className="card-pad">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">Nueva moneda</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">Código</label>
            <input
              className="input uppercase font-mono"
              name="code"
              required
              maxLength={8}
              pattern="[A-Za-z0-9]{2,8}"
              title="2 a 8 caracteres (ISO 4217 o ticker de stablecoin)"
              placeholder="MXN, USDT, USDC…"
            />
            <p className="text-[10px] text-ink-400 mt-0.5">ISO 4217 (MXN, USD, EUR) o tickers de stablecoins (USDT, USDC, USDP, etc.).</p>
          </div>
          <div className="md:col-span-2">
            <label className="label">Nombre</label>
            <input className="input" name="name" required placeholder="Peso mexicano / Tether USD" />
          </div>
          <div>
            <label className="label">Símbolo</label>
            <input className="input" name="symbol" required maxLength={8} placeholder="$, €, ₮, USDT" />
          </div>
        </div>
        <div className="mt-3">
          <button type="submit" className="btn-primary">Agregar</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600 dark:text-ink-300 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Código</th>
              <th className="text-left px-4 py-2 font-medium">Nombre</th>
              <th className="text-left px-4 py-2 font-medium">Símbolo</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!currencies || currencies.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-ink-500 dark:text-ink-400">Sin monedas.</td></tr>
            ) : currencies.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-2.5">{c.name}</td>
                <td className="px-4 py-2.5">{c.symbol}</td>
                <td className="px-4 py-2.5">
                  <form action={deleteCurrency} className="flex justify-end">
                    <input type="hidden" name="code" value={c.code} />
                    <button type="submit" className="btn-ghost text-xs text-red-600 hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
