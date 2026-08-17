import React from "react";  
import { InboxIcon } from "lucide-react";
import { CarouselList } from "@/components/CarouselList";
import { ListInfo } from "@/store/useTableStore";
import {
  GET_TRANSACTIONS_TO_REVIEW,
  TransactionToReview,
  transactionReviewDefaultListInfo,
} from "./transactionReview.types";
import { TransactionReviewCardWithActions } from "./TransactionReviewCardWithActions";

function buildTransactionReviewListVariables(listInfo: ListInfo): Record<string, unknown> {
  return {
    input: {
      listInfo: {
        page: listInfo.page,
        pageSize: listInfo.pageSize,
        sort: [{ attribute: "createdAt", order: "DESC" }],
        conditions: {
          operator: "AND",
          operands: [
            { attribute: "status", operator: "is", value: "READY_TO_REVIEW" },
          ],
        },
      },
    },
  };
}

export function TransactionToReviewCarousel() {
  return (
    <section className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Review Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Transactions waiting for your approval.
        </p>
      </div>

      <CarouselList<TransactionToReview>
        id="transactions-to-review"
        name="transactionsToReview"
        query={GET_TRANSACTIONS_TO_REVIEW}
        accessorKey="getTransactionsToReview"
        defaultListInfo={transactionReviewDefaultListInfo}
        variablesBuilder={buildTransactionReviewListVariables}
        isListInfo
        minCardWidth={340}
        emptyState={{ message: "All caught up — no transactions to review.", icon: <InboxIcon className="h-8 w-8" />}}
        card={TransactionReviewCardWithActions}
      />
    </section>
  );
}
