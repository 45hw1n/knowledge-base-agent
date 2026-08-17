import { gql } from "@apollo/client";
import { ListInfo } from "@/store/useTableStore";
import { Attachment } from "@/features/attachments/types";

export interface TransactionToReviewCategory {
  id: string | null;
  value: string | null;
  label: string | null;
}

export interface TransactionToReviewPaymentSource {
  kind: string;
  instrumentId: string;
  displayName: string | null;
  last4: string | null;
  bank: string | null;
}

export interface TransactionToReview {
  id: string;
  amount: number;
  currency: string | null;
  type: string | null;
  date: string | null;
  name: string | null;
  merchant: string;
  merchantRaw: string | null;
  notes: string | null;
  category: TransactionToReviewCategory | null;
  subCategory: TransactionToReviewCategory | null;
  cycle: string | null;
  paymentSource: TransactionToReviewPaymentSource | null;
  paymentMode: string | null;
  isCreditCardRepayment: boolean;
  isPrivate?: boolean;
  status: string;
  aiConfidence: number | null;
  referenceId: string | null;
  approvedAt: string | null;
  transactionId: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string | null;
}

export const GET_TRANSACTIONS_TO_REVIEW = gql`
  query GetTransactionsToReview($input: GetTransactionsToReviewInput!) {
    getTransactionsToReview(input: $input) {
      data {
        id
        amount
        currency
        type
        date
        name
        merchant
        merchantRaw
        notes
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
        cycle
        paymentSource {
          kind
          instrumentId
          displayName
          last4
          bank
        }
        paymentMode
        isCreditCardRepayment
        status
        aiConfidence
        referenceId
        approvedAt
        transactionId
        attachments {
          id
          fileName
          mimeType
          size
          uploadedAt
        }
        createdAt
        updatedAt
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

export interface ApproveTransactionChanges {
  name?: string;
  notes?: string;
  date?: string;
  cycle?: string;
  amount?: number;
  category?: TransactionToReviewCategory | null;
  subCategory?: TransactionToReviewCategory | null;
  paymentMode?: string;
  paymentSource?: { kind: string; instrumentId: string } | null;
  isCreditCardRepayment?: boolean;
  isPrivate?: boolean;
}

export const APPROVE_TRANSACTION = gql`
  mutation ApproveTransaction($input: ApproveTransactionInput!) {
    approveTransaction(input: $input) {
      success
      transaction {
        id
        displayId
        amount
        name
      }
      review {
        id
        status
      }
      error {
        code
        message
      }
    }
  }
`;

export const REJECT_TRANSACTION = gql`
  mutation RejectTransaction($input: RejectTransactionInput!) {
    rejectTransaction(input: $input) {
      success
      review {
        id
        status
        rejectedAt
        rejectionNote
      }
      error {
        code
        message
      }
    }
  }
`;

export const transactionReviewDefaultListInfo: ListInfo = {
  page: 1,
  pageSize: 10,
  total: 0,
  sort: { key: "createdAt", order: "desc" },
  filters: {},
};

export const PAYMENT_MODE_OPTIONS = [
  { value: "UPI", label: "UPI" },
  { value: "CARD_PAYMENT", label: "Card Payment" },
  { value: "ATM_WITHDRAWAL", label: "ATM Withdrawal" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "ONLINE_TRANSACTION", label: "Online Transaction" },
] as const;
