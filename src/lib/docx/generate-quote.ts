import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ImageRun, ShadingType,
  HeadingLevel, PageOrientation, Footer,
} from "docx";
import type {
  Quote, QuoteCardProcessing, QuoteAlternativePayment, QuoteInternationalPayment,
  Country, Currency,
} from "@/types/database";

// Paleta oficial PayBoom
const BRAND = "F35514";        // Naranja PAY (primario)
const BRAND_DARK = "009FA2";   // Turquesa BOOM (secundario, para encabezados de tabla)
const BRAND_LIGHT = "EFFDFD";  // teal-50 fondo de cells de etiqueta
const INK = "22252C";
const LINE = "D5DAE2";

export type QuoteLanguage = "es" | "en";

type Inputs = {
  quote: Quote;
  cardLines: QuoteCardProcessing[];
  altLines: QuoteAlternativePayment[];
  intlLines: QuoteInternationalPayment[];
  countries: Country[];
  currencies: Currency[];
  logoBytes?: ArrayBuffer | null;
  language?: QuoteLanguage;
};

// =================== I18N ===================
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
    cardHeaders: ["Método", "Tarifa de transacción", "Tarifa fija", "Reembolso/Refund", "Contracargo", "Ciclo de liquidación"],
    altHeaders: ["País", "Método", "Variable", "Fijo", "Dispersión", "Liquidación"],
    intlHeaders: ["País", "Servicio", "Variable", "Fijo", "Moneda"],
    localAcquiring: "Adquirencia Local",
    debit: "Débito", credit: "Crédito", international: "Internacional", amex: "AMEX",
    payIn: "Pay-In", payOut: "Pay-Out",
    spei: "SPEI", oxxo: "OXXO", paybooomCash: "PayBoom Cash",
    settlementCurrency: "Moneda de liquidación",
    minBilling: "Mínimo mensual de facturación",
    fee3ds: "Cobro de 3DS (por transacción)",
    monthlyFee: "Cuota mensual de plataforma",
    annualFee: "Cuota anual de plataforma",
    settlementPending: "Por confirmar",
    settlement: "Liquidación",
    rollingReserve: "Reserva revolvente (Rolling Reserve)",
    rollingReserveValue: (pct: number) => `${pct}% de cada transacción`,
    rollingReserveHoldLabel: "Periodo de retención",
    rollingReserveHoldValue: (days: number) => `${days} días`,
    confidentialityFooter:
      "El contenido de esta página es confidencial y no puede ser divulgado a terceros sin la autorización por escrito de PayBoom. La información sobre tarifas aquí presentada se proporciona exclusivamente al destinatario aquí especificado. Este es un resumen no vinculante que describe métodos de pago y tarifas, y no tiene la intención de constituir un compromiso vinculante o exigible. Pueden aplicarse tarifas y cargos adicionales. Para consultar el cuadro completo de Tarifas y Cargos aplicables, remítase al Contrato del Merchant, cuya celebración está sujeta a diversas condiciones, según se describe con mayor detalle en dicho contrato.",
    extraFeesSection: "Cargos adicionales",
    extraFeesHeaders: ["Concepto", "Frecuencia", "Monto"],
    freq: { one_time: "Pago único", monthly: "Mensual", annual: "Anual", per_transaction: "Por transacción" } as Record<string, string>,
    months: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
    locale: "es-MX",
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
    cardHeaders: ["Method", "Transaction fee", "Fixed fee", "Refund fee", "Chargeback fee", "Settlement cycle"],
    altHeaders: ["Country", "Method", "Variable", "Fixed", "Dispersion", "Settlement"],
    intlHeaders: ["Country", "Service", "Variable", "Fixed", "Currency"],
    localAcquiring: "Local Acquiring",
    debit: "Debit", credit: "Credit", international: "International", amex: "AMEX",
    payIn: "Pay-In", payOut: "Pay-Out",
    spei: "SPEI", oxxo: "OXXO", paybooomCash: "PayBoom Cash",
    settlementCurrency: "Settlement currency",
    minBilling: "Monthly minimum billing",
    fee3ds: "3DS fee (per transaction)",
    monthlyFee: "Monthly platform fee",
    annualFee: "Annual platform fee",
    settlementPending: "To be confirmed",
    settlement: "Settlement",
    rollingReserve: "Rolling Reserve",
    rollingReserveValue: (pct: number) => `${pct}% of each transaction`,
    rollingReserveHoldLabel: "Hold period",
    rollingReserveHoldValue: (days: number) => `${days} days`,
    confidentialityFooter:
      "The content of this page is confidential and may not be disclosed to third parties without PayBoom's written authorization. The pricing information presented herein is provided exclusively to the recipient specified above. This is a non-binding summary describing payment methods and fees, and is not intended to constitute a binding or enforceable commitment. Additional fees and charges may apply. For the complete schedule of applicable Fees and Charges, please refer to the Merchant Agreement, the execution of which is subject to various conditions, as further described in such agreement.",
    extraFeesSection: "Additional Fees",
    extraFeesHeaders: ["Item", "Frequency", "Amount"],
    freq: { one_time: "One-time", monthly: "Monthly", annual: "Annual", per_transaction: "Per transaction" } as Record<string, string>,
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    locale: "en-US",
    na: "N/A",
  },
};

// =================== HELPERS ===================
const fmtPct = (n: number | null | undefined, na: string) => (n == null ? na : `${Number(n)}%`);
const fmtMoney = (n: number | null | undefined, ccy: string, na: string) => (n == null ? na : `${Number(n).toFixed(2)} ${ccy}`);
const countryName = (code: string, countries: Country[]) => countries.find((c) => c.code === code)?.name || code;

function thFont(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Montserrat" })],
    alignment: AlignmentType.CENTER,
  });
}
function tdFont(text: string, opts: { bold?: boolean; align?: any } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, color: INK, size: 18, font: "Montserrat" })],
    alignment: opts.align || AlignmentType.LEFT,
  });
}

function headerCell(text: string, widthPct = 0) {
  // Encabezados de tabla en turquesa (BOOM) — más legible que el naranja en bloque
  return new TableCell({
    children: [thFont(text)],
    shading: { fill: BRAND_DARK, type: ShadingType.CLEAR, color: "auto" },
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}
function bodyCell(text: string, opts: { center?: boolean; widthPct?: number; bold?: boolean } = {}) {
  return new TableCell({
    children: [tdFont(text, { bold: opts.bold, align: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT })],
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function tblBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  };
}

function H(text: string, level: any = HeadingLevel.HEADING_2) {
  return new Paragraph({
    heading: level,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, color: BRAND, size: level === HeadingLevel.TITLE ? 44 : 26, font: "Montserrat" })],
  });
}

function P(text: string, opts: { italic?: boolean; size?: number; bold?: boolean; color?: string; align?: any } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: 100 },
    children: [new TextRun({
      text,
      italics: opts.italic,
      bold: opts.bold,
      color: opts.color || INK,
      size: opts.size ?? 20,
      font: "Montserrat",
    })],
  });
}

// =================== TABLES ===================
function buildCardTable(lines: QuoteCardProcessing[], countries: Country[], t: typeof T.es): Table {
  const widths = [25, 13, 13, 13, 13, 23];
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.cardHeaders.map((h, i) => headerCell(h, widths[i])),
  });

  const cardLabel = (type: string) =>
    type === "debit" ? t.debit
    : type === "credit" ? t.credit
    : type === "international" ? t.international
    : type === "amex" ? t.amex
    : type;

  const rows = lines.map((l) => {
    const variable = l.has_variable ? fmtPct(l.price_variable, t.na) : t.na;
    const fixed = l.has_fixed ? fmtMoney(l.price_fixed, l.currency_code, t.na) : t.na;
    const refund = l.has_refund ? fmtMoney(l.price_refund, l.currency_code, t.na) : t.na;
    const cb = l.has_chargeback ? fmtMoney(l.price_chargeback, l.currency_code, t.na) : t.na;
    return new TableRow({
      children: [
        bodyCell(`${t.localAcquiring} — ${countryName(l.country_code, countries)} ${cardLabel(l.card_type)}`, { widthPct: widths[0], bold: true }),
        bodyCell(variable, { center: true, widthPct: widths[1] }),
        bodyCell(fixed, { center: true, widthPct: widths[2] }),
        bodyCell(refund, { center: true, widthPct: widths[3] }),
        bodyCell(cb, { center: true, widthPct: widths[4] }),
        bodyCell(l.settlement_time || "—", { center: true, widthPct: widths[5] }),
      ],
    });
  });

  return new Table({
    rows: [headerRow, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tblBorders(),
  });
}

function buildAltTable(lines: QuoteAlternativePayment[], countries: Country[], t: typeof T.es): Table {
  const widths = [18, 18, 13, 16, 16, 19];
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.altHeaders.map((h, i) => headerCell(h, widths[i])),
  });
  const methodLabel = (m: string) => ({ spei: t.spei, oxxo: t.oxxo, payboom_cash: t.paybooomCash } as Record<string,string>)[m] || m;

  const rows = lines.map((l) =>
    new TableRow({
      children: [
        bodyCell(countryName(l.country_code, countries), { widthPct: widths[0] }),
        bodyCell(methodLabel(l.method), { widthPct: widths[1], bold: true }),
        bodyCell(l.has_variable ? fmtPct(l.price_variable, t.na) : t.na, { center: true, widthPct: widths[2] }),
        bodyCell(l.has_fixed ? fmtMoney(l.price_fixed, l.currency_code, t.na) : t.na, { center: true, widthPct: widths[3] }),
        bodyCell(l.has_dispersion ? fmtMoney(l.price_dispersion, l.currency_code, t.na) : t.na, { center: true, widthPct: widths[4] }),
        bodyCell(l.settlement_time || "—", { center: true, widthPct: widths[5] }),
      ],
    })
  );

  return new Table({
    rows: [headerRow, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tblBorders(),
  });
}

function buildIntlTable(lines: QuoteInternationalPayment[], countries: Country[], t: typeof T.es): Table {
  const widths = [22, 18, 18, 22, 20];
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.intlHeaders.map((h, i) => headerCell(h, widths[i])),
  });

  const rows: any[] = [];
  for (const l of lines) {
    if (l.has_payin) {
      rows.push(new TableRow({
        children: [
          bodyCell(countryName(l.country_code, countries), { widthPct: widths[0] }),
          bodyCell(t.payIn, { widthPct: widths[1], bold: true }),
          bodyCell(fmtPct(l.payin_price_variable, t.na), { center: true, widthPct: widths[2] }),
          bodyCell(fmtMoney(l.payin_price_fixed, l.currency_code, t.na), { center: true, widthPct: widths[3] }),
          bodyCell(l.currency_code, { center: true, widthPct: widths[4] }),
        ],
      }));
    }
    if (l.has_payout) {
      rows.push(new TableRow({
        children: [
          bodyCell(countryName(l.country_code, countries), { widthPct: widths[0] }),
          bodyCell(t.payOut, { widthPct: widths[1], bold: true }),
          bodyCell(fmtPct(l.payout_price_variable, t.na), { center: true, widthPct: widths[2] }),
          bodyCell(fmtMoney(l.payout_price_fixed, l.currency_code, t.na), { center: true, widthPct: widths[3] }),
          bodyCell(l.currency_code, { center: true, widthPct: widths[4] }),
        ],
      }));
    }
  }

  return new Table({
    rows: [headerRow, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tblBorders(),
  });
}

function buildSettlementTable(quote: Quote, t: typeof T.es): Table {
  const rows: any[] = [];
  const labelCell = (text: string) =>
    new TableCell({
      children: [tdFont(text, { bold: true })],
      shading: { fill: BRAND_LIGHT, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: 60, type: WidthType.PERCENTAGE },
    });
  const valueCell = (text: string) =>
    new TableCell({
      children: [tdFont(text)],
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: 40, type: WidthType.PERCENTAGE },
    });

  if (quote.settlement_currency) {
    rows.push(new TableRow({ children: [labelCell(t.settlementCurrency), valueCell(quote.settlement_currency)] }));
  }
  if (quote.minimum_monthly_billing != null) {
    rows.push(new TableRow({ children: [labelCell(t.minBilling), valueCell(`${quote.minimum_monthly_billing.toLocaleString()} ${quote.settlement_currency || ""}`)] }));
  }
  if (quote.charges_3ds && quote.price_3ds != null) {
    rows.push(new TableRow({ children: [labelCell(t.fee3ds), valueCell(fmtMoney(quote.price_3ds, quote.settlement_currency || "USD", t.na))] }));
  }
  if (quote.has_monthly_fee && quote.monthly_fee != null) {
    rows.push(new TableRow({ children: [labelCell(t.monthlyFee), valueCell(fmtMoney(quote.monthly_fee, quote.settlement_currency || "USD", t.na))] }));
  }
  if (quote.has_annual_fee && quote.annual_fee != null) {
    rows.push(new TableRow({ children: [labelCell(t.annualFee), valueCell(fmtMoney(quote.annual_fee, quote.settlement_currency || "USD", t.na))] }));
  }
  if (quote.has_rolling_reserve && quote.rolling_reserve_pct != null) {
    rows.push(new TableRow({
      children: [
        labelCell(t.rollingReserve),
        valueCell(t.rollingReserveValue(Number(quote.rolling_reserve_pct))),
      ],
    }));
  }
  if (quote.has_rolling_reserve && quote.rolling_reserve_release_days != null) {
    rows.push(new TableRow({
      children: [
        labelCell(t.rollingReserveHoldLabel),
        valueCell(t.rollingReserveHoldValue(Number(quote.rolling_reserve_release_days))),
      ],
    }));
  }

  if (rows.length === 0) {
    rows.push(new TableRow({ children: [labelCell(t.settlement), valueCell(t.settlementPending)] }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tblBorders(),
  });
}

function buildExtraFeesTable(extraFees: any[], t: typeof T.es): Table {
  const widths = [50, 25, 25];
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.extraFeesHeaders.map((h, i) => headerCell(h, widths[i])),
  });

  const rows = extraFees.map((fee) =>
    new TableRow({
      children: [
        bodyCell(fee.title || "—", { widthPct: widths[0], bold: true }),
        bodyCell(t.freq[fee.frequency] || fee.frequency, { center: true, widthPct: widths[1] }),
        bodyCell(`${Number(fee.amount).toFixed(2)} ${fee.currency || ""}`, { center: true, widthPct: widths[2] }),
      ],
    })
  );

  return new Table({
    rows: [headerRow, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tblBorders(),
  });
}

function formatDate(iso: string, t: typeof T.es) {
  const d = new Date(iso);
  return `${d.getDate()} ${t.locale === "es-MX" ? "de " : ""}${t.months[d.getMonth()]}${t.locale === "es-MX" ? " de " : ", "}${d.getFullYear()}`;
}

// =================== MAIN ===================
export async function buildQuoteDocx(input: Inputs): Promise<Buffer> {
  const { quote, cardLines, altLines, intlLines, countries, logoBytes, language } = input;
  const t = T[language || "es"];

  const sections: any[] = [];

  // Header with logo
  if (logoBytes) {
    // El logo oficial es ~3.36:1 — ajusto proporciones
    sections.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new ImageRun({
          data: logoBytes,
          transformation: { width: 200, height: 60 },
          type: "png",
        } as any),
      ],
    }));
  } else {
    sections.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "PAY", bold: true, color: BRAND, size: 48, font: "Montserrat" }),
        new TextRun({ text: "BOOM", bold: true, color: BRAND_DARK, size: 48, font: "Montserrat" }),
      ],
    }));
  }

  // Title
  sections.push(H(t.proposalTitle, HeadingLevel.TITLE));
  sections.push(P(quote.customer_name, { bold: true, size: 28, color: BRAND, align: AlignmentType.CENTER }));
  if (quote.customer_company) sections.push(P(quote.customer_company, { size: 22, align: AlignmentType.CENTER }));
  sections.push(P(t.quoteAndDate(quote.quote_number, formatDate(quote.created_at, t)), { italic: true, color: "67748B", align: AlignmentType.CENTER }));

  // Card processing
  if (quote.includes_card_processing && cardLines.length > 0) {
    sections.push(H(t.cardSection));
    sections.push(P(t.cardNoteTax, { italic: true, size: 16, color: "67748B" }));
    sections.push(buildCardTable(cardLines, countries, t));
    sections.push(P(t.cardNoteFraud, { italic: true, size: 16, color: "67748B" }));
  }

  // Alternative payments
  if (quote.includes_alternative_payments && altLines.length > 0) {
    sections.push(H(t.altSection));
    sections.push(P(t.cardNoteTax, { italic: true, size: 16, color: "67748B" }));
    sections.push(buildAltTable(altLines, countries, t));
  }

  // International
  if (quote.includes_international_payments && intlLines.length > 0) {
    sections.push(H(t.intlSection));
    sections.push(P(t.intlSubtitle, { italic: true, size: 16, color: "67748B" }));
    sections.push(buildIntlTable(intlLines, countries, t));
  }

  // Settlement & platform
  sections.push(H(t.settlementSection));
  sections.push(buildSettlementTable(quote, t));

  // Cargos adicionales personalizados
  const extras = (quote as any).extra_fees;
  if (Array.isArray(extras) && extras.length > 0) {
    sections.push(H(t.extraFeesSection));
    sections.push(buildExtraFeesTable(extras, t));
  }

  // Notes
  if (quote.notes) {
    sections.push(H(t.notesSection));
    sections.push(P(quote.notes));
  }

  // Footer
  sections.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  sections.push(P(t.closing, { italic: true, color: "67748B", align: AlignmentType.RIGHT }));
  sections.push(P("PayBoom", { bold: true, color: BRAND, size: 24, align: AlignmentType.RIGHT }));

  const doc = new Document({
    creator: "PayBoom Cotizador",
    title: `${t.proposalTitle} - ${quote.customer_name}`,
    description: `Quote ${quote.quote_number}`,
    styles: {
      default: {
        document: { run: { font: "Montserrat", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 1080, left: 720 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        // Pie de página con cláusula de confidencialidad — se repite en cada página.
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 60, after: 0, line: 220 },
                children: [
                  new TextRun({
                    text: t.confidentialityFooter,
                    italics: true,
                    color: "67748B",
                    size: 14,            // ~7pt — letra chica de footer
                    font: "Montserrat",
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
