"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const cardOptions = ["visa", "mastercard", "amex", "otros"];

const formatAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);

export default function PagosPendientesPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", cardBrand: "" });

  const loadPending = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.cardBrand) params.set("cardBrand", filters.cardBrand);

      const response = await fetch(`/api/payouts/pending?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) {
        setPending(payload.pending || []);
      } else {
        setMessage(payload.error || "No pudimos cargar pendientes");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos cargar pendientes");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/liquidaciones" className="text-sm text-slate-500">
                Volver a liquidaciones
              </Link>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Pagos pendientes
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Operaciones reconciliadas listas para registrar pago.
              </p>
            </div>
            <Link
              href="/pagos/historial"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Ver historial de pagos
            </Link>
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
            <button
              type="button"
              onClick={loadPending}
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
                <th className="px-4 py-3">Organizador</th>
                <th className="px-4 py-3">Total pendiente</th>
                <th className="px-4 py-3">Operaciones</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Cargando...
                  </td>
                </tr>
              ) : pending.length ? (
                pending.map((item) => (
                  <tr key={item.organizerId} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.organizerName}
                      </div>
                      <div className="text-xs text-slate-400">{item.organizerId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatAmount(item.total ?? item.totalCents / 100)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.count}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/pagos/pendientes/${item.organizerId}`}
                        className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                      >
                        Ver operaciones
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    No hay pagos pendientes.
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
