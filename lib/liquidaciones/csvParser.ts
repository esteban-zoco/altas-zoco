import { randomUUID } from "crypto";
import Papa from "papaparse";

import { CsvTransaction } from "./types";
import { extractLast4, normalizeCurrency, normalizeDate, parseAmount } from "./utils";

interface CsvParseResult {
  transactions: CsvTransaction[];
  currencyIssues: string[];
}

const CANDIDATE_HEADERS = {
  orderId: ["Pedido #", "Pedido", "Order #", "Order", "OrderId", "Order ID"],
  date: ["Fecha", "Fecha operacion", "Fecha de operacion", "Fecha de venta"],
  transactionId: [
    "Identificacion de Transaccion",
    "Identificaci\u00f3n de Transacci\u00f3n",
    "Identificacion",
    "Identificaci\u00f3n",
    "Transaction ID",
    "ID Transaccion",
  ],
  cardNumber: [
    "Numero de tarjeta / cuenta",
    "N\u00famero de tarjeta / cuenta",
    "Numero de tarjeta / linea",
    "N\u00famero de tarjeta / l\u00ednea",
    "Numero de tarjeta",
    "N\u00famero de tarjeta",
    "Numero de cuenta",
    "N\u00famero de cuenta",
    "Identificacion Numero de",
    "Identificaci\u00f3n N\u00famero de",
    "Tarjeta",
  ],
  approval: [
    "Aprobacion",
    "Aprobaci\u00f3n",
    "Autorizacion",
    "Autorizaci\u00f3n",
    "Autorizacion del Pagador",
    "Autorizaci\u00f3n del Pagador",
    "Authorization",
    "Auth",
  ],
  terminal: ["Terminal", "Terminal #", "Terminal ID", "ID Terminal"],
  lote: ["Lote", "Lote #", "Batch", "Batch #"],
  cupon: ["Cupon", "Cup\u00f3n", "Cupon #", "Cup\u00f3n #", "Coupon", "Coupon #"],
  terminalLoteCupon: [
    "Terminal/Lote/Cupon",
    "Terminal/Lote/Cup\u00f3n",
    "Term/Lote/Cupon",
    "Term/Lote/Cup\u00f3n",
    "Term Lote Cupon",
  ],
  amount: ["Importe", "Monto", "Amount", "Total"],
  currency: ["Moneda", "Currency", "Divisa"],
} as const;

const fixMojibake = (value: string) =>
  value
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã±/g, "n")
    .replace(/Ã¼/g, "u")
    .replace(/Ã/g, "a")
    .replace(/Ã‰/g, "e")
    .replace(/Ã/g, "i")
    .replace(/Ã“/g, "o")
    .replace(/Ãš/g, "u")
    .replace(/Ã‘/g, "n")
    .replace(/[ºª]/g, "");

const normalizeHeaderKey = (value: string) =>
  fixMojibake(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const buildHeaderLookup = (row: Record<string, string>) => {
  const lookup = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    const normalized = normalizeHeaderKey(key);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, key);
    }
  });
  return lookup;
};

const getValue = (
  row: Record<string, string>,
  lookup: Map<string, string>,
  candidates: readonly string[],
): string => {
  for (const candidate of candidates) {
    if (candidate in row) return String(row[candidate] ?? "");
    const normalized = normalizeHeaderKey(candidate);
    const key = lookup.get(normalized);
    if (key && key in row) return String(row[key] ?? "");
  }

  for (const candidate of candidates) {
    const normalized = normalizeHeaderKey(candidate);
    for (const [headerKey, original] of lookup.entries()) {
      if (headerKey.includes(normalized) || normalized.includes(headerKey)) {
        return String(row[original] ?? "");
      }
    }
  }

  return "";
};

const parseTerminalLoteCupon = (value: string) => {
  const digits = value.match(/\d+/g) ?? [];
  return {
    terminal: digits[0] ?? "",
    lote: digits[1] ?? "",
    cupon: digits[2] ?? "",
  };
};

const decodeCsvBuffer = (buffer: Buffer) => {
  const utf8 = buffer.toString("utf8");
  const latin1 = buffer.toString("latin1");
  const hasMojibake = (text: string) => /Ã.|�/.test(text);
  if (hasMojibake(utf8) && !hasMojibake(latin1)) return latin1;
  const score = (text: string) => {
    const lc = text.toLowerCase();
    const tokens = ["pedido", "fecha", "importe", "moneda", "aprob", "autoriz", "tarjeta"];
    return tokens.reduce((acc, token) => acc + (lc.includes(token) ? 1 : 0), 0);
  };
  return score(latin1) > score(utf8) ? latin1 : utf8;
};

export const parseFiservCsv = (
  csvInput: string | Buffer,
  importId: string,
): CsvParseResult => {
  const csvText = Buffer.isBuffer(csvInput) ? decodeCsvBuffer(csvInput) : csvInput;
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const transactions: CsvTransaction[] = [];
  const currencyIssues: string[] = [];

  if (parsed.data) {
    for (const row of parsed.data) {
      const lookup = buildHeaderLookup(row);
      const orderId = getValue(row, lookup, CANDIDATE_HEADERS.orderId).trim();
      if (!orderId) {
        continue;
      }

      const dateTime = getValue(row, lookup, CANDIDATE_HEADERS.date).trim();
      const date = normalizeDate(dateTime);
      const transactionId = getValue(row, lookup, CANDIDATE_HEADERS.transactionId).trim();
      const cardMasked = getValue(row, lookup, CANDIDATE_HEADERS.cardNumber).trim();
      const approval = getValue(row, lookup, CANDIDATE_HEADERS.approval).trim();
      const terminalRaw = getValue(row, lookup, CANDIDATE_HEADERS.terminal).trim();
      const loteRaw = getValue(row, lookup, CANDIDATE_HEADERS.lote).trim();
      const cuponRaw = getValue(row, lookup, CANDIDATE_HEADERS.cupon).trim();
      const combinedRaw = getValue(row, lookup, CANDIDATE_HEADERS.terminalLoteCupon).trim();
      let terminal = terminalRaw;
      let lote = loteRaw;
      let cupon = cuponRaw;
      if ((!terminal || !lote || !cupon) && combinedRaw) {
        const parsed = parseTerminalLoteCupon(combinedRaw);
        terminal = terminal || parsed.terminal;
        lote = lote || parsed.lote;
        cupon = cupon || parsed.cupon;
      }
      const currencyRaw = getValue(row, lookup, CANDIDATE_HEADERS.currency).trim();
      const currency = normalizeCurrency(currencyRaw);
      const amountRaw = getValue(row, lookup, CANDIDATE_HEADERS.amount).trim();

      if (currency && currency !== "ARS") {
        currencyIssues.push(currency);
      }

      transactions.push({
        id: randomUUID(),
        importId,
        orderId,
        transactionId,
        approval,
        amount: parseAmount(amountRaw),
        currency,
        date,
        dateTime,
        last4: extractLast4(cardMasked),
        terminal,
        lote,
        cupon,
        cardMasked,
        raw: row,
      });
    }
  }

  return {
    transactions,
    currencyIssues,
  };
};
