"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const formatAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);

export default function PagosHistorialPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payouts");
      const payload = await response.json();
      if (payload.success) {
        setPayouts(payload.payouts || []);
      } else {
        setMessage(payload.error || "No pudimos cargar pagos");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos cargar pagos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <Link href="/pagos/pendientes" className="text-sm text-slate-500">
            Volver a pendientes
          </Link>
          <h1 className="text-3xl font-semibold text-slate-900">Historial de pagos</h1>
          <p className="text-sm text-slate-600">
            Lotes de pagos registrados con comprobantes.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha pago</th>
                <th className="px-4 py-3">Organizador</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3">Operador</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    Cargando...
                  </td>
                </tr>
              ) : payouts.length ? (
                payouts.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {item.paidAt?.slice(0, 10) ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.organizerName}
                      </div>
                      <div className="text-xs text-slate-400">{item.organizerId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatAmount(item.total ?? item.totalCents / 100)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.bankReference}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.paidBy}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No hay pagos registrados.
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
