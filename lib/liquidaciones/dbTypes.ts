import { ObjectId } from "mongodb";

export type SettlementStatus =
  | "imported"
  | "reconciled"
  | "ready_to_pay"
  | "needs_review"
  | "paid"
  | "partial";

export interface SettlementTotals {
  grossCents: number | null;
  feesCents: number | null;
  taxesCents: number | null;
  netCents: number | null;
}

export interface SettlementDoc {
  _id: ObjectId;
  provider: "fiserv";
  cardBrand: string;
  liquidationDate: string | null;
  liquidationNumber: string | null;
  sourcePdfFilename: string;
  sourceCsvFilename: string;
  hashPdf: string;
  hashCsv: string;
  status: SettlementStatus;
  totals: SettlementTotals;
  createdAt: Date;
  createdBy: string;
}

export interface SettlementLineDoc {
  _id: ObjectId;
  settlementId: ObjectId;
  opDate: string;
  terminal: string | null;
  lote: string | null;
  cupon: string | null;
  last4: string;
  amountCents: number;
  lineHash: string;
  trxType?: "venta_ctdo" | "plan_cuota";
  planCuota?: string | null;
  cuotaNumero?: number | null;
  cuotaTotal?: number | null;
  rawLine: string;
  createdAt: Date;
}

export interface FiservTransactionDoc {
  _id: ObjectId;
  settlementId: ObjectId;
  orderId: string;
  transactionId: string;
  approval: string;
  last4: string;
  amountCents: number;
  opDate: string;
  opDateTime: string | null;
  currency: string;
  terminal: string | null;
  lote: string | null;
  cupon: string | null;
  txHash: string;
  createdAt: Date;
}

export type ReconciliationStatus = "reconciled" | "needs_review" | "excluded" | "paid";

export interface ReconciliationDoc {
  _id: ObjectId;
  settlementId: ObjectId;
  settlementLineId: ObjectId;
  fiservTransactionId?: ObjectId;
  orderId?: string;
  organizerId?: string;
  organizerName?: string;
  eventId?: string;
  transactionId?: string;
  matchType: "exact_tx" | "exact_coupon" | "exact_key";
  matchKey: string;
  status: ReconciliationStatus;
  reason?: string;
  amountCents: number;
  opDate: string;
  last4: string;
  cupon?: string | null;
  audit: {
    matchedAt: Date;
    matchedBy: string;
    evidence: {
      pdfKey: string;
      csvKey?: string | null;
    };
  };
  createdAt: Date;
}

export interface PayoutBatchDoc {
  _id: ObjectId;
  organizerId: string;
  organizerName: string;
  totalCents: number;
  currency: string;
  settlementIds: ObjectId[];
  reconciliationIds: ObjectId[];
  bankReference: string;
  note?: string;
  paidAt: Date;
  paidBy: string;
  createdAt: Date;
}
