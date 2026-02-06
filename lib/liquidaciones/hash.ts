import { createHash } from "crypto";

export const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export const sha256Text = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
