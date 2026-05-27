import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { startEnrollment, verifyEnrollment, disable2FA } from "./actions";
import { ShieldCheck, AlertCircle, Smartphone } from "lucide-react";

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enrolled?: string; disabled?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  // Listar factores actuales del usuario
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp || []).filter((f: any) => f.status === "verified");
  const isEnrolled = verified.length > 0;

  // Si NO está enrollado, iniciar nuevo enroll para mostrar QR
  let enroll: any = null;
  if (!isEnrolled) {
    // Eliminar factores pendientes (unverified) huérfanos antes de crear uno nuevo
    const pendings = (factors?.totp || []).filter((f: any) => f.status === "unverified");
    for (const p of pendings) {
      try { await supabase.auth.mfa.unenroll({ factorId: p.id }); } catch {}
    }
    try { enroll = await startEnrollment(); } catch {}
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50 flex items-center gap-2">
          <ShieldCheck size={22} className="text-teal-600 dark:text-teal-400" /> Autenticación de dos factores (2FA)
        </h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">
          Añade una capa extra de seguridad usando una app de autenticación (Google Authenticator, 1Password, Authy, etc.).
        </p>
      </header>

      {sp.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{sp.error}</span>
        </div>
      )}
      {sp.enrolled && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          ✓ 2FA activado. La próxima vez que inicies sesión te pediremos el código.
        </div>
      )}
      {sp.disabled && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2">
          2FA desactivado. Considera reactivarlo, sobre todo si tienes rol de administrador.
        </div>
      )}

      {isEnrolled ? (
        // ============ YA ENROLLADO ============
        <section className="card-pad">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-lg p-2">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-ink-900 dark:text-ink-50">2FA está activo</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                Cuando inicies sesión, te pediremos un código de 6 dígitos de tu app de autenticación.
              </p>
              <div className="mt-4">
                <form action={disable2FA}>
                  <input type="hidden" name="factor_id" value={verified[0].id} />
                  <button type="submit" className="btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    Desactivar 2FA
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      ) : (
        // ============ ENROLLMENT ============
        <section className="card-pad space-y-5">
          <div className="flex items-start gap-3">
            <div className="bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 rounded-lg p-2">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-ink-900 dark:text-ink-50">Configurar 2FA</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Sigue estos tres pasos:</p>
            </div>
          </div>

          {enroll ? (
            <>
              <ol className="space-y-4 list-decimal list-inside text-sm">
                <li className="text-ink-800 dark:text-ink-200">
                  <strong>Instala</strong> una app de autenticación en tu teléfono si no la tienes (Google Authenticator, 1Password, Authy, Microsoft Authenticator).
                </li>
                <li className="text-ink-800 dark:text-ink-200">
                  <strong>Escanea el QR</strong> con la app:
                  <div className="mt-3 inline-block bg-white p-4 rounded-lg border border-ink-200 dark:border-ink-700">
                    {/* El QR viene como SVG dataURL */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={enroll.qr} alt="QR para 2FA" width={200} height={200} />
                  </div>
                  <div className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                    ¿No puedes escanear? Captura este código manualmente en tu app:
                    <code className="block mt-1 bg-ink-50 dark:bg-ink-950 px-2 py-1 rounded font-mono text-[11px] break-all">
                      {enroll.secret}
                    </code>
                  </div>
                </li>
                <li className="text-ink-800 dark:text-ink-200">
                  <strong>Introduce el código de 6 dígitos</strong> que muestra tu app para confirmar:
                  <form action={verifyEnrollment} className="mt-3 flex flex-wrap gap-2 items-end max-w-sm">
                    <input type="hidden" name="factor_id" value={enroll.factorId} />
                    <div className="flex-1">
                      <input
                        name="code"
                        className="input font-mono text-center text-lg tracking-widest"
                        required
                        maxLength={6}
                        pattern="[0-9]{6}"
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                    </div>
                    <button type="submit" className="btn-primary">Activar 2FA</button>
                  </form>
                </li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No fue posible inicializar el enrollment. Refresca la página o contacta al admin.
            </p>
          )}
        </section>
      )}

      <div className="text-xs text-ink-500 dark:text-ink-400">
        Sugerencia: los administradores deberían tener 2FA activo siempre, porque pueden modificar costos y aprobar cotizaciones.
      </div>
    </div>
  );
}
