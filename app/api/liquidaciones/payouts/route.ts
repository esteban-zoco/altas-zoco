import { NextResponse } from "next/server";

import { buildSummary } from "@/lib/liquidaciones/reconcile";
import { getLatestImport, readCollection } from "@/lib/liquidaciones/store";
import { CsvTransaction, Reconciliation } from "@/lib/liquidaciones/types";

const toCsvValue = (value: string | number) => {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
};

export async function GET() {
  try {
    const csvImport = await getLatestImport("csv");
    const pdfImport = await getLatestImport("pdf");

    if (!csvImport || !pdfImport) {
      return NextResponse.json(
        { success: false, error: "No hay imports suficientes para exportar" },
        { status: 400 },
      );
    }

    const reconciliations = await readCollection<Reconciliation>("reconciliations");
    const relevant = reconciliations.filter(
      (item) => item.csvImportId === csvImport.id && item.pdfImportId === pdfImport.id,
    );

    const transactions = await readCollection<CsvTransaction>("fiserv_transactions");
    const currencyARS = transactions
      .filter((item) => item.importId === csvImport.id)
      .every((item) => item.currency === "ARS");

    const summary = buildSummary(
      relevant,
      csvImport,
      pdfImport,
      pdfImport.totalAmount ?? null,
      currencyARS,
    );

    if (!summary.canGeneratePayments) {
      return NextResponse.json(
        { success: false, error: "Hay conciliaciones sin match o ambiguas" },
        { status: 400 },
      );
    }

    const header = [
      "organizerId",
      "organizerName",
      "total",
      "orderIds",
      "transactionIds",
    ];

    const rows = summary.byOrganizer.map((item) => [
      toCsvValue(item.organizerId),
      toCsvValue(item.organizerName),
      toCsvValue(item.totalAmount.toFixed(2)),
      toCsvValue(item.orderIds.join("|")),
      toCsvValue(item.transactionIds.join("|")),
    ]);

    const csv = [header.map(toCsvValue).join(","), ...rows.map((row) => row.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"payouts.csv\"",
      },
    });
  } catch (error) {
    console.error("Error generando payouts", error);
    return NextResponse.json(
      { success: false, error: "No pudimos generar el archivo" },
      { status: 500 },
    );
  }
}

