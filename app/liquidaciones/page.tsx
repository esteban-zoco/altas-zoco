"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const statusStyles: Record<string, string> = {
  imported: "bg-slate-50 text-slate-600 border-slate-200",
  reconciled: "bg-slate-50 text-slate-600 border-slate-200",
  ready_to_pay: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_review: "bg-rose-50 text-rose-700 border-rose-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-slate-100 text-slate-700 border-slate-200",
};
const statusLabels: Record<string, string> = {
  imported: "Importada",
  reconciled: "Conciliada",
  ready_to_pay: "Lista para pagar",
  needs_review: "Requiere revisión",
  partial: "Pago parcial",
  paid: "Pagada",
};

const formatAmount = (value?: number | null) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value ?? 0);

const toReadableDate = (value: string | null) => value ?? "-";

const cardOptions = ["visa", "mastercard", "amex", "otros"];
const statusOptions = [
  "imported",
  "reconciled",
  "ready_to_pay",
  "needs_review",
  "partial",
  "paid",
];

export default function LiquidacionesPage() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    cardBrand: "",
    status: "",
  });

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.cardBrand) params.set("cardBrand", filters.cardBrand);
      if (filters.status) params.set("status", filters.status);

      const response = await fetch(`/api/settlements?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) {
        setSettlements(payload.settlements || []);
      } else {
        setMessage(payload.error || "No pudimos cargar liquidaciones");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos cargar liquidaciones");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const summary = useMemo(() => {
    const total = settlements.length;
    const ready = settlements.filter((item) => item.status === "ready_to_pay").length;
    const review = settlements.filter((item) => item.status === "needs_review").length;
    return { total, ready, review };
  }, [settlements]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Operaciones diarias
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Liquidaciones Fiserv
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Carga diaria por tarjeta, conciliación automática y control de pagos
                con auditoría. Si hay sin_match o ambiguas, se bloquea el pago.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/pagos/pendientes"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Pendientes de pago
              </Link>
              <Link
                href="/liquidaciones/nueva"
                className="inline-flex items-center justify-center rounded-full bg-[#B1C20E] px-6 py-3 text-sm font-semibold text-black hover:bg-[#c7da1a]"
              >
                Nueva liquidación
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Total
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.total}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Listas para pagar
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                {summary.ready}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Requieren revisión
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">
                {summary.review}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Desde
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, from: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Hasta
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, to: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Tarjeta
              </label>
              <select
                value={filters.cardBrand}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, cardBrand: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {cardOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Estado
              </label>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {(statusLabels[option] ?? option).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={loadSettlements}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Actualizar
            </button>
          </div>
          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
        </header>

        <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tarjeta</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Total PDF</th>
                <th className="px-4 py-3">Creada por</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Cargando liquidaciones...
                  </td>
                </tr>
              ) : settlements.length ? (
                settlements.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {toReadableDate(item.liquidationDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.cardBrand?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          statusStyles[item.status] || statusStyles.imported
                        }`}
                      >
                        {statusLabels[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatAmount(item.totals?.grossCents ? item.totals.grossCents / 100 : 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.createdBy || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/liquidaciones/${item.id}`}
                        className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No hay liquidaciones cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
