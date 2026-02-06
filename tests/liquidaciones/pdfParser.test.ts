import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { parseFiservPdfText } from "@/lib/liquidaciones/pdfParser";

const fixturePath = path.join(__dirname, "..", "fixtures", "fiserv-sample.txt");
const fixtureGluedPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "fiserv-sample-glued.txt",
);
const fixturePlanCuotaPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "fiserv-plan-cuota.txt",
);

describe("parseFiservPdfText", () => {
  it("extracts settlement lines and total", () => {
    const text = readFileSync(fixturePath, "utf-8");
    const result = parseFiservPdfText(text, "import-test");

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].fechaOperacion).toBe("2026-01-02");
    expect(result.lines[0].last4).toBe("1234");
    expect(result.lines[0].amount).toBeCloseTo(1234.56, 2);
    expect(result.totalAmount).toBeCloseTo(3234.56, 2);
  });

  it("parses glued token lines with cupon/last4/amount", () => {
    const text = readFileSync(fixtureGluedPath, "utf-8");
    const result = parseFiservPdfText(text, "import-test");

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].terminal).toBe("77428");
    expect(result.lines[0].lote).toBe("2");
    expect(result.lines[0].cupon).toBe("14");
    expect(result.lines[0].last4).toBe("5982");
    expect(result.lines[0].amount).toBeCloseTo(10, 2);

    expect(result.lines[1].cupon).toBe("15");
    expect(result.lines[1].last4).toBe("8844");
    expect(result.lines[1].amount).toBeCloseTo(1000, 2);
  });

  it("parses plan cuota lines with cupon and combined term/lote/cupon", () => {
    const text = readFileSync(fixturePlanCuotaPath, "utf-8");
    const result = parseFiservPdfText(text, "import-test");

    expect(result.lines).toHaveLength(2);

    expect(result.lines[0].trxType).toBe("plan_cuota");
    expect(result.lines[0].terminal).toBe("77428");
    expect(result.lines[0].lote).toBe("2");
    expect(result.lines[0].cupon).toBe("21");
    expect(result.lines[0].last4).toBe("9600");
    expect(result.lines[0].planCuota).toBe("01/03");
    expect(result.lines[0].cuotaNumero).toBe(1);
    expect(result.lines[0].cuotaTotal).toBe(3);
    expect(result.lines[0].amount).toBeCloseTo(1050, 2);

    expect(result.lines[1].terminal).toBe("77428");
    expect(result.lines[1].lote).toBe("2");
    expect(result.lines[1].cupon).toBe("21");
    expect(result.lines[1].last4).toBe("9600");
    expect(result.lines[1].planCuota).toBe("1/3");
    expect(result.lines[1].cuotaNumero).toBe(1);
    expect(result.lines[1].cuotaTotal).toBe(3);
    expect(result.lines[1].amount).toBeCloseTo(700, 2);
  });
});
