import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "created" | "updated" | "duplicated" | "deleted"
  | "status_changed" | "approved" | "rejected" | "sent"
  | "login";

export type AuditEntityType =
  | "quote" | "provider" | "cost" | "country" | "currency" | "payment_method" | "user";

type Args = {
  entity_type: AuditEntityType;
  entity_id?: string | null;
  entity_label?: string | null;
  action: AuditAction;
  details?: Record<string, any> | null;
};

/**
 * Inserta un registro en activity_log. Si falla, sólo loggea — nunca debe romper la acción principal.
 * Lee el usuario del cookie de sesión para identificar al actor.
 */
export async function logActivity(args: Args) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_log").insert({
      actor_id: user?.id || null,
      actor_email: user?.email || null,
      entity_type: args.entity_type,
      entity_id: args.entity_id || null,
      entity_label: args.entity_label || null,
      action: args.action,
      details: args.details || null,
    });
  } catch (e) {
    console.error("[audit] insert failed:", e);
  }
}
