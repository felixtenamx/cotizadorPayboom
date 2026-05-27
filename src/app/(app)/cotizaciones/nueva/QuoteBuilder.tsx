"use client";

import { useMemo, useState, useTransition } from "react";
import type { Country, Currency, Provider, ProviderCost, ServiceType, ExtraFee, ExtraFeeFrequency, PaymentMethod } from "@/types/database";
import type { QuotePayload } from "./actions";
import { Plus, Trash2, AlertCircle, Save, CreditCard, Banknote, Globe, Settings, Lock } from "lucide-react";
import { margin, formatPercent, PRESET_SETTLEMENT_TIMES } from "@/lib/utils";

type CardLine = QuotePayload["card_lines"][number] & { _id: string };
type AltLine = QuotePayload["alt_lines"][number] & { _id: string };
type IntlLine = QuotePayload["intl_lines"][number] & { _id: string };

const newId = () => Math.random().toString(36).slice(2, 10);

export default function QuoteBuilder({
  countries,
  currencies,
  providers,
  providerCosts,
  paymentMethods,
  initialQuote,
  saveAction,
}: {
  countries: Country[];
  currencies: Currency[];
  providers: Provider[];
  providerCosts: ProviderCost[];
  paymentMethods: PaymentMethod[];
  initialQuote?: any;     // Para modo edición — se aplica abajo
  saveAction: (payload: QuotePayload) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const iq = initialQuote;
  const numToStr = (n: any) => (n == null ? "" : String(n));

  // Customer
  const [customerName, setCustomerName] = useState(iq?.customer_name || "");
  const [customerCompany, setCustomerCompany] = useState(iq?.customer_company || "");
  const [customerEmail, setCustomerEmail] = useState(iq?.customer_email || "");
  const [customerContact, setCustomerContact] = useState(iq?.customer_contact || "");
  const [notes, setNotes] = useState(iq?.notes || "");

  // Service toggles
  const [includesCard, setIncludesCard] = useState(iq ? !!iq.includes_card_processing : true);
  const [includesAlt, setIncludesAlt] = useState(!!iq?.includes_alternative_payments);
  const [includesIntl, setIncludesIntl] = useState(!!iq?.includes_international_payments);

  // Lines (precargadas en modo edición)
  const [cardLines, setCardLines] = useState<CardLine[]>(
    (iq?.cardLines || []).map((l: any) => ({ ...l, _id: newId() }))
  );
  const [altLines, setAltLines] = useState<AltLine[]>(
    (iq?.altLines || []).map((l: any) => ({ ...l, _id: newId() }))
  );
  const [intlLines, setIntlLines] = useState<IntlLine[]>(
    (iq?.intlLines || []).map((l: any) => ({ ...l, _id: newId() }))
  );

  // Final fees
  const [settlementCurrency, setSettlementCurrency] = useState(iq?.settlement_currency || "");
  const [minMonthlyBilling, setMinMonthlyBilling] = useState<string>(numToStr(iq?.minimum_monthly_billing));
  const [charges3ds, setCharges3ds] = useState(!!iq?.charges_3ds);
  const [cost3ds, setCost3ds] = useState<string>(numToStr(iq?.cost_3ds));
  const [price3ds, setPrice3ds] = useState<string>(numToStr(iq?.price_3ds));
  const [provider3ds, setProvider3ds] = useState<string>(iq?.provider_3ds_id || "");
  const [hasMonthlyFee, setHasMonthlyFee] = useState(!!iq?.has_monthly_fee);
  const [monthlyFee, setMonthlyFee] = useState<string>(numToStr(iq?.monthly_fee));
  const [hasAnnualFee, setHasAnnualFee] = useState(!!iq?.has_annual_fee);
  const [annualFee, setAnnualFee] = useState<string>(numToStr(iq?.annual_fee));

  // Rolling Reserve (sólo aplica cuando se cotiza tarjetas)
  const [hasRollingReserve, setHasRollingReserve] = useState(!!iq?.has_rolling_reserve);
  const [rollingReservePct, setRollingReservePct] = useState<string>(numToStr(iq?.rolling_reserve_pct));
  const [rollingReserveDays, setRollingReserveDays] = useState<string>(numToStr(iq?.rolling_reserve_release_days));

  // Cargos personalizados adicionales
  const [extraFees, setExtraFees] = useState<ExtraFee[]>(
    (iq?.extra_fees || []).map((f: any) => ({ ...f, id: f.id || newId() }))
  );

  function addExtraFee() {
    setExtraFees((prev) => [
      ...prev,
      { id: newId(), title: "", amount: 0, currency: settlementCurrency || currencies[0]?.code || "USD", frequency: "monthly", notes: null },
    ]);
  }
  function updateExtraFee(id: string, patch: Partial<ExtraFee>) {
    setExtraFees((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function removeExtraFee(id: string) {
    setExtraFees((prev) => prev.filter((f) => f.id !== id));
  }

  function findCost(opts: {
    providerId?: string | null;
    service: ServiceType;
    subtype?: string | null;
    country?: string | null;
    currency?: string | null;
    field: "cost_variable" | "cost_fixed" | "cost_chargeback" | "cost_refund" | "cost_dispersion";
  }): number | null {
    if (!opts.providerId) return null;
    const c = providerCosts.find((pc) =>
      pc.provider_id === opts.providerId &&
      pc.service_type === opts.service &&
      (!opts.subtype || (pc.subtype || "").toLowerCase() === opts.subtype.toLowerCase()) &&
      (!opts.country || pc.country_code === opts.country) &&
      (!opts.currency || pc.currency_code === opts.currency) &&
      pc[opts.field] != null
    );
    return c ? Number(c[opts.field]) : null;
  }

  // Filtra proveedores que tienen al menos un costo registrado para el tipo de servicio dado.
  // Así en la sección de Tarjetas sólo salen los proveedores de tarjetas, en Pay-In Intl sólo los de Pay-In, etc.
  const providersByService = useMemo(() => {
    const map: Record<ServiceType, Provider[]> = {
      card_processing: [],
      alternative_payment: [],
      international_payin: [],
      international_payout: [],
    };
    (Object.keys(map) as ServiceType[]).forEach((service) => {
      const providerIds = new Set(
        providerCosts
          .filter((pc) => pc.service_type === service)
          .map((pc) => pc.provider_id)
      );
      map[service] = providers.filter((p) => providerIds.has(p.id));
    });
    return map;
  }, [providers, providerCosts]);

  // ==== Card lines actions ====
  function addCardLine() {
    const c = countries[0];
    setCardLines((prev) => [
      ...prev,
      {
        _id: newId(),
        country_code: c?.code || "",
        currency_code: c?.default_currency_code || currencies[0]?.code || "",
        card_type: "debit",
        settlement_time: "T+1",
        has_variable: true,
        has_fixed: true,
        has_chargeback: false,
        has_refund: false,
      },
    ]);
  }
  function updateCardLine(id: string, patch: Partial<CardLine>) {
    setCardLines((prev) => prev.map((l) => (l._id === id ? { ...l, ...patch } : l)));
  }
  function removeCardLine(id: string) {
    setCardLines((prev) => prev.filter((l) => l._id !== id));
  }

  // ==== Alt lines ====
  function addAltLine() {
    const c = countries[0];
    setAltLines((prev) => [
      ...prev,
      {
        _id: newId(),
        country_code: c?.code || "",
        currency_code: c?.default_currency_code || currencies[0]?.code || "",
        method: paymentMethods[0]?.code || "spei",
        settlement_time: "T+1",
        has_variable: true,
        has_fixed: false,
        has_dispersion: false,
      },
    ]);
  }
  function updateAltLine(id: string, patch: Partial<AltLine>) {
    setAltLines((prev) => prev.map((l) => (l._id === id ? { ...l, ...patch } : l)));
  }
  function removeAltLine(id: string) {
    setAltLines((prev) => prev.filter((l) => l._id !== id));
  }

  // ==== Intl lines ====
  function addIntlLine() {
    const c = countries[0];
    setIntlLines((prev) => [
      ...prev,
      {
        _id: newId(),
        country_code: c?.code || "",
        currency_code: c?.default_currency_code || currencies[0]?.code || "",
        has_payin: true,
        has_payout: false,
      },
    ]);
  }
  function updateIntlLine(id: string, patch: Partial<IntlLine>) {
    setIntlLines((prev) => prev.map((l) => (l._id === id ? { ...l, ...patch } : l)));
  }
  function removeIntlLine(id: string) {
    setIntlLines((prev) => prev.filter((l) => l._id !== id));
  }

  // ==== Submit ====
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    const stripId = <T extends { _id: string }>(arr: T[]) => arr.map(({ _id, ...rest }) => rest);
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

    const payload: QuotePayload = {
      customer_name: customerName.trim(),
      customer_company: customerCompany || null,
      customer_email: customerEmail || null,
      customer_contact: customerContact || null,
      notes: notes || null,
      settlement_currency: settlementCurrency || null,
      minimum_monthly_billing: numOrNull(minMonthlyBilling),
      charges_3ds: charges3ds,
      cost_3ds: numOrNull(cost3ds),
      price_3ds: numOrNull(price3ds),
      provider_3ds_id: provider3ds || null,
      has_monthly_fee: hasMonthlyFee,
      monthly_fee: numOrNull(monthlyFee),
      has_annual_fee: hasAnnualFee,
      annual_fee: numOrNull(annualFee),
      has_rolling_reserve: hasRollingReserve && includesCard,
      rolling_reserve_pct: numOrNull(rollingReservePct),
      rolling_reserve_release_days: rollingReserveDays.trim() === "" ? null : Math.round(Number(rollingReserveDays)),
      extra_fees: extraFees.filter((f) => f.title.trim() !== ""),
      includes_card_processing: includesCard,
      includes_alternative_payments: includesAlt,
      includes_international_payments: includesIntl,
      card_lines: includesCard ? stripId(cardLines) : [],
      alt_lines: includesAlt ? stripId(altLines) : [],
      intl_lines: includesIntl ? stripId(intlLines) : [],
    };

    startTransition(async () => {
      try {
        await saveAction(payload);
      } catch (err: any) {
        setError(err?.message || "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Nueva cotización</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Captura los datos para generar la propuesta comercial.</p>
      </header>

      {error && (
        <div className="card-pad bg-red-50 border-red-200 text-red-700 flex items-start gap-2 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Cliente */}
      <section className="card-pad">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">Cliente</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre del cliente *</label>
            <input className="input" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre completo o razón social" />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input className="input" value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Contacto</label>
            <input className="input" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} placeholder="Nombre / teléfono" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notas internas</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Servicios incluidos */}
      <section className="card-pad">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">Servicios a cotizar</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <ServiceToggle icon={<CreditCard size={18} />} label="Procesamiento de tarjetas" checked={includesCard} onChange={setIncludesCard} />
          <ServiceToggle icon={<Banknote size={18} />} label="Pagos alternativos (SPEI/OXXO/PB Cash)" checked={includesAlt} onChange={setIncludesAlt} />
          <ServiceToggle icon={<Globe size={18} />} label="Pagos internacionales (Pay-In/Pay-Out)" checked={includesIntl} onChange={setIncludesIntl} />
        </div>
      </section>

      {/* Procesamiento de tarjetas */}
      {includesCard && (
        <section className="card-pad">
          <SectionHeader
            title="Procesamiento de tarjetas"
            subtitle="Una línea por país y tipo de tarjeta. Marca las casillas para incluir cada concepto."
            onAdd={addCardLine}
            addLabel="Agregar línea"
          />
          {cardLines.length === 0 ? (
            <EmptyHint>Sin líneas. Agrega una para comenzar.</EmptyHint>
          ) : (
            <div className="space-y-4 mt-4">
              {cardLines.map((line) => (
                <CardLineCard
                  key={line._id}
                  line={line}
                  countries={countries}
                  currencies={currencies}
                  providers={providersByService.card_processing}
                  findCost={findCost}
                  onUpdate={(patch) => updateCardLine(line._id, patch)}
                  onRemove={() => removeCardLine(line._id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pagos alternativos */}
      {includesAlt && (
        <section className="card-pad">
          <SectionHeader
            title="Pagos alternativos (APM)"
            subtitle="SPEI, OXXO y PayBoom Cash. Una línea por país y método."
            onAdd={addAltLine}
            addLabel="Agregar línea"
          />
          {altLines.length === 0 ? (
            <EmptyHint>Sin líneas. Agrega una para comenzar. Si necesitas un método nuevo (PayPal, Klarna, etc.), créalo primero en <strong>Admin → Métodos de pago</strong>.</EmptyHint>
          ) : (
            <div className="space-y-4 mt-4">
              {altLines.map((line) => (
                <AltLineCard
                  key={line._id}
                  line={line}
                  countries={countries}
                  currencies={currencies}
                  providers={providersByService.alternative_payment}
                  paymentMethods={paymentMethods}
                  findCost={findCost}
                  onUpdate={(patch) => updateAltLine(line._id, patch)}
                  onRemove={() => removeAltLine(line._id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pagos internacionales */}
      {includesIntl && (
        <section className="card-pad">
          <SectionHeader
            title="Pagos internacionales"
            subtitle="Pay-In y Pay-Out por país. Cada uno con precio variable y fijo, eligiendo proveedor."
            onAdd={addIntlLine}
            addLabel="Agregar país"
          />
          {intlLines.length === 0 ? (
            <EmptyHint>Sin líneas. Agrega un país para comenzar.</EmptyHint>
          ) : (
            <div className="space-y-4 mt-4">
              {intlLines.map((line) => (
                <IntlLineCard
                  key={line._id}
                  line={line}
                  countries={countries}
                  currencies={currencies}
                  payinProviders={providersByService.international_payin}
                  payoutProviders={providersByService.international_payout}
                  findCost={findCost}
                  onUpdate={(patch) => updateIntlLine(line._id, patch)}
                  onRemove={() => removeIntlLine(line._id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tarifas y configuración final */}
      <section className="card-pad">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={18} className="text-ink-500 dark:text-ink-400" />
          <h2 className="font-semibold text-ink-900 dark:text-ink-50">Tarifas y configuración final</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Moneda de liquidación</label>
            <select className="input" value={settlementCurrency} onChange={(e) => setSettlementCurrency(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mínimo mensual a facturar</label>
            <input type="number" step="0.01" className="input" value={minMonthlyBilling} onChange={(e) => setMinMonthlyBilling(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        {/* 3DS */}
        <FeeBlock
          checked={charges3ds}
          onCheckedChange={setCharges3ds}
          label="Cobrar 3DS aparte"
        >
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label">Proveedor 3DS</label>
              <select className="input" value={provider3ds} onChange={(e) => setProvider3ds(e.target.value)}>
                <option value="">—</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Costo 3DS</label>
              <input type="number" step="0.0001" className="input" value={cost3ds} onChange={(e) => setCost3ds(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Precio 3DS</label>
              <input type="number" step="0.0001" className="input" value={price3ds} onChange={(e) => setPrice3ds(e.target.value)} placeholder="0.00" />
              <MarginHint price={Number(price3ds) || 0} cost={Number(cost3ds) || 0} />
            </div>
          </div>
        </FeeBlock>

        <FeeBlock
          checked={hasMonthlyFee}
          onCheckedChange={setHasMonthlyFee}
          label="Cobrar uso de plataforma mensual"
        >
          <div>
            <label className="label">Cuota mensual</label>
            <input type="number" step="0.01" className="input" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} placeholder="0.00" />
          </div>
        </FeeBlock>

        <FeeBlock
          checked={hasAnnualFee}
          onCheckedChange={setHasAnnualFee}
          label="Cobrar uso de plataforma anual"
        >
          <div>
            <label className="label">Cuota anual</label>
            <input type="number" step="0.01" className="input" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} placeholder="0.00" />
          </div>
        </FeeBlock>

        {/* Rolling Reserve — sólo cuando se cotiza tarjetas */}
        {includesCard && (
          <FeeBlock
            checked={hasRollingReserve}
            onCheckedChange={setHasRollingReserve}
            label="Aplicar Rolling Reserve / Reserva Revolvente"
          >
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Porcentaje de retención</label>
                <div className="relative">
                  <input
                    type="number" step="0.01"
                    className="input pr-8"
                    value={rollingReservePct}
                    onChange={(e) => setRollingReservePct(e.target.value)}
                    placeholder="ej. 5"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                </div>
              </div>
              <div>
                <label className="label">Período de liberación</label>
                <div className="relative">
                  <input
                    type="number" step="1" min="1"
                    className="input pr-12"
                    value={rollingReserveDays}
                    onChange={(e) => setRollingReserveDays(e.target.value)}
                    placeholder="ej. 90"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">días</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-2">
              El % se retiene de cada transacción y se libera al cliente después del período indicado.
            </p>
          </FeeBlock>
        )}

        {/* Cargos personalizados adicionales */}
        <div className="border border-ink-200 dark:border-ink-700 rounded-lg p-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Cargos adicionales personalizados</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400">Agrega tarifas que no estén en las opciones predefinidas (setup fee, integración, soporte, etc.)</p>
            </div>
            <button type="button" onClick={addExtraFee} className="btn-secondary text-xs">
              <Plus size={14} /> Agregar cargo
            </button>
          </div>
          {extraFees.length === 0 ? (
            <p className="text-xs text-ink-400 italic mt-2">Sin cargos adicionales.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {extraFees.map((fee) => (
                <div key={fee.id} className="grid md:grid-cols-12 gap-2 items-end p-3 bg-ink-50 dark:bg-ink-950/50 rounded-lg">
                  <div className="md:col-span-4">
                    <label className="label">Título</label>
                    <input
                      className="input"
                      value={fee.title}
                      onChange={(e) => updateExtraFee(fee.id, { title: e.target.value })}
                      placeholder="ej. Setup, KYC fee, Integración…"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Monto</label>
                    <input
                      type="number" step="0.01"
                      className="input"
                      value={fee.amount}
                      onChange={(e) => updateExtraFee(fee.id, { amount: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Moneda</label>
                    <select
                      className="input"
                      value={fee.currency}
                      onChange={(e) => updateExtraFee(fee.id, { currency: e.target.value })}
                    >
                      {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Frecuencia</label>
                    <select
                      className="input"
                      value={fee.frequency}
                      onChange={(e) => updateExtraFee(fee.id, { frequency: e.target.value as ExtraFeeFrequency })}
                    >
                      <option value="one_time">Pago único</option>
                      <option value="monthly">Mensual</option>
                      <option value="annual">Anual</option>
                      <option value="per_transaction">Por transacción</option>
                    </select>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeExtraFee(fee.id)}
                      className="btn-ghost text-red-600 hover:bg-red-50 p-2"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-700 px-4 py-3 flex items-center justify-end gap-3 z-30 shadow-lg">
        <button type="button" onClick={() => history.back()} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={pending} className="btn-primary">
          <Save size={16} />
          {pending ? "Guardando…" : "Guardar cotización"}
        </button>
      </div>
    </form>
  );
}

// ===================== UI COMPONENTS =====================

function ServiceToggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${checked ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-white dark:bg-ink-900 hover:border-ink-300"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
      <span className={checked ? "text-brand-700" : "text-ink-500 dark:text-ink-400"}>{icon}</span>
      <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
    </label>
  );
}

function SectionHeader({ title, subtitle, onAdd, addLabel }: { title: string; subtitle?: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
      <div>
        <h2 className="font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
        {subtitle && <p className="text-ink-500 dark:text-ink-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
      <button type="button" onClick={onAdd} className="btn-secondary text-sm">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 text-sm text-ink-500 dark:text-ink-400 italic">{children}</div>;
}

function FeeBlock({ checked, onCheckedChange, label, children }: { checked: boolean; onCheckedChange: (b: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <div className="border border-ink-200 dark:border-ink-700 rounded-lg p-3 mb-3">
      <label className="flex items-center gap-2 mb-2">
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
        <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
      </label>
      {checked && <div className="mt-2">{children}</div>}
    </div>
  );
}

function SettlementTimeInput({ value, onChange, listId, label }: {
  value: string;
  onChange: (v: string) => void;
  listId: string;
  label?: string;
}) {
  return (
    <div>
      <label className="label">{label || "Liquidación"}</label>
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="ej. T+1, 7/7, Quincenal, 24h…"
      />
      <datalist id={listId}>
        {PRESET_SETTLEMENT_TIMES.map((t) => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
}

function MarginHint({ price, cost, asPercent }: { price: number | null; cost: number | null; asPercent?: boolean }) {
  const m = margin(price ?? 0, cost ?? 0);
  if (m == null || (price === 0 && cost === 0)) return null;
  const color = m >= 30 ? "text-emerald-600" : m >= 0 ? "text-amber-600" : "text-red-600";
  return <div className={`text-[11px] mt-1 ${color}`}>Margen: {formatPercent(m)}</div>;
}

// ============= CARD LINE =============
function CardLineCard({
  line, countries, currencies, providers, findCost, onUpdate, onRemove,
}: {
  line: CardLine;
  countries: Country[];
  currencies: Currency[];
  providers: Provider[];
  findCost: any;
  onUpdate: (patch: Partial<CardLine>) => void;
  onRemove: () => void;
}) {
  const subtype = line.card_type;
  return (
    <div className="border border-ink-200 rounded-xl p-4 bg-ink-50 dark:bg-ink-950/50">
      <div className="grid md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="label">País</label>
          <select className="input" value={line.country_code} onChange={(e) => {
            const c = countries.find((cc) => cc.code === e.target.value);
            onUpdate({ country_code: e.target.value, currency_code: c?.default_currency_code || line.currency_code });
          }}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Moneda</label>
          <select className="input" value={line.currency_code} onChange={(e) => onUpdate({ currency_code: e.target.value })}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo de tarjeta</label>
          <select className="input" value={line.card_type} onChange={(e) => onUpdate({ card_type: e.target.value as any })}>
            <option value="debit">Débito</option>
            <option value="credit">Crédito</option>
            <option value="international">Internacional</option>
            <option value="amex">AMEX</option>
          </select>
        </div>
        <SettlementTimeInput
          value={line.settlement_time || ""}
          onChange={(v) => onUpdate({ settlement_time: v })}
          listId={`liq-card-${line._id}`}
        />
      </div>

      <FeeRow
        label="Tarifa de transacción variable (%)"
        included={line.has_variable}
        onIncludeChange={(v) => onUpdate({ has_variable: v })}
        providers={providers}
        providerId={line.provider_variable_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "card_processing", subtype, country: line.country_code, currency: line.currency_code, field: "cost_variable" });
          onUpdate({ provider_variable_id: pid || null, cost_variable: cost });
        }}
        price={line.price_variable}
        onPriceChange={(p) => onUpdate({ price_variable: p })}
        cost={line.cost_variable}
        onCostChange={(c) => onUpdate({ cost_variable: c })}
        unit="%"
      />
      <FeeRow
        label="Tarifa de transacción fija"
        included={line.has_fixed}
        onIncludeChange={(v) => onUpdate({ has_fixed: v })}
        providers={providers}
        providerId={line.provider_fixed_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "card_processing", subtype, country: line.country_code, currency: line.currency_code, field: "cost_fixed" });
          onUpdate({ provider_fixed_id: pid || null, cost_fixed: cost });
        }}
        price={line.price_fixed}
        onPriceChange={(p) => onUpdate({ price_fixed: p })}
        cost={line.cost_fixed}
        onCostChange={(c) => onUpdate({ cost_fixed: c })}
        unit={line.currency_code}
      />
      <FeeRow
        label="Contracargo"
        included={line.has_chargeback}
        onIncludeChange={(v) => onUpdate({ has_chargeback: v })}
        providers={providers}
        providerId={line.provider_chargeback_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "card_processing", subtype, country: line.country_code, currency: line.currency_code, field: "cost_chargeback" });
          onUpdate({ provider_chargeback_id: pid || null, cost_chargeback: cost });
        }}
        price={line.price_chargeback}
        onPriceChange={(p) => onUpdate({ price_chargeback: p })}
        cost={line.cost_chargeback}
        onCostChange={(c) => onUpdate({ cost_chargeback: c })}
        unit={line.currency_code}
      />
      <FeeRow
        label="Reverso / Refund"
        included={line.has_refund}
        onIncludeChange={(v) => onUpdate({ has_refund: v })}
        providers={providers}
        providerId={line.provider_refund_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "card_processing", subtype, country: line.country_code, currency: line.currency_code, field: "cost_refund" });
          onUpdate({ provider_refund_id: pid || null, cost_refund: cost });
        }}
        price={line.price_refund}
        onPriceChange={(p) => onUpdate({ price_refund: p })}
        cost={line.cost_refund}
        onCostChange={(c) => onUpdate({ cost_refund: c })}
        unit={line.currency_code}
      />

      <div className="flex justify-end mt-2">
        <button type="button" onClick={onRemove} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
          <Trash2 size={14} /> Eliminar línea
        </button>
      </div>
    </div>
  );
}

// ============= ALT LINE =============
function AltLineCard({
  line, countries, currencies, providers, paymentMethods, findCost, onUpdate, onRemove,
}: {
  line: AltLine;
  countries: Country[];
  currencies: Currency[];
  providers: Provider[];
  paymentMethods: PaymentMethod[];
  findCost: any;
  onUpdate: (patch: Partial<AltLine>) => void;
  onRemove: () => void;
}) {
  const subtype = line.method;
  return (
    <div className="border border-ink-200 rounded-xl p-4 bg-ink-50 dark:bg-ink-950/50">
      <div className="grid md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="label">País</label>
          <select className="input" value={line.country_code} onChange={(e) => {
            const c = countries.find((cc) => cc.code === e.target.value);
            onUpdate({ country_code: e.target.value, currency_code: c?.default_currency_code || line.currency_code });
          }}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Moneda</label>
          <select className="input" value={line.currency_code} onChange={(e) => onUpdate({ currency_code: e.target.value })}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Método</label>
          <select className="input" value={line.method} onChange={(e) => onUpdate({ method: e.target.value as any })}>
            {paymentMethods.length === 0
              ? <option value="">— Sin métodos configurados —</option>
              : paymentMethods.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
        </div>
        <SettlementTimeInput
          value={line.settlement_time || ""}
          onChange={(v) => onUpdate({ settlement_time: v })}
          listId={`liq-alt-${line._id}`}
        />
      </div>

      <FeeRow
        label="Variable (%)"
        included={line.has_variable}
        onIncludeChange={(v) => onUpdate({ has_variable: v })}
        providers={providers}
        providerId={line.provider_variable_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "alternative_payment", subtype, country: line.country_code, currency: line.currency_code, field: "cost_variable" });
          onUpdate({ provider_variable_id: pid || null, cost_variable: cost });
        }}
        price={line.price_variable}
        onPriceChange={(p) => onUpdate({ price_variable: p })}
        cost={line.cost_variable}
        onCostChange={(c) => onUpdate({ cost_variable: c })}
        unit="%"
      />
      <FeeRow
        label="Fijo"
        included={line.has_fixed}
        onIncludeChange={(v) => onUpdate({ has_fixed: v })}
        providers={providers}
        providerId={line.provider_fixed_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "alternative_payment", subtype, country: line.country_code, currency: line.currency_code, field: "cost_fixed" });
          onUpdate({ provider_fixed_id: pid || null, cost_fixed: cost });
        }}
        price={line.price_fixed}
        onPriceChange={(p) => onUpdate({ price_fixed: p })}
        cost={line.cost_fixed}
        onCostChange={(c) => onUpdate({ cost_fixed: c })}
        unit={line.currency_code}
      />
      <FeeRow
        label="Dispersión"
        included={line.has_dispersion}
        onIncludeChange={(v) => onUpdate({ has_dispersion: v })}
        providers={providers}
        providerId={line.provider_dispersion_id || ""}
        onProviderChange={(pid) => {
          const cost = findCost({ providerId: pid, service: "alternative_payment", subtype, country: line.country_code, currency: line.currency_code, field: "cost_dispersion" });
          onUpdate({ provider_dispersion_id: pid || null, cost_dispersion: cost });
        }}
        price={line.price_dispersion}
        onPriceChange={(p) => onUpdate({ price_dispersion: p })}
        cost={line.cost_dispersion}
        onCostChange={(c) => onUpdate({ cost_dispersion: c })}
        unit={line.currency_code}
      />

      <div className="flex justify-end mt-2">
        <button type="button" onClick={onRemove} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
          <Trash2 size={14} /> Eliminar línea
        </button>
      </div>
    </div>
  );
}

// ============= INTL LINE =============
function IntlLineCard({
  line, countries, currencies, payinProviders, payoutProviders, findCost, onUpdate, onRemove,
}: {
  line: IntlLine;
  countries: Country[];
  currencies: Currency[];
  payinProviders: Provider[];
  payoutProviders: Provider[];
  findCost: any;
  onUpdate: (patch: Partial<IntlLine>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-ink-200 rounded-xl p-4 bg-ink-50 dark:bg-ink-950/50">
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">País</label>
          <select className="input" value={line.country_code} onChange={(e) => {
            const c = countries.find((cc) => cc.code === e.target.value);
            onUpdate({ country_code: e.target.value, currency_code: c?.default_currency_code || line.currency_code });
          }}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Moneda</label>
          <select className="input" value={line.currency_code} onChange={(e) => onUpdate({ currency_code: e.target.value })}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>

      {/* Pay-In */}
      <div className="border border-ink-200 rounded-lg p-3 mb-3 bg-white dark:bg-ink-900">
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={line.has_payin} onChange={(e) => onUpdate({ has_payin: e.target.checked })} />
          <span className="text-sm font-medium text-ink-800 dark:text-ink-100">Pay-In</span>
        </label>
        {line.has_payin && (
          <>
            <FeeRow
              label="Pay-In variable (%)"
              included={true}
              compact
              providers={payinProviders}
              providerId={line.payin_provider_variable_id || ""}
              onProviderChange={(pid) => {
                const cost = findCost({ providerId: pid, service: "international_payin", country: line.country_code, currency: line.currency_code, field: "cost_variable" });
                onUpdate({ payin_provider_variable_id: pid || null, payin_cost_variable: cost });
              }}
              price={line.payin_price_variable}
              onPriceChange={(p) => onUpdate({ payin_price_variable: p })}
              cost={line.payin_cost_variable}
              onCostChange={(c) => onUpdate({ payin_cost_variable: c })}
              unit="%"
            />
            <FeeRow
              label="Pay-In fijo"
              included={true}
              compact
              providers={payinProviders}
              providerId={line.payin_provider_fixed_id || ""}
              onProviderChange={(pid) => {
                const cost = findCost({ providerId: pid, service: "international_payin", country: line.country_code, currency: line.currency_code, field: "cost_fixed" });
                onUpdate({ payin_provider_fixed_id: pid || null, payin_cost_fixed: cost });
              }}
              price={line.payin_price_fixed}
              onPriceChange={(p) => onUpdate({ payin_price_fixed: p })}
              cost={line.payin_cost_fixed}
              onCostChange={(c) => onUpdate({ payin_cost_fixed: c })}
              unit={line.currency_code}
            />
          </>
        )}
      </div>

      {/* Pay-Out */}
      <div className="border border-ink-200 rounded-lg p-3 mb-3 bg-white dark:bg-ink-900">
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={line.has_payout} onChange={(e) => onUpdate({ has_payout: e.target.checked })} />
          <span className="text-sm font-medium text-ink-800 dark:text-ink-100">Pay-Out</span>
        </label>
        {line.has_payout && (
          <>
            <FeeRow
              label="Pay-Out variable (%)"
              included={true}
              compact
              providers={payoutProviders}
              providerId={line.payout_provider_variable_id || ""}
              onProviderChange={(pid) => {
                const cost = findCost({ providerId: pid, service: "international_payout", country: line.country_code, currency: line.currency_code, field: "cost_variable" });
                onUpdate({ payout_provider_variable_id: pid || null, payout_cost_variable: cost });
              }}
              price={line.payout_price_variable}
              onPriceChange={(p) => onUpdate({ payout_price_variable: p })}
              cost={line.payout_cost_variable}
              onCostChange={(c) => onUpdate({ payout_cost_variable: c })}
              unit="%"
            />
            <FeeRow
              label="Pay-Out fijo"
              included={true}
              compact
              providers={payoutProviders}
              providerId={line.payout_provider_fixed_id || ""}
              onProviderChange={(pid) => {
                const cost = findCost({ providerId: pid, service: "international_payout", country: line.country_code, currency: line.currency_code, field: "cost_fixed" });
                onUpdate({ payout_provider_fixed_id: pid || null, payout_cost_fixed: cost });
              }}
              price={line.payout_price_fixed}
              onPriceChange={(p) => onUpdate({ payout_price_fixed: p })}
              cost={line.payout_cost_fixed}
              onCostChange={(c) => onUpdate({ payout_cost_fixed: c })}
              unit={line.currency_code}
            />
          </>
        )}
      </div>

      <div className="flex justify-end mt-2">
        <button type="button" onClick={onRemove} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
          <Trash2 size={14} /> Eliminar país
        </button>
      </div>
    </div>
  );
}

// ============= FEE ROW (shared) =============
// Soporta entrada bidireccional: el usuario puede escribir Precio (calcula margen)
// o Margen objetivo % (calcula precio). Fórmula:
//   margen (%) = (Precio − Costo) / Precio × 100
//   Precio    = Costo / (1 − margen/100)
function FeeRow({
  label, included, onIncludeChange, providers, providerId, onProviderChange,
  price, onPriceChange, cost, onCostChange, unit, compact,
}: {
  label: string;
  included: boolean;
  onIncludeChange?: (b: boolean) => void;
  providers: Provider[];
  providerId: string;
  onProviderChange: (id: string) => void;
  price: number | null | undefined;
  onPriceChange: (p: number | null) => void;
  cost: number | null | undefined;
  onCostChange: (c: number | null) => void;
  unit?: string;
  compact?: boolean;
}) {
  const computedMargin = margin(price ?? null, cost ?? null);
  const marginColor =
    computedMargin == null ? "text-ink-400" :
    computedMargin >= 30 ? "text-emerald-600" :
    computedMargin >= 0 ? "text-amber-600" : "text-red-600";
  const showCheckbox = !!onIncludeChange;
  const enabled = included;

  // Cuando el usuario escribe en el campo de margen objetivo,
  // recalculamos el precio sin tocar el costo.
  function handleMarginChange(value: string) {
    if (value === "" || cost == null) return;
    const targetMargin = Number(value);
    if (Number.isNaN(targetMargin)) return;
    if (targetMargin >= 100) return;            // división entre cero
    const newPrice = Number(cost) / (1 - targetMargin / 100);
    onPriceChange(Number(newPrice.toFixed(4)));
  }

  return (
    <div className={`grid md:grid-cols-12 gap-2 md:items-center py-3 md:py-2 ${!compact ? "border-t border-ink-100 dark:border-ink-800" : ""}`}>
      {/* Header de la fila */}
      <div className="md:col-span-3 flex items-center gap-2">
        {showCheckbox && (
          <input
            type="checkbox"
            className="w-5 h-5 md:w-4 md:h-4"
            checked={included}
            onChange={(e) => onIncludeChange!(e.target.checked)}
          />
        )}
        <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
      </div>

      {/* Controles: en mobile 2 columnas, en desktop 9 (proveedor 3 + costo/precio/margen 2 c/u) */}
      <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-9 gap-2">
        {/* Proveedor */}
        <div className="col-span-2 md:col-span-3">
          <label className="md:hidden block text-[11px] font-medium text-ink-500 dark:text-ink-400 mb-1">Proveedor</label>
          <select className="input" disabled={!enabled || providers.length === 0} value={providerId} onChange={(e) => onProviderChange(e.target.value)}>
            {providers.length === 0
              ? <option value="">— Sin proveedores para este servicio —</option>
              : <>
                  <option value="">— Proveedor —</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </>}
          </select>
        </div>

        {/* Costo */}
        <div className="md:col-span-2">
          <label className="md:hidden block text-[11px] font-medium text-ink-500 dark:text-ink-400 mb-1">
            Costo {unit && <span className="text-ink-400">({unit})</span>}
          </label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" step="0.0001"
              className="input pr-8"
              disabled={!enabled}
              value={cost ?? ""}
              onChange={(e) => onCostChange(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Costo"
              title="Costo del proveedor (puedes editarlo manualmente)"
            />
            {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-400 hidden md:inline">{unit}</span>}
          </div>
        </div>

        {/* Precio */}
        <div className="md:col-span-2">
          <label className="md:hidden block text-[11px] font-medium text-ink-500 dark:text-ink-400 mb-1">
            Precio {unit && <span className="text-ink-400">({unit})</span>}
          </label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" step="0.0001"
              className="input pr-8"
              disabled={!enabled}
              value={price ?? ""}
              onChange={(e) => onPriceChange(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Precio"
              title="Precio al cliente"
            />
            {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-400 hidden md:inline">{unit}</span>}
          </div>
        </div>

        {/* Margen */}
        <div className="md:col-span-2">
          <label className="md:hidden block text-[11px] font-medium text-ink-500 dark:text-ink-400 mb-1">Margen objetivo (%)</label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" step="0.01"
              className={`input pr-6 ${computedMargin != null ? marginColor : ""}`}
              disabled={!enabled}
              value={computedMargin != null ? computedMargin.toFixed(2) : ""}
              onChange={(e) => handleMarginChange(e.target.value)}
              placeholder="Margen"
              title="Escribe un margen objetivo y se calcula el precio"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-400">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
