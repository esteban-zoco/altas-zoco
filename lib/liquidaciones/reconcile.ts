import { randomUUID } from "crypto";

import { getOrder } from "./orders";
import {
  CsvTransaction,
  OrganizerSummary,
  Reconciliation,
  ReconciliationSummary,
  SettlementImport,
  SettlementLine,
} from "./types";
import { parseAmount, toNumberKey, unique } from "./utils";

const buildKey = (date: string, last4: string, amount: number) =>
  `${date}|${last4}|${toNumberKey(amount)}`;

const debugEnabled = process.env.DEBUG_LIQUIDACIONES !== "false";
const debug = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

const deriveAlternateCombos = (line: SettlementLine) => {
  const rawLine = line.rawLine || "";
  const tailMatch = rawLine.match(/([0-9.,]+)$/);
  if (!tailMatch) return [];

  const tail = tailMatch[1];
  const decimalMatch = tail.match(/[.,]\d{2}$/);
  if (!decimalMatch) return [];

  const decimals = tail.slice(tail.length - 3); // includes separator
  const integerPart = tail.slice(0, -3).replace(/[.,]/g, "");
  if (!integerPart) return [];

  const combos: { last4: string; amount: number }[] = [];
  const lengths = [1, 2, 3, 4, 5];

  for (const len of lengths) {
    if (integerPart.length <= len) continue;
    const amountDigits = integerPart.slice(-len);
    const prefixDigits = integerPart.slice(0, -len);
    if (prefixDigits.length < 4) continue;
    const last4 = prefixDigits.slice(-4);
    const amount = parseAmount(`${amountDigits}${decimals}`);
    combos.push({ last4, amount });
  }

  return combos;
};

const refineMatches = (
  line: SettlementLine,
  matches: CsvTransaction[],
): CsvTransaction[] => {
  let refined = matches;
  type RefinerKey = "terminal" | "lote" | "cupon";
  const refiners: RefinerKey[] = ["terminal", "lote", "cupon"];

  for (const key of refiners) {
    const lineValue = line[key];
    if (!lineValue) continue;
    const candidates = refined.filter((item) => Boolean(item[key]));
    if (!candidates.length) continue;
    const exact = candidates.filter(
      (item) => String(item[key]) === String(lineValue),
    );
    if (exact.length) {
      refined = exact;
    }
  }

  const getSuffix = (value: string, length: number) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (digits.length < length) return "";
    return digits.slice(-length);
  };

  const cuponSuffix = getSuffix(line.cupon, 2);
  if (cuponSuffix) {
    const withSuffix = refined.filter(
      (item) => getSuffix(item.transactionId, 2) === cuponSuffix,
    );
    if (withSuffix.length) {
      refined = withSuffix;
      debug("[liquidaciones][reconcile] refine by cupon suffix", {
        cupon: line.cupon,
        cuponSuffix,
        before: matches.length,
        after: refined.length,
      });
    }
  }

  return refined;
};

export const reconcileLines = async (
  lines: SettlementLine[],
  transactions: CsvTransaction[],
  csvImportId?: string,
  pdfImportId?: string,
): Promise<Reconciliation[]> => {
  const grouped = new Map<string, CsvTransaction[]>();

  for (const transaction of transactions) {
    const key = buildKey(transaction.date, transaction.last4, transaction.amount);
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  const usedTransactions = new Set<string>();
  const reconciliations: Reconciliation[] = [];

  for (const line of lines) {
    const key = buildKey(line.fechaOperacion, line.last4, line.amount);
    const matches = grouped.get(key) ?? [];

    if (matches.length === 0) {
      let alternateResolved = false;
      const alternates = deriveAlternateCombos(line);
      if (alternates.length) {
        debug("[liquidaciones][reconcile] alternates", {
          rawLine: line.rawLine,
          date: line.fechaOperacion,
          baseLast4: line.last4,
          baseAmount: line.amount,
          alternates,
        });
      }

      for (const alt of alternates) {
        const altKey = buildKey(line.fechaOperacion, alt.last4, alt.amount);
        const altMatches = grouped.get(altKey) ?? [];

        if (altMatches.length === 0) continue;

        if (altMatches.length > 1) {
          reconciliations.push({
            id: randomUUID(),
            csvImportId,
            pdfImportId,
            settlementLineId: line.id,
            status: "ambiguo",
            reason: "Multiples transacciones con misma fecha, last4 e importe (heuristica)",
            amount: alt.amount,
            date: line.fechaOperacion,
        cupon: line.cupon,
        last4: alt.last4,
          });
          alternateResolved = true;
          break;
        }

        const match = altMatches[0];
        if (usedTransactions.has(match.id)) {
          reconciliations.push({
            id: randomUUID(),
            csvImportId,
            pdfImportId,
            settlementLineId: line.id,
            status: "ambiguo",
            reason: "La transaccion ya se uso en otra linea (heuristica)",
            amount: alt.amount,
            date: line.fechaOperacion,
        cupon: line.cupon,
        last4: alt.last4,
            csvTransactionId: match.id,
            orderId: match.orderId,
            transactionId: match.transactionId,
          });
          alternateResolved = true;
          break;
        }

        usedTransactions.add(match.id);
        const orderInfo = await getOrder(match.orderId);

        reconciliations.push({
          id: randomUUID(),
          csvImportId,
          pdfImportId,
          settlementLineId: line.id,
          status: "conciliado",
          reason: "Conciliado con heuristica de PDF",
          amount: alt.amount,
          date: line.fechaOperacion,
        cupon: line.cupon,
        last4: alt.last4,
          csvTransactionId: match.id,
          orderId: match.orderId,
          transactionId: match.transactionId,
          organizerId: orderInfo?.organizerId ?? "UNKNOWN",
          organizerName: orderInfo?.organizerName ?? "Organizador sin definir",
          eventId: orderInfo?.eventId,
        });
        alternateResolved = true;
        break;
      }

      if (!alternateResolved) {
        reconciliations.push({
          id: randomUUID(),
          csvImportId,
          pdfImportId,
          settlementLineId: line.id,
          status: "sin_match",
          reason: "No se encontro transaccion con misma fecha, last4 e importe",
          amount: line.amount,
          date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
        });
      }
      continue;
    }

    if (matches.length > 1) {
      const refined = refineMatches(line, matches);
      if (refined.length === 1) {
        const match = refined[0];
        if (usedTransactions.has(match.id)) {
          reconciliations.push({
            id: randomUUID(),
            csvImportId,
            pdfImportId,
            settlementLineId: line.id,
            status: "ambiguo",
            reason: "La transaccion ya se uso en otra linea (refinadores)",
            amount: line.amount,
            date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
            csvTransactionId: match.id,
            orderId: match.orderId,
            transactionId: match.transactionId,
          });
          continue;
        }

        usedTransactions.add(match.id);
        const orderInfo = await getOrder(match.orderId);

        reconciliations.push({
          id: randomUUID(),
          csvImportId,
          pdfImportId,
          settlementLineId: line.id,
          status: "conciliado",
          reason: "Conciliado con refinadores (terminal/lote/cupon)",
          amount: line.amount,
          date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
          csvTransactionId: match.id,
          orderId: match.orderId,
          transactionId: match.transactionId,
          organizerId: orderInfo?.organizerId ?? "UNKNOWN",
          organizerName: orderInfo?.organizerName ?? "Organizador sin definir",
          eventId: orderInfo?.eventId,
        });
        continue;
      }

      reconciliations.push({
        id: randomUUID(),
        csvImportId,
        pdfImportId,
        settlementLineId: line.id,
        status: "ambiguo",
        reason: "Multiples transacciones con misma fecha, last4 e importe",
        amount: line.amount,
        date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
      });
      continue;
    }

    const match = matches[0];
    if (usedTransactions.has(match.id)) {
      reconciliations.push({
        id: randomUUID(),
        csvImportId,
        pdfImportId,
        settlementLineId: line.id,
        status: "ambiguo",
        reason: "La transaccion ya se uso en otra linea",
        amount: line.amount,
        date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
        csvTransactionId: match.id,
        orderId: match.orderId,
        transactionId: match.transactionId,
      });
      continue;
    }

    usedTransactions.add(match.id);

    const orderInfo = await getOrder(match.orderId);

    reconciliations.push({
      id: randomUUID(),
      csvImportId,
      pdfImportId,
      settlementLineId: line.id,
      status: "conciliado",
      amount: line.amount,
      date: line.fechaOperacion,
        cupon: line.cupon,
        last4: line.last4,
      csvTransactionId: match.id,
      orderId: match.orderId,
      transactionId: match.transactionId,
      organizerId: orderInfo?.organizerId ?? "UNKNOWN",
      organizerName: orderInfo?.organizerName ?? "Organizador sin definir",
      eventId: orderInfo?.eventId,
    });
  }

  return reconciliations;
};

export const buildSummary = (
  reconciliations: Reconciliation[],
  csvImport: SettlementImport | null,
  pdfImport: SettlementImport | null,
  pdfTotal: number | null,
  currencyARS: boolean,
): ReconciliationSummary => {
  const reconciled = reconciliations.filter((item) => item.status === "conciliado");
  const sinMatch = reconciliations.filter((item) => item.status === "sin_match");
  const ambiguo = reconciliations.filter((item) => item.status === "ambiguo");
  const reconciledTotal = reconciled.reduce((sum, item) => sum + item.amount, 0);

  const byOrganizerMap = new Map<string, OrganizerSummary>();

  for (const item of reconciled) {
    const organizerId = item.organizerId ?? "UNKNOWN";
    const organizerName = item.organizerName ?? "Organizador sin definir";
    const existing = byOrganizerMap.get(organizerId) ?? {
      organizerId,
      organizerName,
      totalAmount: 0,
      orderIds: [],
      transactionIds: [],
      reconciledCount: 0,
    };

    existing.totalAmount += item.amount;
    if (item.orderId) existing.orderIds.push(item.orderId);
    if (item.transactionId) existing.transactionIds.push(item.transactionId);
    existing.reconciledCount += 1;
    byOrganizerMap.set(organizerId, existing);
  }

  const byOrganizer = Array.from(byOrganizerMap.values()).map((item) => ({
    ...item,
    orderIds: unique(item.orderIds),
    transactionIds: unique(item.transactionIds),
    totalAmount: Number(item.totalAmount.toFixed(2)),
  }));

  const pdfTotalMatches = pdfTotal
    ? Math.abs(pdfTotal - reconciledTotal) < 0.01
    : null;

  return {
    csvImport,
    pdfImport,
    totals: {
      settlementLines: reconciliations.length,
      csvTransactions: csvImport?.rowCount ?? 0,
      reconciled: reconciled.length,
      sinMatch: sinMatch.length,
      ambiguo: ambiguo.length,
    },
    validations: {
      currencyARS,
      pdfTotal: pdfTotal ?? null,
      reconciledTotal: Number(reconciledTotal.toFixed(2)),
      pdfTotalMatches,
    },
    canGeneratePayments:
      reconciliations.length > 0 && sinMatch.length === 0 && ambiguo.length === 0,
    reconciliations,
    byOrganizer,
  };
};

