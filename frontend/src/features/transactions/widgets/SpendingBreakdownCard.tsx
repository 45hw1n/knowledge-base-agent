import { useMemo, type ReactNode } from "react";
import PaymentMode, {
  isPaymentModeType,
} from "@/components/common/PaymentMode";
import { EmptyState } from "@/components/EmptyState";
import { formatAmount } from "@/features/transactions/helpers/transactionReview.helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from "@/lib/ui";
import { cn } from "@/lib/utils";
import type {
  CreditCardSpendsWidget,
  PaymentModesWidget,
} from "./transactionWidget.types";
import { formatPaymentModeLabel } from "./widgetFormatters";

const TOP_LIMIT = 5;

interface BreakdownRowProps {
  label: ReactNode;
  amount: number;
  percent: number;
}

function BreakdownRow({ label, amount, percent }: BreakdownRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0 truncate">{label}</div>
      <div className="flex shrink-0 items-center gap-4 tabular-nums">
        <span className="text-muted-foreground">{percent}%</span>
        <span className="min-w-[5.5rem] text-right font-medium">
          {formatAmount(amount)}
        </span>
      </div>
    </li>
  );
}

interface SpendingBreakdownCardProps {
  loading?: boolean;
  creditCardSpends: CreditCardSpendsWidget | null | undefined;
  paymentModes: PaymentModesWidget | null | undefined;
  className?: string;
}

export function SpendingBreakdownCard({
  loading = false,
  creditCardSpends,
  paymentModes,
  className,
}: SpendingBreakdownCardProps) {
  const { visibleCreditCards, hiddenCreditCardCount, totalCreditCardCount } =
    useMemo(() => {
      const cards = [...(creditCardSpends?.cards ?? [])].sort(
        (left, right) => right.amount - left.amount,
      );

      return {
        visibleCreditCards: cards.slice(0, TOP_LIMIT),
        hiddenCreditCardCount: Math.max(cards.length - TOP_LIMIT, 0),
        totalCreditCardCount: cards.length,
      };
    }, [creditCardSpends?.cards]);

  const { visibleModes, hiddenModeCount } = useMemo(() => {
    const modes = [...(paymentModes?.modes ?? [])].sort(
      (left, right) => right.amount - left.amount,
    );

    return {
      visibleModes: modes.slice(0, TOP_LIMIT),
      hiddenModeCount: Math.max(modes.length - TOP_LIMIT, 0),
    };
  }, [paymentModes?.modes]);

  const showCreditCardSection = (creditCardSpends?.total ?? 0) > 0;
  const isEmpty =
    !loading && !showCreditCardSection && visibleModes.length === 0;

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle>Payment Breakdown</CardTitle>
        <CardDescription>
          How you paid — across cards, UPI, and other modes.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col gap-4", isEmpty && "justify-center")}>
        {loading ? (
          <>
            <Skeleton className="h-6 w-40 max-w-[80%] rounded-md bg-muted animate-pulse" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                PAYMENT MODE
              </h3>
              <ul className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <li key={index}>
                    <div className="flex w-full items-center justify-between gap-6 leading-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <Skeleton className="h-4 w-60 rounded-md bg-muted animate-pulse" />
                      </div>
                      <Skeleton className="h-4 w-20 shrink-0 rounded-md bg-muted animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            {showCreditCardSection && (
              <div className="space-y-3">
                <p className="leading-tight">
                  <span className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                    {formatAmount(creditCardSpends?.total ?? 0)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    spent using credit card
                  </span>
                </p>

                {visibleCreditCards.length > 0 && (
                  <>
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {totalCreditCardCount > 1
                          ? `CREDIT CARDS (${totalCreditCardCount})`
                          : "CREDIT CARD"}
                      </p>
                    </div>
                    <ul className="space-y-3 pt-1">
                      {visibleCreditCards.map((card) => (
                        <BreakdownRow
                          key={card.name}
                          label={
                            <span className="font-normal">{card.name}</span>
                          }
                          amount={card.amount}
                          percent={card.percent}
                        />
                      ))}
                      {hiddenCreditCardCount > 0 && (
                        <li className="text-sm text-muted-foreground">
                          +{hiddenCreditCardCount} more
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}

            {showCreditCardSection && <Separator />}

            <div className="space-y-3">
              {visibleModes.length > 0 && (
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {`PAYMENT MODES (${visibleModes.length})`}
                </h3>
              )}

              {visibleModes.length > 0 ? (
                <ul className="space-y-3 pt-1">
                  {visibleModes.map((mode) => (
                    <BreakdownRow
                      key={mode.mode}
                      label={
                        isPaymentModeType(mode.mode) ? (
                          <PaymentMode
                            mode={mode.mode}
                            className="min-w-0 truncate"
                            iconClassName="size-5"
                          />
                        ) : (
                          <span className="font-normal">
                            {formatPaymentModeLabel(mode.mode)}
                          </span>
                        )
                      }
                      amount={mode.amount}
                      percent={mode.percent}
                    />
                  ))}
                  {hiddenModeCount > 0 && (
                    <li className="text-sm text-muted-foreground">
                      +{hiddenModeCount} more
                    </li>
                  )}
                </ul>
              ) : (
                <EmptyState
                  heading="No transactions detected"
                  message="Payment mode insights appear here"
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
