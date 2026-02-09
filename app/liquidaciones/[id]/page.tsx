"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const statusStyles: Record<string, string> = {
  reconciled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_review: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-slate-100 text-slate-700 border-slate-200",
  excluded: "bg-slate-50 text-slate-500 border-slate-200",
};

const settlementStatusStyles: Record<string, string> = {
  ready_to_pay: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_review: "bg-rose-50 text-rose-700 border-rose-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-slate-100 text-slate-700 border-slate-200",
  imported: "bg-slate-50 text-slate-600 border-slate-200",
  reconciled: "bg-slate-50 text-slate-600 border-slate-200",
};
const statusLabels: Record<string, string> = {
  imported: "Importada",
  reconciled: "Conciliada",
  ready_to_pay: "Lista para pagar",
  needs_review: "Requiere revisión",
  partial: "Pago parcial",
  paid: "Pagada",
  excluded: "Agrupada",
};

const formatAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);

const getLastDigits = (value: string | undefined, length = 2) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length < length) return "";
  return digits.slice(-length);
};

export default function LiquidacionDetallePage() {
  const params = useParams<{ id: string }>();
  const settlementId = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [operator, setOperator] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [detailExpandedKeys, setDetailExpandedKeys] = useState<Set<string>>(new Set());

  const loadDetail = useCallback(async () => {
    if (!settlementId) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/settlements/${settlementId}`);
      const payload = await response.json();
      if (payload.success) {
        setData(payload);
      } else {
        setMessage(payload.error || "No pudimos cargar el detalle");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos cargar el detalle");
    } finally {
      setLoading(false);
    }
  }, [settlementId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleReconcile = async () => {
    if (!settlementId) return;
    setReconciling(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/settlements/${settlementId}/reconcile`, {
        method: "POST",
        headers: operator ? { "x-user": operator } : undefined,
      });
      const payload = await response.json();
      if (!payload.success) {
        setMessage(payload.error || "No pudimos reconciliar");
      } else {
        await loadDetail();
        setMessage("Reconciliación actualizada.");
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos reconciliar");
    } finally {
      setReconciling(false);
    }
  };

  const settlement = data?.settlement;
  const totals = data?.totals;
  const validations = data?.validations;
  const reconciliations = data?.reconciliations ?? [];
  const canPay = data?.canGeneratePayments;

  const buildGroupKey = (item: any) =>
    `${item.opDate}|${item.last4}|${item.cupon ?? ""}`;

  const buildDetailKey = (item: any) => `${item.id}`;

  const excludedGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of reconciliations) {
      if (item.status !== "excluded") continue;
      const key = buildGroupKey(item);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return map;
  }, [reconciliations]);

  const mainRows = useMemo(
    () => reconciliations.filter((item: any) => item.status !== "excluded"),
    [reconciliations],
  );

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDetail = (key: string) => {
    setDetailExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatCuotaLabel = (numero?: number | null, total?: number | null) => {
    if (!total || total <= 0) return "";
    if (!numero || numero <= 0) return `${total}`;
    return `${numero}/${total}`;
  };

  const getInstallmentDetails = (item: any, grouped: any[]) => {
    const all = [item, ...grouped];
    const cuotaTotal =
      item.cuotaTotal ??
      all.find((line) => typeof line.cuotaTotal === "number")?.cuotaTotal ??
      null;
    const cuotas = all
      .filter((line) => typeof line.cuotaNumero === "number" && line.cuotaNumero > 0)
      .map((line) => ({
        numero: line.cuotaNumero as number,
        total: (line.cuotaTotal ?? cuotaTotal) as number | null,
        amountCents: line.amountCents ?? null,
      }))
      .sort((a, b) => a.numero - b.numero);

    return { cuotaTotal, cuotas };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/liquidaciones" className="text-sm text-slate-500">
                Volver al historial
              </Link>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Liquidación {settlement?.liquidationDate ?? ""}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {settlement?.cardBrand?.toUpperCase()} · {settlement?.sourcePdfFilename}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href="/pagos/pendientes"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Pendientes
              </Link>
              <button
                type="button"
                disabled={!canPay}
                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${
                  canPay
                    ? "bg-[#B1C20E] text-black"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
              >
                {canPay ? "Lista para pagar" : "Bloqueada"}
              </button>
            </div>
          </div>

          {settlement ? (
            <div className="flex flex-wrap gap-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  settlementStatusStyles[settlement.status] ||
                  settlementStatusStyles.imported
                }`}
              >
                {statusLabels[settlement.status] ?? settlement.status}
              </span>
              {settlement.liquidationNumber ? (
                <span className="text-xs text-slate-500">
                  Nro. Liquidación: {settlement.liquidationNumber}
                </span>
              ) : null}
              <span className="text-xs text-slate-500">
                Creado por: {settlement.createdBy}
              </span>
            </div>
          ) : null}

          {settlement?.status === "needs_review" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Esta liquidación requiere revisión. No se puede registrar pago.
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lineas</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {totals?.settlementLines ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Conciliadas
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-600">
              {totals?.reconciled ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sin match</p>
            <p className="mt-2 text-xl font-semibold text-amber-600">
              {totals?.sinMatch ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ambiguas</p>
            <p className="mt-2 text-xl font-semibold text-rose-600">
              {totals?.ambiguo ?? 0}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Validaciones</p>
              <p className="text-xs text-slate-500">
                Moneda ARS: {validations?.currencyARS ? "OK" : "Revisar"}
              </p>
              <p className="text-xs text-slate-500">
                Total conciliado: {formatAmount((validations?.reconciledTotal ?? 0) / 100)}
              </p>
              <p className="text-xs text-slate-500">
                Total PDF:{" "}
                {typeof validations?.pdfTotal === "number"
                  ? formatAmount(validations.pdfTotal / 100)
                  : "No disponible"}{" "}
                ({validations?.pdfTotalMatches ? "OK" : "Revisar"})
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder="Operador"
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling}
                className={`rounded-full px-5 py-2 text-sm font-semibold ${
                  reconciling
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-slate-900 text-white"
                }`}
              >
                {reconciling ? "Reconciliando..." : "Reconciliar"}
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Last4</th>
                <th className="px-4 py-3">Importe</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cupón / Tx</th>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Organizador</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : mainRows.length ? (
                mainRows.map((item: any) => {
                  const cuponDigits = getLastDigits(item.cupon, 2);
                  const txDigits = getLastDigits(item.transactionId, 2);
                  const hasMatch = Boolean(cuponDigits && txDigits);
                  const matches = hasMatch ? cuponDigits === txDigits : false;
                  const matchLabel = hasMatch ? `${cuponDigits}/${txDigits}` : "-";
                  const groupKey = buildGroupKey(item);
                  const grouped = excludedGroups.get(groupKey) ?? [];
                  const isExpanded = expandedKeys.has(groupKey);
                  const detailKey = buildDetailKey(item);
                  const detailExpanded = detailExpandedKeys.has(detailKey);
                  const installmentDetails = getInstallmentDetails(item, grouped);
                  const cuotaLabel = formatCuotaLabel(
                    item.cuotaNumero,
                    item.cuotaTotal,
                  );
                  const shouldShowDetailButton = Boolean(item.isInstallment);

                  return (
                    <>
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{item.opDate}</td>
                        <td className="px-4 py-3 text-slate-700">{item.last4}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatAmount((item.amountCents ?? 0) / 100)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              statusStyles[item.status] || statusStyles.needs_review
                            }`}
                          >
                            {statusLabels[item.status] ?? item.status}
                          </span>
                          {item.reason ? (
                            <p className="mt-1 text-xs text-slate-400">{item.reason}</p>
                          ) : null}
                          {shouldShowDetailButton ? (
                            <button
                              type="button"
                              onClick={() => toggleDetail(detailKey)}
                              className="mt-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                              {detailExpanded ? "Ocultar detalles" : "Ver detalles"}
                            </button>
                          ) : null}
                          {grouped.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKey)}
                              className="mt-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                              {isExpanded
                                ? `Ocultar cuotas (${grouped.length})`
                                : `Ver cuotas (${grouped.length})`}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="text-xs text-slate-500">
                            Cupón: {item.cupon || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Tx: {item.transactionId || "-"}
                          </div>
                          <div
                            className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              !hasMatch
                                ? "border-slate-200 text-slate-400"
                                : matches
                                  ? "border-emerald-200 text-emerald-600"
                                  : "border-rose-200 text-rose-600"
                            }`}
                          >
                            {hasMatch
                              ? matches
                                ? "COINCIDE"
                                : "NO COINCIDE"
                              : "SIN DATOS"}{" "}
                            {matchLabel !== "-" ? `(${matchLabel})` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.orderId ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.organizerName ?? "-"}
                        </td>
                      </tr>
                      {detailExpanded ? (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="px-4 py-3 text-slate-500" colSpan={7}>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                              <div>
                                <span className="font-semibold text-slate-600">
                                  Cuotas:
                                </span>{" "}
                                {cuotaLabel || installmentDetails.cuotaTotal
                                  ? cuotaLabel || `${installmentDetails.cuotaTotal}`
                                  : "Sin datos"}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-600">
                                  Monto cuota:
                                </span>{" "}
                                {item.pdfAmountCents
                                  ? formatAmount(item.pdfAmountCents / 100)
                                  : "Sin datos"}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-600">
                                  Plan:
                                </span>{" "}
                                {item.planCuota ?? "-"}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-600">
                                  Terminal/Lote:
                                </span>{" "}
                                {item.terminal ?? "-"} / {item.lote ?? "-"}
                              </div>
                            </div>
                            {installmentDetails.cuotas.length ? (
                              <div className="mt-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-600">
                                  Detalle cuotas:
                                </span>{" "}
                                {installmentDetails.cuotas
                                  .map((cuota) => {
                                    const label = formatCuotaLabel(
                                      cuota.numero,
                                      cuota.total,
                                    );
                                    const amount = cuota.amountCents
                                      ? formatAmount(cuota.amountCents / 100)
                                      : null;
                                    return amount ? `${label} (${amount})` : label;
                                  })
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                      {isExpanded
                        ? grouped.map((detail) => (
                            <tr
                              key={`${detail.id}-detail`}
                              className="border-b border-slate-100 bg-slate-50"
                            >
                              <td className="px-4 py-3 text-slate-500">
                                {detail.opDate}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {detail.last4}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {formatAmount((detail.amountCents ?? 0) / 100)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                    statusStyles[detail.status] ||
                                    statusStyles.needs_review
                                  }`}
                                >
                                  {statusLabels[detail.status] ?? detail.status}
                                </span>
                                {detail.reason ? (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {detail.reason}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                <div className="text-xs text-slate-500">
                                  Cupón: {detail.cupon || "-"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Tx: {detail.transactionId || "-"}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {detail.orderId ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {detail.organizerName ?? "-"}
                              </td>
                            </tr>
                          ))
                        : null}
                    </>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No hay líneas conciliadas.
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

