export type ImportType = "csv" | "pdf";

export interface SettlementImport {
  id: string;
  type: ImportType;
  filename: string;
  createdAt: string;
  rowCount: number;
  totalAmount?: number | null;
}

export interface CsvTransaction {
  id: string;
  importId: string;
  orderId: string;
  transactionId: string;
  approval: string;
  amount: number;
  currency: string;
  date: string;
  dateTime?: string;
  last4: string;
  terminal?: string;
  lote?: string;
  cupon?: string;
  cardMasked: string;
  raw: Record<string, string>;
}

export interface SettlementLine {
  id: string;
  importId: string;
  fechaOperacion: string;
  terminal: string;
  lote: string;
  cupon: string;
  last4: string;
  amount: number;
  trxType?: "venta_ctdo" | "plan_cuota";
  planCuota?: string;
  cuotaNumero?: number;
  cuotaTotal?: number;
  rawLine: string;
  lineIndex: number;
}

export type ReconciliationStatus = "conciliado" | "sin_match" | "ambiguo";

export interface Reconciliation {
  id: string;
  csvImportId?: string;
  pdfImportId?: string;
  settlementLineId: string;
  csvTransactionId?: string;
  status: ReconciliationStatus;
  reason?: string;
  organizerId?: string;
  organizerName?: string;
  eventId?: string;
  orderId?: string;
  transactionId?: string;
  cupon?: string;
  amount: number;
  date: string;
  last4: string;
}

export interface OrganizerSummary {
  organizerId: string;
  organizerName: string;
  totalAmount: number;
  orderIds: string[];
  transactionIds: string[];
  reconciledCount: number;
}

export interface ReconciliationSummary {
  csvImport?: SettlementImport | null;
  pdfImport?: SettlementImport | null;
  totals: {
    settlementLines: number;
    csvTransactions: number;
    reconciled: number;
    sinMatch: number;
    ambiguo: number;
  };
  validations: {
    currencyARS: boolean;
    pdfTotal?: number | null;
    reconciledTotal: number;
    pdfTotalMatches?: boolean | null;
  };
  canGeneratePayments: boolean;
  reconciliations: Reconciliation[];
  byOrganizer: OrganizerSummary[];
}

export interface OrderInfo {
  orderId: string;
  organizerId: string;
  organizerName: string;
  eventId?: string;
}

