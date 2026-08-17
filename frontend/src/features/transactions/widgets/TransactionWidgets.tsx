import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { SpendingBreakdownCard } from "./SpendingBreakdownCard";
import { SpendByCategoryCard } from "./SpendByCategoryCard";
import { SpentThisCycleCard } from "./SpentThisCycleCard";
import { SpendingTrendCard } from "./SpendingTrendCard";
import { TransactionWidgetsError } from "./TransactionWidgetsError";
import {
  GET_TRANSACTION_WIDGETS,
  WIDGET_REQUESTS,
  type GetTransactionWidgetsResponse,
  type TransactionWidgetsFilters,
} from "./transactionWidget.types";

interface TransactionWidgetsProps {
  filters: TransactionWidgetsFilters;
}

export function TransactionWidgets({ filters }: TransactionWidgetsProps) {
  const variables = useMemo(
    () => ({
      input: {
        conditions: filters.conditions,
        widgets: WIDGET_REQUESTS,
      },
    }),
    [filters.conditions],
  );

  const { data, loading, error } = useQuery<GetTransactionWidgetsResponse>(
    GET_TRANSACTION_WIDGETS,
    {
      variables,
      skip: !filters.conditions,
    },
  );

  const widgets = data?.getTransactionWidgets.data.widgets;

  return (
    <section className="space-y-4">
      {!loading && error && (
        <TransactionWidgetsError message={error.message} />
      )}

      {!error && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
            <SpentThisCycleCard
              className="h-full"
              loading={loading}
              totalSpends={widgets?.TOTAL_SPENDS}
              topMerchants={widgets?.TOP_MERCHANTS}
            />
            <SpendByCategoryCard
              className="h-full"
              loading={loading}
              spendByCategory={widgets?.SPEND_BY_CATEGORY}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SpendingBreakdownCard
              className="h-full"
              loading={loading}
              creditCardSpends={widgets?.CREDIT_CARD_SPENDS}
              paymentModes={widgets?.PAYMENT_MODES}
            />
            <SpendingTrendCard
              className="h-full"
              loading={loading}
              trend={widgets?.TREND}
            />
          </div>
        </div>
      )}
    </section>
  );
}


