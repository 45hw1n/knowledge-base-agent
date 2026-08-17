import type { ConditionInput } from '../listing/core/types';

export type WidgetType =
  | 'TOTAL_SPENDS'
  | 'SPEND_BY_CATEGORY'
  | 'CREDIT_CARD_SPENDS'
  | 'TOP_MERCHANTS'
  | 'PAYMENT_MODES'
  | 'TREND';

export interface WidgetRequest {
  type: WidgetType;
  config?: Record<string, unknown>;
}

export interface GetTransactionWidgetsInput {
  conditions: ConditionInput;
  widgets: WidgetRequest[];
}

export interface TransactionCategory {
  id: string | null;
  value: string | null;
  label: string | null;
}

export interface PaymentSource {
  kind: string;
  instrumentId: string | null;
  displayName: string | null;
  last4: string | null;
  bank: string | null;
}

export interface NormalizedTransaction {
  id: string;
  amount: number;
  date: string | null;
  merchant: string;
  category: TransactionCategory | null;
  paymentMode: string;
  paymentSource: PaymentSource | null;
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

export type WidgetData =
  | TotalSpendsWidget
  | SpendByCategoryWidget
  | CreditCardSpendsWidget
  | TopMerchantsWidget
  | PaymentModesWidget
  | TrendWidget;

export type WidgetBuilder<TConfig = Record<string, unknown>> = (
  transactions: NormalizedTransaction[],
  config?: TConfig
) => WidgetData;

export interface TransactionWidgetsMap {
  TOTAL_SPENDS?: TotalSpendsWidget | null;
  SPEND_BY_CATEGORY?: SpendByCategoryWidget | null;
  CREDIT_CARD_SPENDS?: CreditCardSpendsWidget | null;
  TOP_MERCHANTS?: TopMerchantsWidget | null;
  PAYMENT_MODES?: PaymentModesWidget | null;
  TREND?: TrendWidget | null;
}

export interface GetTransactionWidgetsResponse {
  data: {
    widgets: TransactionWidgetsMap;
  };
}
