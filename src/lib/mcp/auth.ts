/**
 * Auth para el MCP externo (Claude / Cowork).
 *
 * El cliente MCP presenta un `Authorization: Bearer <token>` que debe
 * coincidir exactamente con el env `MCP_API_TOKEN` del servidor.
 *
 * Todas las acciones se ejecutan bajo un usuario "default" (por defecto
 * comercial@payboom.io) para que las cotizaciones aparezcan atribuidas
 * a una cuenta real de Supabase. Configurable con MCP_DEFAULT_USER_EMAIL.
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type McpAuthOk = { ok: true; userId: string; email: string };
export type McpAuthErr = { ok: false; status: number; error: string };
export type McpAuthResult = McpAuthOk | McpAuthErr;

// Cache en memoria del user_id resuelto (evita ir a auth.admin cada request).
let cachedUser: { email: string; id: string } | null = null;

export async function verifyMcpRequest(req: NextRequest): Promise<McpAuthResult> {
  const expected = process.env.MCP_API_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "MCP no está configurado en el servidor (falta MCP_API_TOKEN)",
    };
  }

  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "Falta Authorization: Bearer <token>" };
  }
  const token = match[1].trim();

  // Comparación tiempo-constante para evitar timing attacks.
  if (!timingSafeEqual(token, expected)) {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  const email = (process.env.MCP_DEFAULT_USER_EMAIL || "comercial@payboom.io").toLowerCase();

  if (cachedUser?.email === email) {
    return { ok: true, userId: cachedUser.id, email };
  }

  // Resolver user_id en Supabase Auth (paginado por si hay muchos usuarios).
  const admin = createAdminClient();
  let userId: string | null = null;
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { ok: false, status: 500, error: `Error consultando Supabase Auth: ${error.message}` };
    }
    const found = data.users.find((u: { email?: string | null }) => (u.email || "").toLowerCase() === email);
    if (found) {
      userId = found.id;
      break;
    }
    if (data.users.length < perPage) break; // última página
    page++;
    if (page > 20) break; // safety net
  }

  if (!userId) {
    return {
      ok: false,
      status: 500,
      error: `No encontré el usuario ${email} en Supabase Auth. Créalo primero o cambia MCP_DEFAULT_USER_EMAIL.`,
    };
  }

  cachedUser = { email, id: userId };
  return { ok: true, userId, email };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
