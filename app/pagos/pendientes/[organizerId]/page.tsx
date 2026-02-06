"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);

export default function OrganizadorPendientePage() {
  const params = useParams<{ organizerId: string }>();
  const organizerId = params?.organizerId as string;
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPending = useCallback(async () => {
    if (!organizerId) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/payouts/pending?organizerId=${organizerId}`);
      const payload = await response.json();
      if (payload.success) {
        setPending(payload.pending || []);
        const allIds = new Set((payload.pending || []).map((item: any) => item.id));
        setSelected(allIds);
      } else {
        setMessage(payload.error || "No pudimos cargar operaciones");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos cargar operaciones");
    } finally {
      setLoading(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pending.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map((item) => item.id)));
    }
  };

  const selectedItems = useMemo(
    () => pending.filter((item) => selected.has(item.id)),
    [pending, selected],
  );

  const totalSelected = selectedItems.reduce(
    (sum, item) => sum + (item.amountCents ?? 0),
    0,
  );

  const handlePay = async () => {
    if (!bankReference || selected.size === 0) {
      setMessage("Seleccioná operaciones y cargá el comprobante.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId,
          reconciliationIds: Array.from(selected),
          bankReference,
          note,
          paidAt,
          paidBy,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setMessage(payload.error || "No pudimos registrar el pago");
      } else {
        setMessage("Pago registrado correctamente.");
        await loadPending();
        setBankReference("");
        setNote("");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos registrar el pago");
    } finally {
      setSubmitting(false);
    }
  };

  const organizerName = pending[0]?.organizerName ?? "Organizador";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/pagos/pendientes" className="text-sm text-slate-500">
                Volver a pendientes
              </Link>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                {organizerName}
              </h1>
              <p className="text-sm text-slate-600">{organizerId}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              Total seleccionado: {formatAmount(totalSelected / 100)}
            </div>
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
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-semibold text-slate-500"
                  >
                    {selected.size === pending.length ? "Quitar" : "Todos"}
                  </button>
                </th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tarjeta</th>
                <th className="px-4 py-3">Importe</th>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Tx</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Cargando...
                  </td>
                </tr>
              ) : pending.length ? (
                pending.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.opDate}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.cardBrand?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatAmount((item.amountCents ?? 0) / 100)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.orderId ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.transactionId ?? "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No hay operaciones pendientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Registrar pago</h2>
          <p className="mt-1 text-sm text-slate-500">
            Esto marcará {selected.size} operaciones como pagadas.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Comprobante / bankReference
              </label>
              <input
                type="text"
                value={bankReference}
                onChange={(event) => setBankReference(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Fecha de pago
              </label>
              <input
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Operador
              </label>
              <input
                type="text"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Nota
              </label>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handlePay}
            disabled={submitting || selected.size === 0}
            className={`mt-4 rounded-full px-6 py-3 text-sm font-semibold ${
              submitting || selected.size === 0
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-[#B1C20E] text-black hover:bg-[#c7da1a]"
            }`}
          >
            {submitting ? "Registrando..." : "Registrar pago"}
          </button>
        </section>
      </div>
    </div>
  );
}
