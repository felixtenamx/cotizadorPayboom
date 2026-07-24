"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Edit2, Trash2, Copy, X, Search } from "lucide-react";

type Cost = {
  id: string;
  provider_id: string;
  provider?: { name: string } | null;
  service_type: string;
  subtype: string | null;
  country_code: string | null;
  currency_code: string;
  cost_variable: number | null;
  cost_fixed: number | null;
  cost_chargeback: number | null;
  cost_refund: number | null;
  cost_dispersion: number | null;
  settlement_time: string | null;
  notes: string | null;
};

type Provider = { id: string; name: string };
type Country = { code: string; name: string };
type Currency = { code: string };

type Props = {
  costs: Cost[];
  providers: Provider[];
  countries: Country[];
  currencies: Currency[];
  editId?: string;
  deleteAction: (fd: FormData) => Promise<void>;
  duplicateAction: (fd: FormData) => Promise<void>;
};

const SERVICE_LABELS: Record<string, string> = {
  card_processing: "Tarjetas",
  alternative_payment: "Alt. (SPEI/OXXO)",
  international_payin: "Pay-In Intl.",
  international_payout: "Pay-Out Intl.",
};

const SERVICE_OPTIONS = [
  { value: "card_processing", label: "Tarjetas" },
  { value: "alternative_payment", label: "Alt. (SPEI/OXXO)" },
  { value: "international_payin", label: "Pay-In Intl." },
  { value: "international_payout", label: "Pay-Out Intl." },
];

export default function CostsExplorer({
  costs,
  providers,
  countries,
  currencies,
  editId,
  deleteAction,
  duplicateAction,
}: Props) {
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return costs.filter((c) => {
      if (providerFilter && c.provider_id !== providerFilter) return false;
      if (serviceFilter && c.service_type !== serviceFilter) return false;
      if (countryFilter && c.country_code !== countryFilter) return false;
      if (currencyFilter && c.currency_code !== currencyFilter) return false;
      if (q) {
        const haystack = [
          c.provider?.name,
          c.subtype,
          c.notes,
          c.country_code,
          c.currency_code,
          SERVICE_LABELS[c.service_type],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [costs, providerFilter, serviceFilter, countryFilter, currencyFilter, search]);

  // Agrupado por proveedor, ordenado por nombre
  const grouped = useMemo(() => {
    const map = new Map<string, { provider: Provider; rows: Cost[] }>();
    for (const c of filtered) {
      const provider = providers.find((p) => p.id === c.provider_id) || {
        id: c.provider_id,
        name: c.provider?.name || "Proveedor desconocido",
      };
      if (!map.has(provider.id)) map.set(provider.id, { provider, rows: [] });
      map.get(provider.id)!.rows.push(c);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.provider.name.localeCompare(b.provider.name, "es")
    );
  }, [filtered, providers]);

  const hasActiveFilter =
    providerFilter || serviceFilter || countryFilter || currencyFilter || search;

  function clearFilters() {
    setProviderFilter("");
    setServiceFilter("");
    setCountryFilter("");
    setCurrencyFilter("");
    setSearch("");
  }

  function toggleProvider(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(grouped.map((g) => g.provider.id)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="card-pad space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-200">
          <Search size={16} />
          <span>Filtros</span>
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto btn-ghost text-xs"
              title="Limpiar filtros"
            >
              <X size={12} /> Limpiar
            </button>
          ) : null}
        </div>

        <div className="grid md:grid-cols-5 gap-2">
          <input
            type="text"
            className="input"
            placeholder="Buscar por proveedor, subtipo, notas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="">Todos los servicios</option>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="">Todos los países</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="">Todas las monedas</option>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
          <span>
            {filtered.length} {filtered.length === 1 ? "costo" : "costos"} en{" "}
            {grouped.length} {grouped.length === 1 ? "proveedor" : "proveedores"}
          </span>
          {grouped.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={expandAll} className="hover:underline">
                Expandir todo
              </button>
              <span>·</span>
              <button type="button" onClick={collapseAll} className="hover:underline">
                Colapsar todo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resultados agrupados */}
      {grouped.length === 0 ? (
        <div className="card-pad text-center text-sm text-ink-500 dark:text-ink-400">
          {costs.length === 0
            ? "Sin costos cargados. Usa el formulario de arriba para crear el primero."
            : "Ningún costo coincide con los filtros aplicados."}
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ provider, rows }) => {
            const isOpen = expanded.has(provider.id);
            return (
              <div key={provider.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleProvider(provider.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800 text-left"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-semibold text-ink-900 dark:text-ink-50">
                    {provider.name}
                  </span>
                  <span className="chip-ink ml-2">
                    {rows.length} {rows.length === 1 ? "costo" : "costos"}
                  </span>
                  <span className="ml-auto text-xs text-ink-500 dark:text-ink-400 hidden md:inline">
                    {summarizeServices(rows)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-ink-100 dark:border-ink-800 overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead className="bg-ink-50 dark:bg-ink-800 text-ink-600 dark:text-ink-300 text-xs">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Servicio</th>
                          <th className="text-left px-3 py-2 font-medium">Subtipo</th>
                          <th className="text-left px-3 py-2 font-medium">País</th>
                          <th className="text-left px-3 py-2 font-medium">Mon.</th>
                          <th className="text-right px-3 py-2 font-medium">Var %</th>
                          <th className="text-right px-3 py-2 font-medium">Fijo</th>
                          <th className="text-right px-3 py-2 font-medium">CB</th>
                          <th className="text-right px-3 py-2 font-medium">Refund</th>
                          <th className="text-right px-3 py-2 font-medium">Disp.</th>
                          <th className="text-left px-3 py-2 font-medium">Liq.</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                        {rows.map((c) => (
                          <tr
                            key={c.id}
                            className={editId === c.id ? "bg-amber-50 dark:bg-amber-900/20" : ""}
                          >
                            <td className="px-3 py-2">{SERVICE_LABELS[c.service_type] || c.service_type}</td>
                            <td className="px-3 py-2">{c.subtype || "—"}</td>
                            <td className="px-3 py-2">{c.country_code || "—"}</td>
                            <td className="px-3 py-2 font-mono">{c.currency_code}</td>
                            <td className="px-3 py-2 text-right">{c.cost_variable ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{c.cost_fixed ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{c.cost_chargeback ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{c.cost_refund ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{c.cost_dispersion ?? "—"}</td>
                            <td className="px-3 py-2">{c.settlement_time || "—"}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                <Link
                                  href={
                                    editId === c.id
                                      ? "/admin/costos"
                                      : `/admin/costos?edit=${c.id}`
                                  }
                                  className="btn-ghost text-xs"
                                  title={editId === c.id ? "Cancelar edición" : "Editar"}
                                >
                                  {editId === c.id ? <X size={14} /> : <Edit2 size={14} />}
                                </Link>
                                <form action={duplicateAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <button
                                    type="submit"
                                    className="btn-ghost text-xs"
                                    title="Duplicar"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </form>
                                <form action={deleteAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <button
                                    type="submit"
                                    className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function summarizeServices(rows: Cost[]): string {
  const set = new Set(rows.map((r) => SERVICE_LABELS[r.service_type] || r.service_type));
  return Array.from(set).join(" · ");
}
