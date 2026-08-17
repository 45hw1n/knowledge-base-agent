import { apolloClient } from "@/lib/apollo/apolloClient";
import { refreshTableByKey, type ListInfo } from "@/store/useTableStore";
import { GET_TRANSACTION_WIDGETS } from "./widgets/transactionWidget.types";

export const TRANSACTIONS_TABLE_KEY = "transactions__transactions";

export function refreshTransactionWidgets() {
  return apolloClient.refetchQueries({ include: [GET_TRANSACTION_WIDGETS] });
}

export function refreshTransactions(options?: {
  reset?: boolean;
  override?: Partial<ListInfo>;
}) {
  refreshTableByKey(TRANSACTIONS_TABLE_KEY, options);
  return refreshTransactionWidgets();
}
