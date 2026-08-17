import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatAmount } from "@/features/transactions/helpers/transactionReview.helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/lib/ui";
import { cn } from "@/lib/utils";
import type {
  TopMerchantsWidget,
  TotalSpendsWidget,
} from "./transactionWidget.types";

interface SpentThisCycleCardProps {
  loading?: boolean;
  totalSpends: TotalSpendsWidget | null | undefined;
  topMerchants: TopMerchantsWidget | null | undefined;
  className?: string;
}

export function SpentThisCycleCard({
  loading = true,
  totalSpends,
  topMerchants,
  className,
}: SpentThisCycleCardProps) {
  const merchants = useMemo(
    () => topMerchants?.merchants?.slice(0, 5) ?? [],
    [topMerchants?.merchants],
  );
  const isEmpty = !loading && merchants.length === 0;

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle>Total spend</CardTitle>
        <CardDescription>How much you spent and where</CardDescription>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col gap-4", isEmpty && "justify-center")}>
        {!isEmpty && (
          <div>
            <span className="text-3xl tracking-tight font-bold ">
              {loading ? <Skeleton className="h-8 w-32 bg-muted animate-pulse rounded-md max-w-[80%] inline-block" /> : formatAmount(totalSpends?.amount ?? 0)}
            </span>{" "}
            <span className="text-sm text-muted-foreground ml-2">
              Total spent
            </span>
          </div>
        )}

        <div className="space-y-2">
          {!isEmpty && (
            <p className="text-sm font-semibold text-muted-foreground">
              TOP MERCHANTS
            </p>
          )}
          {loading ? (
            <ul className="space-y-3 pt-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={index}>
                  <Skeleton className="h-4 w-full bg-muted animate-pulse rounded-md max-w-[80%]" />
                </li>
              ))}
            </ul>
          ) : merchants.length > 0 ? (
            <ul className="space-y-2">
              {merchants.map((merchant) => (
                <li
                  key={merchant.merchant}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-normal">
                    {merchant.merchant}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatAmount(merchant.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              heading="No transactions detected"
              message="Your spending summary will appear here."
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
