import { NextResponse } from "next/server";

import { buildSummary, reconcileLines } from "@/lib/liquidaciones/reconcile";
import { getLatestImport, readCollection, writeCollection } from "@/lib/liquidaciones/store";
import {
  CsvTransaction,
  Reconciliation,
  SettlementLine,
} from "@/lib/liquidaciones/types";

const debugEnabled = process.env.DEBUG_LIQUIDACIONES !== "false";
const debug = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

const buildKey = (date: string, last4: string, amount: number) =>
  `${date}|${last4}|${amount.toFixed(2)}`;

export async function POST() {
  try {
    const csvImport = await getLatestImport("csv");
    const pdfImport = await getLatestImport("pdf");

    if (!csvImport || !pdfImport) {
      return NextResponse.json(
        { success: false, error: "Necesitamos un CSV y un PDF antes de conciliar" },
        { status: 400 },
      );
    }

    const allTransactions = await readCollection<CsvTransaction>("fiserv_transactions");
    const allLines = await readCollection<SettlementLine>("settlement_lines");

    const transactions = allTransactions.filter(
      (item) => item.importId === csvImport.id,
    );
    const lines = allLines.filter((item) => item.importId === pdfImport.id);
    debug("[liquidaciones][reconcile] csv:", csvImport.filename, "rows:", transactions.length);
    debug("[liquidaciones][reconcile] pdf:", pdfImport.filename, "lines:", lines.length);

    const keyCounts = new Map<string, number>();
    for (const tx of transactions) {
      const key = buildKey(tx.date, tx.last4, tx.amount);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
    debug(
      "[liquidaciones][reconcile] sample csv keys:",
      transactions.slice(0, 5).map((tx) => ({
        key: buildKey(tx.date, tx.last4, tx.amount),
        orderId: tx.orderId,
        last4: tx.last4,
        amount: tx.amount,
        date: tx.date,
      })),
    );
    debug(
      "[liquidaciones][reconcile] sample pdf keys:",
      lines.slice(0, 5).map((line) => ({
        key: buildKey(line.fechaOperacion, line.last4, line.amount),
        last4: line.last4,
        amount: line.amount,
        date: line.fechaOperacion,
        rawLine: line.rawLine,
        matches: keyCounts.get(buildKey(line.fechaOperacion, line.last4, line.amount)) ?? 0,
      })),
    );

    const reconciliationsRaw = await reconcileLines(
      lines,
      transactions,
      csvImport.id,
      pdfImport.id,
    );
    const lineMap = new Map(lines.map((line) => [line.id, line]));
    const reconciliations = reconciliationsRaw.map((item) => {
      if (item.cupon) return item;
      const line = lineMap.get(item.settlementLineId);
      return line ? { ...item, cupon: line.cupon } : item;
    });

    const existing = await readCollection<Reconciliation>("reconciliations");
    const filtered = existing.filter(
      (item) =>
        !(
          item.csvImportId === csvImport.id && item.pdfImportId === pdfImport.id
        ),
    );

    await writeCollection("reconciliations", filtered.concat(reconciliations));

    const currencyARS = transactions.every((item) => item.currency === "ARS");
    const summary = buildSummary(
      reconciliations,
      csvImport,
      pdfImport,
      pdfImport.totalAmount ?? null,
      currencyARS,
    );

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("Error conciliando", error);
    return NextResponse.json(
      { success: false, error: "No pudimos conciliar los archivos" },
      { status: 500 },
    );
  }
}

