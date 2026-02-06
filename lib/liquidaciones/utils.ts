const DATE_REGEX = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const DATE_TEXT_REGEX = /(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})/;
const MONTHS: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dic: "12",
};

export const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

export const parseAmount = (value: string): number => {
  const cleaned = value
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "");

  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
};

export const extractLast4 = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return value.trim();
};

const pad2 = (value: string) => value.padStart(2, "0");

export const normalizeDate = (value: string): string => {
  const match = value.match(DATE_REGEX);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  const textMatch = value.match(DATE_TEXT_REGEX);
  if (textMatch) {
    const [, dd, rawMonth, yyyy] = textMatch;
    const monthKey = rawMonth.toLowerCase().slice(0, 3);
    const month = MONTHS[monthKey];
    if (month) {
      return `${yyyy}-${month}-${pad2(dd)}`;
    }
  }

  return "";
};

export const normalizeCurrency = (value: string): string => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";
  if (trimmed === "ARS" || trimmed === "$" || trimmed === "AR$" || trimmed === "AR$S") {
    return "ARS";
  }
  return trimmed;
};

export const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

export const toNumberKey = (value: number) => value.toFixed(2);

export const hasDate = (value: string) => DATE_REGEX.test(value) || DATE_TEXT_REGEX.test(value);
