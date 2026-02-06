import { normalizeDate } from "./utils";

const TIME_REGEX = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
const DATE_REGEX = /(\d{1,2}[/\-][A-Za-z]{3,}[/\-]\d{4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{4})/;

export const parseCsvDateTime = (value: string): string | null => {
  const dateMatch = value.match(DATE_REGEX);
  if (!dateMatch) return null;
  const date = normalizeDate(dateMatch[0]);
  if (!date) return null;

  const timeMatch = value.match(TIME_REGEX);
  const [year, month, day] = date.split("-").map((part) => Number(part));
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeMatch) {
    hours = Number(timeMatch[1] ?? 0);
    minutes = Number(timeMatch[2] ?? 0);
    seconds = Number(timeMatch[3] ?? 0);
  }

  const dateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  return dateTime.toISOString();
};
