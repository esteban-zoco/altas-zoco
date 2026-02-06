import { randomUUID } from "crypto";
import pdf from "pdf-parse";

import { SettlementLine } from "./types";
import { extractLast4, hasDate, normalizeDate, normalizeWhitespace, parseAmount } from "./utils";

const AMOUNT_REGEX = /-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})/g;
const DECIMAL_TOKEN_REGEX = /[.,]\d{2}$/;
const PLAN_CUOTA_REGEX = /plan\s*cuota/i;
const CUOTA_TOKEN_REGEX = /\b\d{1,2}\/\d{1,2}\b(?!\/\d{4})/;
const DATE_TOKEN_REGEX = /\d{2}\/\d{2}\/\d{4}/g;
const TERM_LOTE_CUPON_TOKEN_REGEX = /^\d+[/-]\d+[/-]\d+$/;

const isDigitsOnly = (value: string) => /^\d+$/.test(value);
const isValidTerminal = (value: string) => /^\d{4,6}$/.test(value);
const isValidLote = (value: string) => /^\d{1,3}$/.test(value);
const isValidCupon = (value: string) => /^\d{1,6}$/.test(value);
const isValidLast4 = (value: string) => /^\d{4}$/.test(value);

const splitTermLoteCuponDigits = (digits: string) => {
  if (!isDigitsOnly(digits) || digits.length < 7) return null;
  const terminal = digits.slice(0, 5);
  const tail = digits.slice(5);
  let best: { terminal: string; lote: string; cupon: string; score: number } | null = null;

  for (let loteLen = 1; loteLen <= Math.min(3, tail.length - 1); loteLen += 1) {
    const lote = tail.slice(0, loteLen);
    const cupon = tail.slice(loteLen);
    if (!cupon) continue;
    const cuponScore =
      cupon.length === 2 ? 0 : cupon.length === 3 ? 1 : cupon.length === 1 ? 2 : 3;
    const loteScore = lote.length === 1 ? 0 : lote.length === 2 ? 1 : 2;
    const score = cuponScore * 2 + loteScore;

    if (!best || score < best.score) {
      best = { terminal, lote, cupon, score };
    }
  }

  if (!best) return null;
  return { terminal: best.terminal, lote: best.lote, cupon: best.cupon };
};

const splitTermLoteCuponWithLast4 = (digits: string) => {
  if (!isDigitsOnly(digits) || digits.length < 11) return null;
  const last4 = digits.slice(-4);
  const prefix = digits.slice(0, -4);
  const parsed = splitTermLoteCuponDigits(prefix);
  if (!parsed) return null;
  return { ...parsed, last4 };
};

const splitCombinedToken = (token: string) => {
  const decimalMatch = token.match(DECIMAL_TOKEN_REGEX);
  if (!decimalMatch) return null;

  const decimals = decimalMatch[0];
  const integerPart = token.slice(0, -decimals.length);
  const integerDigits = integerPart.replace(/\D/g, "");
  if (integerDigits.length < 6) return null;

  const candidates: Array<{
    cupon: string;
    last4: string;
    amountText: string;
    amount: number;
    score: number;
  }> = [];

  const tryCandidate = (amountDigits: string, sourceScore: number, amountToken?: string) => {
    const amountLen = amountDigits.length;
    const prefixLen = integerDigits.length - amountLen;
    if (prefixLen <= 4) return;
    const last4 = integerDigits.slice(prefixLen - 4, prefixLen);
    const cupon = integerDigits.slice(0, prefixLen - 4);
    if (!cupon) return;
    const amountText = `${amountToken ?? amountDigits}${decimals}`;
    const amount = parseAmount(amountText);
    if (!amount) return;

    const cuponScore =
      cupon.length === 2 ? 0 : cupon.length === 3 ? 1 : cupon.length === 1 ? 2 : 3;
    const leadingZeroPenalty =
      amountDigits.length > 1 && amountDigits.startsWith("0") ? 1 : 0;

    candidates.push({
      cupon,
      last4,
      amountText,
      amount,
      score: sourceScore * 10 + cuponScore * 2 + leadingZeroPenalty,
    });
  };

  if (/[.,]/.test(integerPart)) {
    const amountPattern = /^\d{1,3}(?:[.,]\d{3})*$/;
    for (let i = integerPart.length - 1; i >= 0; i -= 1) {
      const candidate = integerPart.slice(i);
      if (!amountPattern.test(candidate)) continue;
      if (!/[.,]\d{3}/.test(candidate)) continue;
      const amountDigits = candidate.replace(/\D/g, "");
      if (!amountDigits) continue;
      tryCandidate(amountDigits, 0, candidate);
      break;
    }
  }

  if (candidates.length === 0) {
    for (let amountLen = 1; amountLen <= 5; amountLen += 1) {
      if (integerDigits.length <= amountLen + 4) continue;
      const amountDigits = integerDigits.slice(-amountLen);
      tryCandidate(amountDigits, 1);
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
};

const parseSettlementLine = (
  rawLine: string,
  importId: string,
  lineIndex: number,
): SettlementLine | null => {
  const line = normalizeWhitespace(rawLine).replace(
    /(\d{2}\/\d{2}\/\d{4})(\d+)/,
    "$1 $2",
  );
  const isVentaCtdo = /venta\s+ctdo/i.test(line);
  const cuotaMatch = line.match(CUOTA_TOKEN_REGEX);
  const isPlanCuota = PLAN_CUOTA_REGEX.test(line) || Boolean(cuotaMatch);
  if (!isVentaCtdo && !isPlanCuota) return null;

  const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}/);
  const amountMatches = line.match(AMOUNT_REGEX);
  let amountText = amountMatches ? amountMatches[amountMatches.length - 1] : null;

  if (!dateMatch || !amountText) {
    return null;
  }

  const date = normalizeDate(dateMatch[0]);
  let amount = 0;

  let last4 = "";
  let terminal = "";
  let lote = "";
  let cupon = "";

  const rest = line.replace(/venta\s+ctdo|plan\s*cuota/i, "").trim();
  const restAfterDate = rest.replace(DATE_TOKEN_REGEX, "").trim();
  const tokens = restAfterDate.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    terminal = tokens[0];
    lote = tokens[1];
  }

  const remainingTokens = tokens.slice(2);
  let planCuota = "";
  let cuotaNumero: number | undefined;
  let cuotaTotal: number | undefined;
  if (isPlanCuota && remainingTokens.length >= 4) {
    const possibleCupon = remainingTokens[0];
    const possibleLast4 = remainingTokens[1];
    const possiblePlan = remainingTokens[2];
    if (/^\d+$/.test(possibleCupon)) {
      cupon = possibleCupon;
    }
    if (/^\d{4}$/.test(possibleLast4)) {
      last4 = possibleLast4;
    }
    if (/^\d{1,2}\/\d{1,2}$/.test(possiblePlan)) {
      planCuota = possiblePlan;
      const [num, total] = planCuota.split("/").map((value) => Number(value));
      if (!Number.isNaN(num)) cuotaNumero = num;
      if (!Number.isNaN(total)) cuotaTotal = total;
    }
  }
  if (isPlanCuota && !planCuota) {
    const token = [...remainingTokens, ...tokens].find((value) => CUOTA_TOKEN_REGEX.test(value));
    if (token) {
      planCuota = token;
      const [num, total] = planCuota.split("/").map((value) => Number(value));
      if (!Number.isNaN(num)) cuotaNumero = num;
      if (!Number.isNaN(total)) cuotaTotal = total;
    } else if (cuotaMatch) {
      planCuota = cuotaMatch[0];
      const [num, total] = planCuota.split("/").map((value) => Number(value));
      if (!Number.isNaN(num)) cuotaNumero = num;
      if (!Number.isNaN(total)) cuotaTotal = total;
    }
  }
  if (!isPlanCuota && tokens.length >= 4) {
    const possibleCupon = tokens[2];
    const possibleLast4 = tokens[3];
    if (/^\d+$/.test(possibleCupon)) {
      cupon = possibleCupon;
    }
    if (/^\d{4}$/.test(possibleLast4)) {
      last4 = possibleLast4;
    }
  }
  if (remainingTokens.length >= 3) {
    const amountToken = remainingTokens[remainingTokens.length - 1];
    if (DECIMAL_TOKEN_REGEX.test(amountToken)) {
      amountText = amountToken;
      amount = parseAmount(amountToken);
    }

    const candidateLast4 = remainingTokens[remainingTokens.length - 2];
    if (/^\d{4}$/.test(candidateLast4)) {
      last4 = candidateLast4;
    }

    const candidateCupon = remainingTokens[remainingTokens.length - 3];
    if (candidateCupon && /^\d+$/.test(candidateCupon)) {
      cupon = candidateCupon;
    }
  } else if (remainingTokens.length === 2) {
    const amountToken = remainingTokens[1];
    if (DECIMAL_TOKEN_REGEX.test(amountToken)) {
      amountText = amountToken;
      amount = parseAmount(amountToken);
    }

    const combined = remainingTokens[0];
    if (/^\d{4}$/.test(combined)) {
      last4 = combined;
    } else if (/^\d+$/.test(combined) && combined.length > 4) {
      last4 = combined.slice(-4);
      cupon = combined.slice(0, -4);
    }
  } else if (remainingTokens.length === 1) {
    const combined = remainingTokens[0];
    if (DECIMAL_TOKEN_REGEX.test(combined)) {
      const parsedCombined = splitCombinedToken(combined);
      if (parsedCombined) {
        last4 = parsedCombined.last4;
        cupon = parsedCombined.cupon;
        amount = parsedCombined.amount;
        amountText = parsedCombined.amountText;
      } else {
        amountText = combined;
        amount = parseAmount(combined);
      }
    }
  }

  const amountIndex = line.lastIndexOf(amountText);
  const lineBeforeAmount = amountIndex >= 0 ? line.slice(0, amountIndex) : line;
  const afterDate = lineBeforeAmount.slice(
    lineBeforeAmount.indexOf(dateMatch[0]) + dateMatch[0].length,
  );
  const numericTokens = afterDate.match(/\d+/g) ?? [];

  const remaining = [...numericTokens];
  if (last4) {
    const index = remaining.findIndex((token) => token === last4);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }
  if (cupon) {
    const index = remaining.findIndex((token) => token === cupon);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }
  if (!last4) {
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (remaining[i].length === 4) {
        last4 = remaining[i];
        remaining.splice(i, 1);
        break;
      }
    }
  }

  if (!last4) {
    const combinedIndex = remaining.findIndex((token) => token.length > 4);
    if (combinedIndex >= 0) {
      const combined = remaining[combinedIndex];
      last4 = combined.slice(-4);
      const cuponCandidate = combined.slice(0, -4);
      if (!cupon && cuponCandidate) {
        cupon = cuponCandidate;
      }
      remaining.splice(combinedIndex, 1);
    }
  }

  if (isPlanCuota && amountMatches?.length) {
    let maxAmount = 0;
    let maxText = amountText;
    for (const candidate of amountMatches) {
      const parsed = parseAmount(candidate);
      if (parsed > maxAmount) {
        maxAmount = parsed;
        maxText = candidate;
      }
    }
    amount = maxAmount;
    amountText = maxText;
  } else if (!amount && amountText) {
    amount = parseAmount(amountText);
  }

  if (!last4 && amountText) {
    const digits = amountText.replace(/\D/g, "");
    if (digits.length > 8) {
      const integerPart = digits.slice(0, -2);
      const decimals = digits.slice(-2);
      if (integerPart.length > 6) {
        const cuponCandidate = integerPart.slice(0, 2);
        const last4Candidate = integerPart.slice(2, 6);
        const amountInteger = integerPart.slice(6) || "0";
        const embeddedAmount = parseAmount(`${amountInteger}.${decimals}`);
        if (last4Candidate) {
          last4 = last4Candidate;
        }
        if (!cupon && cuponCandidate) {
          cupon = cuponCandidate;
        }
        if (embeddedAmount > 0) {
          amount = embeddedAmount;
        }
      }
    }
  }

  if (!last4) {
    const digitsBeforeAmount = lineBeforeAmount.replace(/\D/g, "");
    if (digitsBeforeAmount.length >= 4) {
      last4 = digitsBeforeAmount.slice(-4);
    }
  }

  if (!last4) {
    last4 = extractLast4(line);
  }

  if (remaining.length >= 3) {
    const candidateTerminal = remaining[remaining.length - 3];
    const candidateLote = remaining[remaining.length - 2];
    const candidateCupon = remaining[remaining.length - 1];
    if (!terminal && isValidTerminal(candidateTerminal)) terminal = candidateTerminal;
    if (!lote && isValidLote(candidateLote)) lote = candidateLote;
    if (!cupon && !isPlanCuota && isValidCupon(candidateCupon)) {
      cupon = candidateCupon;
    }
  } else if (remaining.length === 2) {
    if (!terminal && isValidTerminal(remaining[0])) terminal = remaining[0];
    if (!lote && isValidLote(remaining[1])) lote = remaining[1];
  } else if (remaining.length === 1) {
    if (!terminal && isValidTerminal(remaining[0])) terminal = remaining[0];
  }

  if (!isValidTerminal(terminal)) terminal = "";
  if (!isValidLote(lote)) lote = "";
  if (!isValidCupon(cupon)) cupon = "";
  if (!isValidLast4(last4)) last4 = "";

  const fallbackNumericTokens = tokens.flatMap((token) => {
    if (isDigitsOnly(token)) return [token];
    if (TERM_LOTE_CUPON_TOKEN_REGEX.test(token)) return token.match(/\d+/g) ?? [];
    return [];
  });

  if (!last4) {
    const candidate = [...fallbackNumericTokens].reverse().find((token) => token.length === 4);
    if (candidate) {
      last4 = candidate;
    }
  }

  if (!terminal || !lote || !cupon) {
    for (let i = 0; i <= fallbackNumericTokens.length - 3; i += 1) {
      const [possibleTerminal, possibleLote, possibleCupon] = fallbackNumericTokens.slice(i, i + 3);
      if (
        isValidTerminal(possibleTerminal) &&
        isValidLote(possibleLote) &&
        isValidCupon(possibleCupon)
      ) {
        terminal = terminal || possibleTerminal;
        lote = lote || possibleLote;
        cupon = cupon || possibleCupon;
        break;
      }
    }
  }

  if (!terminal || !lote || !cupon || !last4) {
    const combinedTokens = tokens.filter((token) => isDigitsOnly(token) && token.length >= 7);
    for (const token of combinedTokens) {
      if (!last4) {
        const parsedWithLast4 = splitTermLoteCuponWithLast4(token);
        if (parsedWithLast4) {
          terminal = terminal || parsedWithLast4.terminal;
          lote = lote || parsedWithLast4.lote;
          cupon = cupon || parsedWithLast4.cupon;
          last4 = last4 || parsedWithLast4.last4;
          if (terminal && lote && cupon && last4) break;
        }
      }
      if (!terminal || !lote || !cupon) {
        const parsed = splitTermLoteCuponDigits(token);
        if (parsed) {
          terminal = terminal || parsed.terminal;
          lote = lote || parsed.lote;
          cupon = cupon || parsed.cupon;
        }
      }
      if (terminal && lote && cupon && last4) break;
    }
  }

  return {
    id: randomUUID(),
    importId,
    fechaOperacion: date,
    terminal,
    lote,
    cupon,
    last4,
    amount,
    trxType: isPlanCuota ? "plan_cuota" : "venta_ctdo",
    planCuota,
    cuotaNumero,
    cuotaTotal,
    rawLine: line,
    lineIndex,
  };
};

const extractPdfTotal = (text: string): number | null => {
  const totalRegex = /total\s+(?:ventas?|de\s+ventas?|liquidaci[o\u00f3]n)\s*[:\-]?\s*([\d.,-]+)/gi;
  let match: RegExpExecArray | null;
  let lastAmount: string | null = null;

  while ((match = totalRegex.exec(text)) !== null) {
    lastAmount = match[1];
  }

  if (!lastAmount) return null;
  return parseAmount(lastAmount);
};

export interface PdfParseResult {
  lines: SettlementLine[];
  totalAmount: number | null;
}

export const parseFiservPdfText = (
  text: string,
  importId: string,
): PdfParseResult => {
  const rawLines = text.split(/\r?\n/).map(normalizeWhitespace).filter(Boolean);
  const splitOnMarker = (line: string, marker: RegExp) => {
    const matches = line.match(new RegExp(marker.source, "gi"));
    if (!matches || matches.length <= 1) return [line];
    return line
      .split(new RegExp(`(?=${marker.source})`, "gi"))
      .map((part) => part.trim())
      .filter(Boolean);
  };
  const expandedLines: string[] = [];
  for (const line of rawLines) {
    const planParts = splitOnMarker(line, /plan\s*cuota/i);
    for (const part of planParts) {
      const ventaParts = splitOnMarker(part, /venta\s+ctdo/i);
      expandedLines.push(...ventaParts);
    }
  }
  const lines: SettlementLine[] = [];

  for (let index = 0; index < expandedLines.length; index += 1) {
    const current = expandedLines[index];
    const hasVenta = /venta\s+ctdo/i.test(current);
    const hasPlan = PLAN_CUOTA_REGEX.test(current);
    const hasCuotaToken = CUOTA_TOKEN_REGEX.test(current);
    const hasAmount = (current.match(AMOUNT_REGEX)?.length ?? 0) > 0;
    const hasDateToken = hasDate(current);
    const looksLikeCuotaLine = hasCuotaToken && hasAmount && hasDateToken;

    if (!hasVenta && !hasPlan && !looksLikeCuotaLine) continue;

    let candidate = current;
    if (!hasDate(candidate) || (candidate.match(AMOUNT_REGEX)?.length ?? 0) === 0) {
      const next = expandedLines[index + 1];
      if (next) {
        candidate = `${candidate} ${next}`;
      }
    }

    const parsedLine = parseSettlementLine(candidate, importId, index);
    if (parsedLine) {
      lines.push(parsedLine);
    }
  }

  return {
    lines,
    totalAmount: extractPdfTotal(text),
  };
};

export const parseFiservPdf = async (
  buffer: Buffer,
  importId: string,
): Promise<PdfParseResult> => {
  const parsed = await pdf(buffer);
  return parseFiservPdfText(parsed.text, importId);
};
