import { Db, MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClient?: MongoClient;
  _mongoDb?: Db;
  _mongoIndexesPromise?: Promise<void>;
};

let cachedClient: MongoClient | null = globalForMongo._mongoClient ?? null;
let cachedDb: Db | null = globalForMongo._mongoDb ?? null;
let cachedIndexesPromise: Promise<void> | null =
  globalForMongo._mongoIndexesPromise ?? null;

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no esta configurado");
  }
  return uri;
};

const getDbName = () => process.env.MONGODB_DB || "zoco_altas";

export const getDb = async (): Promise<Db> => {
  if (cachedDb) return cachedDb;

  const client = cachedClient ?? new MongoClient(getMongoUri());
  if (!cachedClient) {
    cachedClient = client;
    globalForMongo._mongoClient = client;
    await client.connect();
  }

  cachedDb = client.db(getDbName());
  globalForMongo._mongoDb = cachedDb;
  return cachedDb;
};

export const ensureIndexes = async (): Promise<void> => {
  if (cachedIndexesPromise) return cachedIndexesPromise;

  cachedIndexesPromise = (async () => {
    const db = await getDb();
    await db.collection("settlements").createIndexes([
      { key: { hashPdf: 1, hashCsv: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { liquidationDate: 1 } },
      { key: { createdAt: -1 } },
    ]);
    await db.collection("settlement_lines").createIndexes([
      { key: { settlementId: 1 } },
      { key: { opDate: 1 } },
      { key: { lineHash: 1 }, unique: true, sparse: true },
    ]);
    await db.collection("fiserv_transactions").createIndexes([
      { key: { settlementId: 1 } },
      { key: { orderId: 1 } },
      { key: { opDate: 1 } },
      { key: { txHash: 1 }, unique: true, sparse: true },
    ]);
    await db.collection("reconciliations").createIndexes([
      { key: { settlementId: 1 } },
      { key: { status: 1 } },
      { key: { organizerId: 1 } },
    ]);
    await db.collection("payout_batches").createIndexes([
      { key: { organizerId: 1 } },
      { key: { paidAt: -1 } },
    ]);
  })();
  globalForMongo._mongoIndexesPromise = cachedIndexesPromise;

  return cachedIndexesPromise;
};
