import Image from "next/image";
import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const isSignup = sp.mode === "signup";

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-100 p-4 relative overflow-hidden">
      {/* Decorative blobs en colores de marca */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-teal-600/10 blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Image
            src="/logo-payboom.png"
            alt="PayBoom"
            width={260}
            height={78}
            priority
            className="mx-auto h-auto w-auto max-w-[240px]"
          />
          <p className="text-ink-500 dark:text-ink-400 text-sm mt-3">Cotizador interno</p>
        </div>

        <div className="card-pad shadow-xl">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50 mb-1">
            {isSignup ? "Crear cuenta" : "Iniciar sesión"}
          </h2>
          <p className="text-ink-500 dark:text-ink-400 text-xs mb-4">
            {isSignup ? "Regístrate para acceder al cotizador." : "Bienvenido de regreso."}
          </p>

          {sp.error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {sp.error}
            </div>
          )}
          {sp.info && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
              {sp.info}
            </div>
          )}

          <form action={isSignup ? signup : login} className="space-y-3">
            {isSignup && (
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" name="full_name" type="text" required placeholder="Tu nombre" />
              </div>
            )}
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" name="email" type="email" required placeholder="tucorreo@payboom.io" autoComplete="email" />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" name="password" type="password" required minLength={6} placeholder="••••••••" autoComplete={isSignup ? "new-password" : "current-password"} />
            </div>
            <button type="submit" className="btn-primary w-full">
              {isSignup ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-ink-500 dark:text-ink-400">
            {isSignup ? (
              <Link href="/login" className="text-teal-700 font-medium hover:underline">¿Ya tienes cuenta? Inicia sesión</Link>
            ) : (
              <Link href="/login?mode=signup" className="text-teal-700 font-medium hover:underline">¿No tienes cuenta? Regístrate</Link>
            )}
          </div>
        </div>

        <p className="text-center text-ink-400 text-xs mt-6">
          El primer usuario registrado se vuelve administrador automáticamente.
        </p>
      </div>
    </main>
  );
}
