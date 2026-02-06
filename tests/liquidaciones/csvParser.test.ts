import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { parseFiservCsv } from "@/lib/liquidaciones/csvParser";

const fixturePath = path.join(__dirname, "..", "fixtures", "fiserv-sample.csv");

describe("parseFiservCsv", () => {
  it("parses rows and normalizes fields", () => {
    const csv = readFileSync(fixturePath, "utf-8");
    const result = parseFiservCsv(csv, "import-test");

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].orderId).toBe("65a1b2c3d4e5f67890123456");
    expect(result.transactions[0].last4).toBe("1234");
    expect(result.transactions[0].amount).toBeCloseTo(1234.56, 2);
    expect(result.transactions[0].currency).toBe("ARS");
  });
});
