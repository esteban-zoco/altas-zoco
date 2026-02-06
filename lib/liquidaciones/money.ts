export const toCents = (value: number) => Math.round(value * 100);

export const fromCents = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number((value / 100).toFixed(2));
};
