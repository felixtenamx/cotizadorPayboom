import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Image from "next/image";
import { logout } from "@/app/login/actions";
import { ShieldCheck, AlertCircle } from "lucide-react";

async function verifyMfa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const code = String(formData.get("code") || "").trim();
  if (!code) redirect("/login/mfa?error=" + encodeURIComponent("Código requerido"));

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = (factors?.totp || []).find((f: any) => f.status === "verified");
  if (!factor) redirect("/dashboard");

  const ch = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (ch.error) redirect("/login/mfa?error=" + encodeURIComponent(ch.error.message));

  const v = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: ch.data!.id,
    code,
  });
  if (v.error) redirect("/login/mfa?error=" + encodeURIComponent(v.error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export default async function MfaChallengePage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;

  // Si ya está en aal2, mandarlo a dashboard
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data?.currentLevel === "aal2" || aal.data?.nextLevel === "aal1") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-100 dark:bg-ink-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Image src="/logo-payboom.png" alt="PayBoom" width={200} height={60} className="mx-auto h-auto w-auto max-w-[200px]" />
        </div>
        <div className="card-pad shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-teal-600 dark:text-teal-400" />
            <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Verificación de dos factores</h2>
          </div>
          <p className="text-ink-500 dark:text-ink-400 text-sm mb-4">
            Introduce el código de 6 dígitos que muestra tu app de autenticación.
          </p>

          {sp.error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{sp.error}</span>
            </div>
          )}

          <form action={verifyMfa} className="space-y-3">
            <input
              name="code"
              className="input font-mono text-center text-xl tracking-widest"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
            <button type="submit" className="btn-primary w-full">Verificar</button>
          </form>

          <form action={logout} className="mt-3">
            <button type="submit" className="text-xs text-ink-500 dark:text-ink-400 hover:underline w-full text-center">
              Cancelar y volver al login
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
