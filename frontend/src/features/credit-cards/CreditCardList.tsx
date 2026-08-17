import React, { useMemo } from "react";
import { SuperTable } from "@/components/SuperTable";
import { GET_CREDIT_CARDS } from "./creditCard.types";
import { creditCardColumns } from "./creditCard.columns";
import { CreateCreditCard } from "@/components/credit-card/create-credit-card";
import { useTableHook } from "@/hooks/useTableHook";
import { ListInfo } from "@/store/useTableStore";
import { WalletCardsIcon } from "lucide-react";

const CREDIT_CARD_PAGE_SIZE = 5;
const EMPTY_FILTER: ListInfo['filters'] = {};

export function CreditCardList() {
  const defaultListInfo = useMemo(
    (): ListInfo => ({
      page: 1,
      pageSize: CREDIT_CARD_PAGE_SIZE,
      total: 0,
      sort: null,
      filters: {},
    }),
    [],
  );

  const { refreshTable } = useTableHook({
    id: "credit-cards",
    name: "creditCards",
    defaultListInfo,
  });

  return (
    <section id="credit-cards-section" className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="mr-2">💳</span> Credit Cards
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your credit cards.
          </p>
        </div>
        <CreateCreditCard onCompleted={() => refreshTable({ reset: true })} />
      </div>
      <SuperTable
        id="credit-cards"
        name="creditCards"
        columns={creditCardColumns}
        query={GET_CREDIT_CARDS}
        accessorKey="getCreditCards"
        isListInfo={false}
        defaultSort={null}
        defaultFilter={EMPTY_FILTER}
        defaultPageSize={CREDIT_CARD_PAGE_SIZE}
        emptyState={{
          icon: <WalletCardsIcon className="h-8 w-8" />,
          message: "Add available credit cards",
          action: () => {
            return (
              <CreateCreditCard
                variant="outline"
                onCompleted={() => refreshTable({ reset: true })}
              />
            );
          },
        }}
      />
    </section>
  );
}
