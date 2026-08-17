import { AccessTokenRevokedAlert } from "@/components/AccessTokenRevokedAlert";
import {
  getInitialTransactionFilterCondition,
  TransactionPeriodFilter,
} from "@/components/common/TransactionPeriodFilter";
import { PageContent } from "@/components/page-layout";
import { ProcessDebitEmailAlert } from "@/components/ProcessDebitEmailAlert";
import {
  TransactionList,
  type TransactionListCondition,
} from "@/features/transactions/TransactionList";
import {
  buildWidgetConditions,
  TransactionWidgets,
} from "@/features/transactions/widgets";
import { useAppStore } from "@/store/appStore";
import { useMemo, useState } from "react";

export default function HomePage() {
  const [filterCondition, setFilterCondition] =
    useState<TransactionListCondition | null>(
      getInitialTransactionFilterCondition,
    );

  const showPrivateEntity = useAppStore(
    (state) => state.appStatus?.showPrivateEntity ?? false,
  );

  const widgetFilters = useMemo(
    () => ({
      conditions: buildWidgetConditions(filterCondition, showPrivateEntity),
    }),
    [filterCondition, showPrivateEntity],
  );

  return (
    <PageContent>
      <AccessTokenRevokedAlert />
      <ProcessDebitEmailAlert />
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 sm:shrink">
          <h2 className="text-xl font-semibold tracking-tight">
            Transaction overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Overview of your transactions.
          </p>
        </div>
        <div className="shrink-0">
          <TransactionPeriodFilter onFilterChange={setFilterCondition} />
        </div>
      </div>
      <TransactionWidgets filters={widgetFilters} />
      <TransactionList filterCondition={filterCondition} />
    </PageContent>
  );
}
