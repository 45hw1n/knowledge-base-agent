import { gql } from "@apollo/client";
import { Attachment } from "@/features/attachments/types";

export interface PaymentSource {
  kind: string;
  instrumentId: string;
  displayName: string | null;
  last4: string | null;
  bank: string | null;
}

export interface TransactionCategory {
  id: string | null;
  value: string | null;
  label: string | null;
}

export interface Transaction {
  id: string;
  displayId: string;
  amount: number;
  currency: string;
  type: string;
  date: string;
  name: string;
  merchant: string;
  merchantNormalized: string | null;
  notes: string | null;
  category: TransactionCategory | null;
  subCategory: TransactionCategory | null;
  cycle: string;
  paymentSource: PaymentSource | null;
  paymentMode: string;
  isCreditCardRepayment: boolean;
  isPrivate: boolean;
  approvalActor: string | null;
  source: string | null;
  sheetSyncStatus: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string | null;
}

export interface EditTransactionChanges {
  name?: string;
  notes?: string;
  date?: string;
  cycle?: string;
  amount?: number;
  category?: TransactionCategory | null;
  subCategory?: TransactionCategory | null;
  paymentMode?: string;
  paymentSource?: { kind: string; instrumentId: string } | null;
  isCreditCardRepayment?: boolean;
  isPrivate?: boolean;
}

export interface CreateTransactionInput {
  amount: number;
  type: string;
  date: string;
  name: string;
  merchant?: string;
  cycle?: string;
  category?: TransactionCategory | null;
  subCategory?: TransactionCategory | null;
  paymentMode: string;
  paymentSource: { kind: string; instrumentId: string };
  isCreditCardRepayment?: boolean;
  isPrivate?: boolean;
  notes?: string;
  currency?: string;
}

export const GET_TRANSACTIONS = gql`
  query GetTransactions($input: GetTransactionsInput!) {
    getTransactions(input: $input) {
      data {
        id
        displayId
        date
        name
        merchant
        merchantNormalized
        amount
        currency
        type
        cycle
        category {
          id
          value
          label
        }
        subCategory {
          id
          value
          label
        }
        paymentSource {
          kind
          instrumentId
          displayName
          last4
          bank
        }
        paymentMode
        notes
        isCreditCardRepayment
        isPrivate
        approvalActor
        sheetSyncStatus
        attachments {
          id
          fileName
          mimeType
          size
          uploadedAt
        }
      }
      listInfo {
        page
        pageSize
        sort {
          attribute
          order
        }
      }
      pagination {
        total
        totalPages
        hasNext
        hasPrevious
      }
    }
  }
`;

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      success
      transaction {
        id
        displayId
        amount
        name
      }
      error {
        code
        message
      }
    }
  }
`;

export const EDIT_TRANSACTION = gql`
  mutation EditTransaction($input: EditTransactionInput!) {
    editTransaction(input: $input) {
      success
      transaction {
        id
        displayId
        amount
        name
      }
      error {
        code
        message
      }
    }
  }
`;

export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($input: DeleteTransactionInput!) {
    deleteTransaction(input: $input) {
      success
      error {
        code
        message
      }
    }
  }
`;

export type TransactionExportType = "CSV" | "XLSX";

export const EXPORT_TRANSACTIONS = gql`
  mutation ExportTransactions($input: ExportTransactionsInput!) {
    exportTransactions(input: $input) {
      success
      fileName
      mimeType
      contentBase64
      rowCount
      error {
        code
        message
      }
    }
  }
`;
