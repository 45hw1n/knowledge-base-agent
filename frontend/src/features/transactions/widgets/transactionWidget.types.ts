import { gql } from "@apollo/client";
import type { TransactionListCondition } from "@/features/transactions/TransactionList";

export type TransactionWidgetType =
  | "TOTAL_SPENDS"
  | "SPEND_BY_CATEGORY"
  | "CREDIT_CARD_SPENDS"
  | "TOP_MERCHANTS"
  | "PAYMENT_MODES"
  | "TREND";

export interface WidgetRequestInput {
  type: TransactionWidgetType;
  config?: Record<string, unknown>;
}

export interface TotalSpendsWidget {
  amount: number;
  transactionCount: number;
}

export interface SpendByCategoryItem {
  category: string;
  amount: number;
  percent: number;
  transactionCount: number;
}

export interface SpendByCategoryWidget {
  total: number;
  categories: SpendByCategoryItem[];
}

export interface CreditCardSpendItem {
  name: string;
  amount: number;
  percent: number;
}

export interface CreditCardSpendsWidget {
  total: number;
  cards: CreditCardSpendItem[];
}

export interface TopMerchantItem {
  merchant: string;
  amount: number;
  percent: number;
  transactionCount: number;
}

export interface TopMerchantsWidget {
  total: number;
  merchants: TopMerchantItem[];
}

export interface PaymentModeItem {
  mode: string;
  amount: number;
  percent: number;
  transactionCount: number;
}

export interface PaymentModesWidget {
  total: number;
  modes: PaymentModeItem[];
}

export interface TrendPoint {
  date: string;
  amount: number;
}

export interface TrendWidget {
  total: number;
  points: TrendPoint[];
}

export interface TransactionWidgetsMap {
  TOTAL_SPENDS?: TotalSpendsWidget | null;
  SPEND_BY_CATEGORY?: SpendByCategoryWidget | null;
  CREDIT_CARD_SPENDS?: CreditCardSpendsWidget | null;
  TOP_MERCHANTS?: TopMerchantsWidget | null;
  PAYMENT_MODES?: PaymentModesWidget | null;
  TREND?: TrendWidget | null;
}

export interface GetTransactionWidgetsResponse {
  getTransactionWidgets: {
    data: {
      widgets: TransactionWidgetsMap;
    };
  };
}

export interface TransactionWidgetsFilters {
  conditions: TransactionListCondition;
}

export interface GetTransactionWidgetsInput {
  conditions: TransactionListCondition;
  widgets: WidgetRequestInput[];
}

export const WIDGET_REQUESTS: WidgetRequestInput[] = [
  { type: "TOTAL_SPENDS" },
  { type: "TOP_MERCHANTS", config: { limit: 5 } },
  { type: "SPEND_BY_CATEGORY" },
  { type: "CREDIT_CARD_SPENDS" },
  { type: "TREND" },
  { type: "PAYMENT_MODES" },
];

export const GET_TRANSACTION_WIDGETS = gql`
  query GetTransactionWidgets($input: GetTransactionWidgetsInput!) {
    getTransactionWidgets(input: $input) {
      data {
        widgets {
          TOTAL_SPENDS {
            amount
            transactionCount
          }
          TOP_MERCHANTS {
            total
            merchants {
              merchant
              amount
              percent
              transactionCount
            }
          }
          SPEND_BY_CATEGORY {
            total
            categories {
              category
              amount
              percent
              transactionCount
            }
          }
          CREDIT_CARD_SPENDS {
            total
            cards {
              name
              amount
              percent
            }
          }
          TREND {
            total
            points {
              date
              amount
            }
          }
          PAYMENT_MODES {
            total
            modes {
              mode
              amount
              percent
              transactionCount
            }
          }
        }
      }
    }
  }
`;
