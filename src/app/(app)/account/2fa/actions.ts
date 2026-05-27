"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Inicia el enroll de un factor TOTP. Devuelve el id del factor y el secret/qr.
 * El usuario debe escanear el QR (o capturar el secret) en su app de autenticación
 * y luego enviar el código de 6 dígitos a `verifyEnrollment` para activarlo.
 */
export async function startEnrollment() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error) {
    redirect(`/account/2fa?error=${encodeURIComponent(error.message)}`);
  }
  return {
    factorId: data!.id,
    qr: data!.totp.qr_code,         // SVG dataURL para mostrar
    secret: data!.totp.secret,      // por si quieren copiarlo a mano
  };
}

/** Confirma el enroll con el código generado por la app. */
export async function verifyEnrollment(formData: FormData) {
  const supabase = await createClient();
  const factorId = String(formData.get("factor_id") || "");
  const code = String(formData.get("code") || "").trim();

  if (!factorId || !code) {
    redirect(`/account/2fa?error=${encodeURIComponent("Código requerido")}`);
  }
  const ch = await supabase.auth.mfa.challenge({ factorId });
  if (ch.error) redirect(`/account/2fa?error=${encodeURIComponent(ch.error.message)}`);
  const v = await supabase.auth.mfa.verify({
    factorId,
    challengeId: ch.data!.id,
    code,
  });
  if (v.error) redirect(`/account/2fa?error=${encodeURIComponent(v.error.message)}`);
  revalidatePath("/account/2fa");
  redirect("/account/2fa?enrolled=1");
}

/** Desactiva 2FA quitando el factor. */
export async function disable2FA(formData: FormData) {
  const supabase = await createClient();
  const factorId = String(formData.get("factor_id") || "");
  if (!factorId) return;
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) redirect(`/account/2fa?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/account/2fa");
  redirect("/account/2fa?disabled=1");
}
