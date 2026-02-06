import { NextResponse } from "next/server";

import { buildSummary } from "@/lib/liquidaciones/reconcile";
import { getLatestImport, readCollection } from "@/lib/liquidaciones/store";
import {
  CsvTransaction,
  Reconciliation,
  SettlementLine,
} from "@/lib/liquidaciones/types";

export async function GET() {
  try {
    const csvImport = await getLatestImport("csv");
    const pdfImport = await getLatestImport("pdf");

    const reconciliations = await readCollection<Reconciliation>("reconciliations");

    const relevantReconciliations = reconciliations.filter((item) => {
      if (!csvImport || !pdfImport) return false;
      return (
        item.csvImportId === csvImport.id && item.pdfImportId === pdfImport.id
      );
    });

    const transactions = csvImport
      ? (await readCollection<CsvTransaction>("fiserv_transactions")).filter(
          (item) => item.importId === csvImport.id,
        )
      : [];

    const lines = pdfImport
      ? (await readCollection<SettlementLine>("settlement_lines")).filter(
          (item) => item.importId === pdfImport.id,
        )
      : [];

    const currencyARS = transactions.length
      ? transactions.every((item) => item.currency === "ARS")
      : true;

    const lineMap = new Map(lines.map((line) => [line.id, line]));
    const reconciliationsHydrated = relevantReconciliations.map((item) => {
      if (item.cupon) return item;
      const line = lineMap.get(item.settlementLineId);
      return line ? { ...item, cupon: line.cupon } : item;
    });

    const summary = buildSummary(
      reconciliationsHydrated.length ? reconciliationsHydrated : [],
      csvImport,
      pdfImport,
      pdfImport?.totalAmount ?? null,
      currencyARS,
    );

    return NextResponse.json({
      success: true,
      summary,
      totals: {
        csvTransactions: transactions.length,
        settlementLines: lines.length,
      },
    });
  } catch (error) {
    console.error("Error obteniendo resumen", error);
    return NextResponse.json(
      { success: false, error: "No pudimos cargar el resumen" },
      { status: 500 },
    );
  }
}

