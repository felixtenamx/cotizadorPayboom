import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuoteDocx, type QuoteLanguage } from "@/lib/docx/generate-quote";
import fs from "node:fs/promises";
import path from "node:path";

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

  let logoBytes: ArrayBuffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-payboom.png");
    const buf = await fs.readFile(logoPath);
    logoBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    logoBytes = null;
  }

  const buffer = await buildQuoteDocx({
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
  const filename = `${prefix}_${safeCustomer}_${quote.quote_number}.docx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
