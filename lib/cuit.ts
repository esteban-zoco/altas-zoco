export const sanitizeCuitInput = (value: string) =>
  value.replace(/\D/g, "").slice(0, 11);

export const formatCuit = (value: string) => {
  const digits = sanitizeCuitInput(value);
  if (!digits) return "";
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 10);
  const part3 = digits.slice(10, 11);
  return [part1, part2, part3].filter(Boolean).join("-");
};

export const isValidCuit = (value: string) => {
  const digits = sanitizeCuitInput(value);
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (acc, weight, index) => acc + weight * Number(digits[index]),
    0,
  );
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return checkDigit === Number(digits[10]);
};
