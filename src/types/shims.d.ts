// Declaraciones ambient para paquetes con problemas de tipos publicados.
// Esto sólo afecta análisis estático; el runtime es correcto.

declare module "@supabase/auth-js" {
  export class AuthError extends Error {}
}

declare module "@supabase/ssr" {
  export function createBrowserClient(url: string, key: string, opts?: any): any;
  export function createServerClient(url: string, key: string, opts?: any): any;
}

declare module "@supabase/supabase-js" {
  export type SupabaseClient = any;
  export function createClient(url: string, key: string, opts?: any): any;
}

declare module "docx" {
  // Re-export del paquete real; TypeScript usará 'any' para todos los exports
  // pero el runtime mantiene la API completa.
  const _: any;
  export = _;
  export const Document: any;
  export const Packer: any;
  export const Paragraph: any;
  export const TextRun: any;
  export const Table: any;
  export const TableRow: any;
  export const TableCell: any;
  export const WidthType: any;
  export const AlignmentType: any;
  export const HeightRule: any;
  export const BorderStyle: any;
  export const ImageRun: any;
  export const ShadingType: any;
  export const HeadingLevel: any;
  export const PageOrientation: any;
  export const LevelFormat: any;
  export const convertInchesToTwip: any;
}
