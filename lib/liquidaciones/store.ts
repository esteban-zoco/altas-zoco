import { promises as fs } from "fs";
import path from "path";

import { ImportType, SettlementImport } from "./types";

const dataDir = path.join(process.cwd(), "data", "liquidaciones");

const ensureDataDir = async () => {
  await fs.mkdir(dataDir, { recursive: true });
};

const collectionPath = (name: string) => path.join(dataDir, `${name}.json`);

export const readCollection = async <T>(name: string): Promise<T[]> => {
  await ensureDataDir();
  const filePath = collectionPath(name);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const writeCollection = async <T>(name: string, items: T[]) => {
  await ensureDataDir();
  const filePath = collectionPath(name);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
};

export const appendCollection = async <T>(name: string, items: T[]) => {
  const existing = await readCollection<T>(name);
  const merged = existing.concat(items);
  await writeCollection(name, merged);
  return merged;
};

export const getLatestImport = async (type: ImportType): Promise<SettlementImport | null> => {
  const imports = await readCollection<SettlementImport>("settlement_imports");
  const filtered = imports
    .filter((item) => item.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filtered[0] ?? null;
};
