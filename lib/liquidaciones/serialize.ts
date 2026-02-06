import { ObjectId } from "mongodb";

export const toId = (value: ObjectId | string) =>
  typeof value === "string" ? value : value.toString();

export const toIso = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
};
