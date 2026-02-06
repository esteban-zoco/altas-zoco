import { ObjectId } from "mongodb";

import { getOrder } from "./orders";
import { FiservTransactionDoc, ReconciliationDoc, SettlementLineDoc } from "./dbTypes";

const CUOTA_TOKEN_REGEX = /\b(\d{1,2})\/(\d{1,2})\b(?!\/\d{4})/g;

const buildKey = (
  opDate: string,
  last4: string,
  amountCents: number,
  cupon?: string | null,
) => {
  const base = `${opDate}|${last4}|${amountCents}`;
  if (cupon) return `${base}|${cupon}`;
  return base;
};

const getCuponSuffix = (value?: string | null) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 2) return "";
  return digits.slice(-2);
};

const extractCuotaInfo = (line: SettlementLineDoc) => {
  const fromLine = {
    numero: line.cuotaNumero ?? null,
    total: line.cuotaTotal ?? null,
  };
  if (fromLine.total && fromLine.total > 1) return fromLine;

  const raw = line.rawLine ?? "";
  CUOTA_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  let best: { numero: number; total: number; score: number } | null = null;
  while ((match = CUOTA_TOKEN_REGEX.exec(raw)) !== null) {
    const numero = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(numero) || !Number.isFinite(total)) continue;
    if (total <= 1 || total > 60) continue;
    if (numero < 0 || numero > total) continue;
    const score = total * 100 + (60 - Math.abs(numero - 1));
    if (!best || score > best.score) {
      best = { numero, total, score };
    }
  }
  if (!best) return { numero: null, total: null };
  return { numero: best.numero, total: best.total };
};

export const reconcileSettlement = async ({
  settlementId,
  lines,
  transactions,
  matchedBy,
}: {
  settlementId: ObjectId;
  lines: SettlementLineDoc[];
  transactions: FiservTransactionDoc[];
  matchedBy: string;
}): Promise<ReconciliationDoc[]> => {
  const grouped = new Map<string, FiservTransactionDoc[]>();
  const groupedByCupon = new Map<string, FiservTransactionDoc[]>();
  const addToGroup = (key: string, transaction: FiservTransactionDoc) => {
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  };
  const addToCuponGroup = (key: string, transaction: FiservTransactionDoc) => {
    const bucket = groupedByCupon.get(key) ?? [];
    bucket.push(transaction);
    groupedByCupon.set(key, bucket);
  };
  for (const transaction of transactions) {
    const baseKey = buildKey(transaction.opDate, transaction.last4, transaction.amountCents);
    addToGroup(baseKey, transaction);

    const derivedCupon = transaction.cupon || getCuponSuffix(transaction.transactionId);
    if (derivedCupon) {
      const cuponKey = buildKey(
        transaction.opDate,
        transaction.last4,
        transaction.amountCents,
        derivedCupon,
      );
      addToGroup(cuponKey, transaction);
      const cuponOnlyKey = `${transaction.opDate}|${transaction.last4}|${derivedCupon}`;
      addToCuponGroup(cuponOnlyKey, transaction);
    }
  }

  const reconciliations: ReconciliationDoc[] = [];
  const usedTransactions = new Set<string>();
  const installmentGroups = new Map<
    string,
    { lineIds: string[]; totalCents: number; leadLineId: string }
  >();
  const getInstallmentTotal = (line: SettlementLineDoc, cuotaTotal: number | null) => {
    if (!cuotaTotal || cuotaTotal <= 1) return null;
    const total = line.amountCents * cuotaTotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    if (total === line.amountCents) return null;
    return total;
  };

  for (const line of lines) {
    if (!line.cupon) continue;
    const cuotaInfo = extractCuotaInfo(line);
    const isPlanCuotaLine =
      line.trxType === "plan_cuota" ||
      /plan\s*cuota/i.test(line.rawLine ?? "") ||
      Boolean(cuotaInfo.total);
    if (!isPlanCuotaLine) continue;
    const cuotaTotalKey = cuotaInfo.total ?? "";
    const key = `${line.opDate}|${line.last4}|${line.cupon}|${line.terminal ?? ""}|${line.lote ?? ""}|${cuotaTotalKey}`;
    const group = installmentGroups.get(key) ?? { lineIds: [], totalCents: 0, leadLineId: line._id.toString() };
    group.lineIds.push(line._id.toString());
    group.totalCents += line.amountCents;
    if (cuotaInfo.numero && group.lineIds.length > 1) {
      const currentLead = lines.find((item) => item._id.toString() === group.leadLineId);
      const currentLeadCuota = currentLead ? extractCuotaInfo(currentLead).numero : null;
      if (!currentLead || (currentLeadCuota ?? 99) > cuotaInfo.numero) {
        group.leadLineId = line._id.toString();
      }
    }
    installmentGroups.set(key, group);
  }

  for (const line of lines) {
    const baseAmountCents = line.amountCents;
    let amountCents = line.amountCents;
    let groupLead = false;
    let installmentInferred = false;
    let fallbackAmountCents: number | null = null;
    const now = new Date();
    const cuotaInfo = extractCuotaInfo(line);
    const isPlanCuotaLine =
      line.trxType === "plan_cuota" ||
      /plan\s*cuota/i.test(line.rawLine ?? "") ||
      Boolean(cuotaInfo.total);

    if (isPlanCuotaLine && line.cupon) {
      const cuotaTotalKey = cuotaInfo.total ?? "";
      const groupKey = `${line.opDate}|${line.last4}|${line.cupon}|${line.terminal ?? ""}|${line.lote ?? ""}|${cuotaTotalKey}`;
      const group = installmentGroups.get(groupKey);
      if (group && group.lineIds.length > 1) {
        if (group.leadLineId !== line._id.toString()) {
          reconciliations.push({
            _id: new ObjectId(),
            settlementId,
            settlementLineId: line._id,
            matchType: "exact_coupon",
            matchKey: buildKey(line.opDate, line.last4, line.amountCents, line.cupon),
            status: "excluded",
            reason: "cuota agrupada en otra linea",
            amountCents: line.amountCents,
            opDate: line.opDate,
            last4: line.last4,
            cupon: line.cupon ?? null,
            audit: {
              matchedAt: now,
              matchedBy,
              evidence: {
                pdfKey: buildKey(line.opDate, line.last4, line.amountCents, line.cupon),
              },
            },
            createdAt: now,
          });
          continue;
        }
        amountCents = group.totalCents;
        groupLead = true;
      } else {
        const inferredTotal = getInstallmentTotal(line, cuotaInfo.total);
        if (inferredTotal) {
          amountCents = inferredTotal;
          installmentInferred = true;
          fallbackAmountCents = baseAmountCents;
        }
      }
    }

    let matchKey = buildKey(line.opDate, line.last4, amountCents, line.cupon);
    let matches = grouped.get(matchKey) ?? [];

    if (matches.length === 0 && fallbackAmountCents) {
      const fallbackKey = buildKey(
        line.opDate,
        line.last4,
        fallbackAmountCents,
        line.cupon,
      );
      const fallbackMatches = grouped.get(fallbackKey) ?? [];
      if (fallbackMatches.length > 0) {
        matchKey = fallbackKey;
        matches = fallbackMatches;
        amountCents = fallbackAmountCents;
        installmentInferred = false;
      }
    }

    if (matches.length === 0 && line.cupon) {
      const cuponOnlyKey = `${line.opDate}|${line.last4}|${line.cupon}`;
      const cuponMatches = groupedByCupon.get(cuponOnlyKey) ?? [];
      if (cuponMatches.length === 1) {
        const match = cuponMatches[0];
        if (usedTransactions.has(match._id.toString())) {
          reconciliations.push({
            _id: new ObjectId(),
            settlementId,
            settlementLineId: line._id,
            fiservTransactionId: match._id,
            orderId: match.orderId,
            transactionId: match.transactionId,
            matchType: "exact_coupon",
            matchKey: buildKey(line.opDate, line.last4, match.amountCents, line.cupon),
            status: "needs_review",
            reason: "transaccion duplicada en multiples lineas",
            amountCents: match.amountCents ?? amountCents,
            opDate: line.opDate,
            last4: line.last4,
            cupon: line.cupon ?? null,
            audit: {
              matchedAt: now,
              matchedBy,
              evidence: {
                pdfKey: matchKey,
                csvKey: buildKey(line.opDate, line.last4, match.amountCents, line.cupon),
              },
            },
            createdAt: now,
          });
          continue;
        }

        usedTransactions.add(match._id.toString());
        const orderInfo = await getOrder(match.orderId);
        const hasOrganizer = Boolean(orderInfo?.organizerId && orderInfo?.organizerName);

        reconciliations.push({
          _id: new ObjectId(),
          settlementId,
          settlementLineId: line._id,
          fiservTransactionId: match._id,
          orderId: match.orderId,
          organizerId: orderInfo?.organizerId ?? (hasOrganizer ? undefined : "UNKNOWN"),
          organizerName:
            orderInfo?.organizerName ?? (hasOrganizer ? undefined : "Organizador sin definir"),
          eventId: orderInfo?.eventId,
          transactionId: match.transactionId,
          matchType: "exact_coupon",
          matchKey: buildKey(line.opDate, line.last4, match.amountCents, line.cupon),
          status: hasOrganizer ? "reconciled" : "needs_review",
          reason: hasOrganizer
            ? "match por cupon"
            : "orden sin organizer asociado",
          amountCents: match.amountCents ?? amountCents,
          opDate: line.opDate,
          last4: line.last4,
          cupon: line.cupon ?? null,
          audit: {
            matchedAt: now,
            matchedBy,
            evidence: {
              pdfKey: matchKey,
              csvKey: buildKey(line.opDate, line.last4, match.amountCents, line.cupon),
            },
          },
          createdAt: now,
        });
        continue;
      }
      if (cuponMatches.length > 1) {
        reconciliations.push({
          _id: new ObjectId(),
          settlementId,
          settlementLineId: line._id,
          matchType: "exact_coupon",
          matchKey,
          status: "needs_review",
          reason: "ambiguo (multiples transacciones con mismo cupon)",
          amountCents,
          opDate: line.opDate,
          last4: line.last4,
          cupon: line.cupon ?? null,
          audit: {
            matchedAt: now,
            matchedBy,
            evidence: {
              pdfKey: matchKey,
            },
          },
          createdAt: now,
        });
        continue;
      }
    }

    if (matches.length !== 1) {
      reconciliations.push({
        _id: new ObjectId(),
        settlementId,
        settlementLineId: line._id,
        matchType: line.cupon ? "exact_coupon" : "exact_key",
        matchKey,
        status: "needs_review",
        reason:
          matches.length === 0
            ? "sin_match"
            : "ambiguo (multiples transacciones con misma clave)",
        amountCents,
        opDate: line.opDate,
        last4: line.last4,
        cupon: line.cupon ?? null,
        audit: {
          matchedAt: now,
          matchedBy,
          evidence: {
            pdfKey: matchKey,
          },
        },
        createdAt: now,
      });
      continue;
    }

    const match = matches[0];
    if (usedTransactions.has(match._id.toString())) {
      reconciliations.push({
        _id: new ObjectId(),
        settlementId,
        settlementLineId: line._id,
        fiservTransactionId: match._id,
        orderId: match.orderId,
        transactionId: match.transactionId,
        matchType: line.cupon ? "exact_coupon" : "exact_key",
        matchKey,
        status: "needs_review",
        reason: "transaccion duplicada en multiples lineas",
        amountCents,
        opDate: line.opDate,
        last4: line.last4,
        cupon: line.cupon ?? null,
        audit: {
          matchedAt: now,
          matchedBy,
          evidence: {
            pdfKey: matchKey,
            csvKey: matchKey,
          },
        },
        createdAt: now,
      });
      continue;
    }
    usedTransactions.add(match._id.toString());
    const orderInfo = await getOrder(match.orderId);
    const hasOrganizer = Boolean(orderInfo?.organizerId && orderInfo?.organizerName);

    reconciliations.push({
      _id: new ObjectId(),
      settlementId,
      settlementLineId: line._id,
      fiservTransactionId: match._id,
      orderId: match.orderId,
      organizerId: orderInfo?.organizerId ?? (hasOrganizer ? undefined : "UNKNOWN"),
      organizerName:
        orderInfo?.organizerName ?? (hasOrganizer ? undefined : "Organizador sin definir"),
      eventId: orderInfo?.eventId,
      transactionId: match.transactionId,
      matchType: line.cupon ? "exact_coupon" : "exact_key",
      matchKey,
      status: hasOrganizer ? "reconciled" : "needs_review",
      reason: hasOrganizer
        ? groupLead
          ? "cuotas agrupadas"
          : installmentInferred
            ? "cuotas estimadas"
            : undefined
        : "orden sin organizer asociado",
      amountCents: match.amountCents ?? amountCents,
      opDate: line.opDate,
      last4: line.last4,
      cupon: line.cupon ?? null,
      audit: {
        matchedAt: now,
        matchedBy,
        evidence: {
          pdfKey: matchKey,
          csvKey: matchKey,
        },
      },
      createdAt: now,
    });
  }

  return reconciliations;
};
