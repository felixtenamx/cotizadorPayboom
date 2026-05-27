import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calcula margen: (Precio - Costo) / Precio * 100 */
export function margin(price: number | null | undefined, cost: number | null | undefined): number | null {
  if (price == null || cost == null || price === 0) return null;
  return ((price - cost) / price) * 100;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatMoney(value: number | null | undefined, currency = "USD", digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} ${currency}`;
}

export function nfmt(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toFixed(digits);
}

export const PRESET_SETTLEMENT_TIMES = ["T+0", "T+1", "T+2", "T+3", "T+5", "T+7", "Same day", "Next day", "7/7", "Weekly", "D+1", "D+2"];

/** Etiqueta amigable para rol — los "cotizadores" se llaman "Boomers" en la UI. */
export function roleLabel(role: string | null | undefined): string {
  if (role === "admin") return "Administrador";
  if (role === "cotizador" || role === "boomer") return "Boomer";
  return role || "—";
}
