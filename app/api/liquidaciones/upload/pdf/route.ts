import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { parseFiservPdf } from "@/lib/liquidaciones/pdfParser";
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
        { success: false, error: "No recibimos el archivo PDF" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const importId = randomUUID();

    const { lines, totalAmount } = await parseFiservPdf(buffer, importId);
    debug("[liquidaciones][pdf] archivo:", file.name, "lineas:", lines.length);
    if (lines.length) {
      debug("[liquidaciones][pdf] sample:", lines.slice(0, 5).map((line) => ({
        fecha: line.fechaOperacion,
        last4: line.last4,
        amount: line.amount,
        terminal: line.terminal,
        lote: line.lote,
        cupon: line.cupon,
        rawLine: line.rawLine,
      })));
    }
    if (typeof totalAmount === "number") {
      debug("[liquidaciones][pdf] total detectado:", totalAmount);
    }

    const importRecord: SettlementImport = {
      id: importId,
      type: "pdf",
      filename: file.name || "liquidacion.pdf",
      createdAt: new Date().toISOString(),
      rowCount: lines.length,
      totalAmount,
    };

    await appendCollection("settlement_imports", [importRecord]);
    await appendCollection("settlement_lines", lines);

    return NextResponse.json({
      success: true,
      import: importRecord,
      count: lines.length,
      totalAmount,
    });
  } catch (error) {
    console.error("Error procesando PDF", error);
    return NextResponse.json(
      { success: false, error: "No pudimos procesar el PDF" },
      { status: 500 },
    );
  }
}

