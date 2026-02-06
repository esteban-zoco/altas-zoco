import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { parseFiservCsv } from "@/lib/liquidaciones/csvParser";
import { appendCollection } from "@/lib/liquidaciones/store";
import { SettlementImport } from "@/lib/liquidaciones/types";

const debugEnabled = process.env.DEBUG_LIQUIDACIONES !== "false";
const debug = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No recibimos el archivo CSV" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const importId = randomUUID();

    const { transactions, currencyIssues } = parseFiservCsv(buffer, importId);
    debug("[liquidaciones][csv] archivo:", file.name, "filas:", transactions.length);
    if (transactions[0]) {
      const sample = transactions[0];
      debug("[liquidaciones][csv] sample:", {
        orderId: sample.orderId,
        date: sample.date,
        dateTime: sample.dateTime,
        last4: sample.last4,
        terminal: sample.terminal,
        lote: sample.lote,
        cupon: sample.cupon,
        amount: sample.amount,
        currency: sample.currency,
        transactionId: sample.transactionId,
        approval: sample.approval,
      });
      debug("[liquidaciones][csv] headers:", Object.keys(sample.raw || {}));
    }
    if (currencyIssues.length) {
      debug("[liquidaciones][csv] monedas no ARS:", Array.from(new Set(currencyIssues)));
    }

    const importRecord: SettlementImport = {
      id: importId,
      type: "csv",
      filename: file.name || "fiserv.csv",
      createdAt: new Date().toISOString(),
      rowCount: transactions.length,
    };

    await appendCollection("settlement_imports", [importRecord]);
    await appendCollection("fiserv_transactions", transactions);

    return NextResponse.json({
      success: true,
      import: importRecord,
      currencyIssues: Array.from(new Set(currencyIssues)),
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error procesando CSV", error);
    return NextResponse.json(
      { success: false, error: "No pudimos procesar el CSV" },
      { status: 500 },
    );
  }
}
