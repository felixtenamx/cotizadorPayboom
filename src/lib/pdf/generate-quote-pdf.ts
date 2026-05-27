import PDFDocument from "pdfkit";
import type {
  Quote, QuoteCardProcessing, QuoteAlternativePayment, QuoteInternationalPayment,
  Country, Currency,
} from "@/types/database";

export type QuoteLanguage = "es" | "en";

// Paleta oficial PayBoom (en hex sin #)
const BRAND = "#F35514";       // Naranja PAY
const BRAND_DARK = "#009FA2";  // Turquesa BOOM
const BRAND_LIGHT = "#EFFDFD"; // Fondo etiqueta
const INK = "#22252C";
const INK_LIGHT = "#67748B";
const LINE = "#D5DAE2";

const T = {
  es: {
    proposalTitle: "Propuesta Comercial",
    quoteAndDate: (n: string, d: string) => `Cotización ${n} · ${d}`,
    cardSection: "Adquirencia Local — Pagos con Tarjetas",
    cardNoteTax: "*A nuestros precios se les debe sumar el impuesto local aplicable.",
    cardNoteFraud: "* En caso de alta actividad fraudulenta, la comisión podrá incrementarse previa notificación por escrito.",
    altSection: "Métodos de Pago Alternativos (APM)",
    intlSection: "Pagos Internacionales",
    intlSubtitle: "Servicios de Pay-In y Pay-Out internacionales por país.",
    settlementSection: "Liquidaciones y Plataforma",
    notesSection: "Notas adicionales",
    closing: "Tu experto en pagos,",
    cardHeaders: ["Método", "Variable", "Fijo", "Refund", "Contracargo", "Liquidación"],
    altHeaders: ["País", "Método", "Variable", "Fijo", "Dispersión", "Liquidación"],
    intlHeaders: ["País", "Servicio", "Variable", "Fijo", "Moneda"],
    localAcquiring: "Adquirencia Local",
    debit: "Débito", credit: "Crédito", international: "Internacional", amex: "AMEX",
    payIn: "Pay-In", payOut: "Pay-Out",
    settlementCurrency: "Moneda de liquidación",
    minBilling: "Mínimo mensual de facturación",
    fee3ds: "Cobro de 3DS (por transacción)",
    monthlyFee: "Cuota mensual de plataforma",
    annualFee: "Cuota anual de plataforma",
    rollingReserve: "Reserva revolvente (Rolling Reserve)",
    rollingReserveValue: (pct: number) => `${pct}% de cada transacción`,
    rollingReserveHoldLabel: "Periodo de retención",
    rollingReserveHoldValue: (days: number) => `${days} días`,
    extraFeesSection: "Cargos adicionales",
    extraFeesHeaders: ["Concepto", "Frecuencia", "Monto"],
    freq: { one_time: "Pago único", monthly: "Mensual", annual: "Anual", per_transaction: "Por transacción" } as Record<string, string>,
    confidentialityFooter:
      "El contenido de esta página es confidencial y no puede ser divulgado a terceros sin la autorización por escrito de PayBoom. La información sobre tarifas aquí presentada se proporciona exclusivamente al destinatario aquí especificado. Este es un resumen no vinculante que describe métodos de pago y tarifas, y no tiene la intención de constituir un compromiso vinculante o exigible. Pueden aplicarse tarifas y cargos adicionales. Para consultar el cuadro completo de Tarifas y Cargos aplicables, remítase al Contrato del Merchant, cuya celebración está sujeta a diversas condiciones, según se describe con mayor detalle en dicho contrato.",
    months: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
    na: "N/A",
  },
  en: {
    proposalTitle: "Commercial Proposal",
    quoteAndDate: (n: string, d: string) => `Quote ${n} · ${d}`,
    cardSection: "Local Acquiring — Card Payments",
    cardNoteTax: "*Local taxes apply on top of our prices.",
    cardNoteFraud: "* In case of high fraudulent activity, the fee may be increased upon prior written notice.",
    altSection: "Alternative Payment Methods (APM)",
    intlSection: "International Payments",
    intlSubtitle: "International Pay-In and Pay-Out services per country.",
    settlementSection: "Settlement and Platform",
    notesSection: "Additional notes",
    closing: "Your payments expert,",
    cardHeaders: ["Method", "Variable", "Fixed", "Refund", "Chargeback", "Settlement"],
    altHeaders: ["Country", "Method", "Variable", "Fixed", "Dispersion", "Settlement"],
    intlHeaders: ["Country", "Service", "Variable", "Fixed", "Currency"],
    localAcquiring: "Local Acquiring",
    debit: "Debit", credit: "Credit", international: "International", amex: "AMEX",
    payIn: "Pay-In", payOut: "Pay-Out",
    settlementCurrency: "Settlement currency",
    minBilling: "Monthly minimum billing",
    fee3ds: "3DS fee (per transaction)",
    monthlyFee: "Monthly platform fee",
    annualFee: "Annual platform fee",
    rollingReserve: "Rolling Reserve",
    rollingReserveValue: (pct: number) => `${pct}% of each transaction`,
    rollingReserveHoldLabel: "Hold period",
    rollingReserveHoldValue: (days: number) => `${days} days`,
    extraFeesSection: "Additional Fees",
    extraFeesHeaders: ["Item", "Frequency", "Amount"],
    freq: { one_time: "One-time", monthly: "Monthly", annual: "Annual", per_transaction: "Per transaction" } as Record<string, string>,
    confidentialityFooter:
      "The content of this page is confidential and may not be disclosed to third parties without PayBoom's written authorization. The pricing information presented herein is provided exclusively to the recipient specified above. This is a non-binding summary describing payment methods and fees, and is not intended to constitute a binding or enforceable commitment. Additional fees and charges may apply. For the complete schedule of applicable Fees and Charges, please refer to the Merchant Agreement, the execution of which is subject to various conditions, as further described in such agreement.",
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    na: "N/A",
  },
};

type Inputs = {
  quote: Quote;
  cardLines: QuoteCardProcessing[];
  altLines: QuoteAlternativePayment[];
  intlLines: QuoteInternationalPayment[];
  countries: Country[];
  currencies: Currency[];
  logoBytes?: Buffer | null;
  language?: QuoteLanguage;
};

const fmtPct = (n: number | null | undefined, na: string) => (n == null ? na : `${Number(n)}%`);
const fmtMoney = (n: number | null | undefined, ccy: string, na: string) =>
  n == null ? na : `${Number(n).toFixed(2)} ${ccy}`;
const countryName = (code: string, countries: Country[]) => countries.find((c) => c.code === code)?.name || code;
const formatDate = (iso: string, t: typeof T.es) => {
  const d = new Date(iso);
  return t.months ? `${d.getDate()} ${t === T.es ? "de " : ""}${t.months[d.getMonth()]}${t === T.es ? " de " : ", "}${d.getFullYear()}` : d.toLocaleDateString();
};

export async function buildQuotePdf(input: Inputs): Promise<Buffer> {
  const { quote, cardLines, altLines, intlLines, countries, logoBytes, language } = input;
  const t = T[language || "es"];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 100, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `${t.proposalTitle} - ${quote.customer_name}`,
        Author: "PayBoom",
        Subject: `Quote ${quote.quote_number}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ============== HEADER ==============
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    if (logoBytes) {
      doc.image(logoBytes, doc.page.margins.left + pageWidth / 2 - 90, 50, { width: 180 });
      doc.y = 120;
    } else {
      doc.fontSize(28).fillColor(BRAND).text("PAY", doc.page.margins.left, 50, { continued: true });
      doc.fillColor(BRAND_DARK).text("BOOM");
      doc.moveDown(0.5);
    }

    // Título
    doc.moveDown(0.5);
    doc.fontSize(22).fillColor(BRAND).font("Helvetica-Bold").text(t.proposalTitle, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor(BRAND).font("Helvetica-Bold").text(quote.customer_name, { align: "center" });
    if (quote.customer_company) {
      doc.fontSize(11).fillColor(INK).font("Helvetica").text(quote.customer_company, { align: "center" });
    }
    doc.fontSize(9).fillColor(INK_LIGHT).font("Helvetica-Oblique")
      .text(t.quoteAndDate(quote.quote_number, formatDate(quote.created_at, t)), { align: "center" });
    doc.moveDown(1);

    // ============== CARD PROCESSING ==============
    if (quote.includes_card_processing && cardLines.length > 0) {
      sectionTitle(doc, t.cardSection);
      smallNote(doc, t.cardNoteTax);
      const rows = cardLines.map((l) => ([
        `${t.localAcquiring} — ${countryName(l.country_code, countries)} ${cardLabel(l.card_type, t)}`,
        l.has_variable ? fmtPct(l.price_variable, t.na) : t.na,
        l.has_fixed ? fmtMoney(l.price_fixed, l.currency_code, t.na) : t.na,
        l.has_refund ? fmtMoney(l.price_refund, l.currency_code, t.na) : t.na,
        l.has_chargeback ? fmtMoney(l.price_chargeback, l.currency_code, t.na) : t.na,
        l.settlement_time || "—",
      ]));
      drawTable(doc, t.cardHeaders, rows, [38, 12, 12, 14, 12, 12]);
      smallNote(doc, t.cardNoteFraud);
      doc.moveDown(0.5);
    }

    // ============== ALT PAYMENTS ==============
    if (quote.includes_alternative_payments && altLines.length > 0) {
      sectionTitle(doc, t.altSection);
      smallNote(doc, t.cardNoteTax);
      const rows = altLines.map((l) => ([
        countryName(l.country_code, countries),
        l.method,
        l.has_variable ? fmtPct(l.price_variable, t.na) : t.na,
        l.has_fixed ? fmtMoney(l.price_fixed, l.currency_code, t.na) : t.na,
        l.has_dispersion ? fmtMoney(l.price_dispersion, l.currency_code, t.na) : t.na,
        l.settlement_time || "—",
      ]));
      drawTable(doc, t.altHeaders, rows, [18, 18, 14, 18, 18, 14]);
      doc.moveDown(0.5);
    }

    // ============== INTL PAYMENTS ==============
    if (quote.includes_international_payments && intlLines.length > 0) {
      sectionTitle(doc, t.intlSection);
      smallNote(doc, t.intlSubtitle);
      const rows: string[][] = [];
      for (const l of intlLines) {
        if (l.has_payin) rows.push([
          countryName(l.country_code, countries), t.payIn,
          fmtPct(l.payin_price_variable, t.na),
          fmtMoney(l.payin_price_fixed, l.currency_code, t.na),
          l.currency_code,
        ]);
        if (l.has_payout) rows.push([
          countryName(l.country_code, countries), t.payOut,
          fmtPct(l.payout_price_variable, t.na),
          fmtMoney(l.payout_price_fixed, l.currency_code, t.na),
          l.currency_code,
        ]);
      }
      drawTable(doc, t.intlHeaders, rows, [22, 18, 20, 22, 18]);
      doc.moveDown(0.5);
    }

    // ============== SETTLEMENT ==============
    sectionTitle(doc, t.settlementSection);
    const settlementRows: [string, string][] = [];
    if (quote.settlement_currency) settlementRows.push([t.settlementCurrency, quote.settlement_currency]);
    if (quote.minimum_monthly_billing != null) settlementRows.push([t.minBilling, `${quote.minimum_monthly_billing.toLocaleString()} ${quote.settlement_currency || ""}`]);
    if (quote.charges_3ds && quote.price_3ds != null) settlementRows.push([t.fee3ds, fmtMoney(quote.price_3ds, quote.settlement_currency || "USD", t.na)]);
    if (quote.has_monthly_fee && quote.monthly_fee != null) settlementRows.push([t.monthlyFee, fmtMoney(quote.monthly_fee, quote.settlement_currency || "USD", t.na)]);
    if (quote.has_annual_fee && quote.annual_fee != null) settlementRows.push([t.annualFee, fmtMoney(quote.annual_fee, quote.settlement_currency || "USD", t.na)]);
    if (quote.has_rolling_reserve && quote.rolling_reserve_pct != null) {
      settlementRows.push([t.rollingReserve, t.rollingReserveValue(Number(quote.rolling_reserve_pct))]);
    }
    if (quote.has_rolling_reserve && quote.rolling_reserve_release_days != null) {
      settlementRows.push([t.rollingReserveHoldLabel, t.rollingReserveHoldValue(Number(quote.rolling_reserve_release_days))]);
    }
    drawKVTable(doc, settlementRows);
    doc.moveDown(0.5);

    // ============== EXTRA FEES ==============
    const extras: any[] = (quote as any).extra_fees || [];
    if (Array.isArray(extras) && extras.length > 0) {
      sectionTitle(doc, t.extraFeesSection);
      const rows = extras.map((f) => [
        f.title || "—",
        t.freq[f.frequency] || f.frequency,
        `${Number(f.amount).toFixed(2)} ${f.currency || ""}`,
      ]);
      drawTable(doc, t.extraFeesHeaders, rows, [50, 25, 25]);
      doc.moveDown(0.5);
    }

    // ============== NOTES ==============
    if (quote.notes) {
      sectionTitle(doc, t.notesSection);
      doc.fontSize(10).fillColor(INK).font("Helvetica").text(quote.notes, { align: "left" });
      doc.moveDown(0.5);
    }

    // ============== CLOSING ==============
    doc.moveDown(2);
    doc.fontSize(10).fillColor(INK_LIGHT).font("Helvetica-Oblique").text(t.closing, { align: "right" });
    doc.fontSize(13).fillColor(BRAND).font("Helvetica-Bold").text("PayBoom", { align: "right" });

    // ============== FOOTER en cada página (confidencialidad) ==============
    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 90;
      doc.fontSize(7).fillColor(INK_LIGHT).font("Helvetica-Oblique")
        .text(t.confidentialityFooter,
          doc.page.margins.left,
          footerY,
          { width: pageWidth, align: "justify" });
    }

    doc.end();
  });
}

// ====================== HELPERS DE DIBUJO ======================

function cardLabel(type: string, t: typeof T.es): string {
  return type === "debit" ? t.debit
    : type === "credit" ? t.credit
    : type === "international" ? t.international
    : type === "amex" ? t.amex
    : type;
}

function sectionTitle(doc: any, text: string) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor(BRAND).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
}

function smallNote(doc: any, text: string) {
  doc.fontSize(8).fillColor(INK_LIGHT).font("Helvetica-Oblique").text(text);
  doc.moveDown(0.3);
}

function drawTable(doc: any, headers: string[], rows: string[][], colPercents: number[]) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = colPercents.map((p) => (p / 100) * pageWidth);
  const rowHeight = 24;
  const headerHeight = 22;
  let y = doc.y;

  // Header row
  let x = doc.page.margins.left;
  doc.rect(x, y, pageWidth, headerHeight).fill(BRAND_DARK);
  doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 6, { width: colWidths[i] - 8, align: "center" });
    x += colWidths[i];
  });
  y += headerHeight;

  // Data rows
  doc.fillColor(INK).font("Helvetica").fontSize(9);
  rows.forEach((row, ri) => {
    // Page break si no cabe
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
    }
    x = doc.page.margins.left;
    // Borde sutil
    doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).strokeColor(LINE).lineWidth(0.5).stroke();
    row.forEach((cell, i) => {
      const align = i === 0 ? "left" : "center";
      const isBold = i === 0;
      doc.font(isBold ? "Helvetica-Bold" : "Helvetica");
      doc.text(cell, x + 4, y + 7, { width: colWidths[i] - 8, align });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y + 8;
}

function drawKVTable(doc: any, rows: [string, string][]) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = pageWidth * 0.55;
  const valueWidth = pageWidth * 0.45;
  const rowHeight = 24;
  let y = doc.y;

  rows.forEach((row) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
    }
    const x = doc.page.margins.left;
    // Label cell (fondo claro)
    doc.rect(x, y, labelWidth, rowHeight).fill(BRAND_LIGHT);
    doc.rect(x, y, pageWidth, rowHeight).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold");
    doc.text(row[0], x + 6, y + 7, { width: labelWidth - 12 });
    doc.font("Helvetica");
    doc.text(row[1], x + labelWidth + 6, y + 7, { width: valueWidth - 12 });
    y += rowHeight;
  });

  doc.y = y + 8;
}
