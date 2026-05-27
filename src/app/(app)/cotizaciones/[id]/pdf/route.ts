import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuotePdf, type QuoteLanguage } from "@/lib/pdf/generate-quote-pdf";
import fs from "node:fs/promises";
import path from "node:path";

// pdfkit usa fuentes embebidas y APIs de Node — ejecutar en runtime Node
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const langParam = req.nextUrl.searchParams.get("lang");
  const language: QuoteLanguage = langParam === "en" ? "en" : "es";

  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error || !quote) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [{ data: cardLines }, { data: altLines }, { data: intlLines }, { data: countries }, { data: currencies }] = await Promise.all([
    supabase.from("quote_card_processing").select("*").eq("quote_id", id),
    supabase.from("quote_alternative_payments").select("*").eq("quote_id", id),
    supabase.from("quote_international_payments").select("*").eq("quote_id", id),
    supabase.from("countries").select("*"),
    supabase.from("currencies").select("*"),
  ]);

  let logoBytes: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-payboom.png");
    logoBytes = await fs.readFile(logoPath);
  } catch {
    logoBytes = null;
  }

  const buffer = await buildQuotePdf({
    quote,
    cardLines: cardLines || [],
    altLines: altLines || [],
    intlLines: intlLines || [],
    countries: countries || [],
    currencies: currencies || [],
    logoBytes,
    language,
  });

  const safeCustomer = (quote.customer_name || "cliente").replace(/[^a-zA-Z0-9_-]/g, "_");
  const prefix = language === "en" ? "Proposal_PayBoom" : "Propuesta_PayBoom";
  const filename = `${prefix}_${safeCustomer}_${quote.quote_number}.pdf`;

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
