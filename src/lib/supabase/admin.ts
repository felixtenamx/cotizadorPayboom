import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con permisos de servicio (bypass RLS, acceso a auth.admin.*).
 * Sólo usar en server actions/route handlers, NUNCA enviar al cliente.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local.
 * Lo encuentras en Supabase Dashboard → Project Settings → API → service_role key.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurado. Ve a Supabase Dashboard → Project Settings → API y copia el service_role key a tu .env.local."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
