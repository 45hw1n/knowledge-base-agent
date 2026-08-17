import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatAmount } from "@/features/transactions/helpers/transactionReview.helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { TrendWidget } from "./transactionWidget.types";
import { TREND_CHART_CONFIG } from "./widgetChartConfig";
import { formatTrendDate, formatTrendTooltipDate } from "./widgetFormatters";
import { EmptyState } from "@/components/EmptyState";

const LOADING_BAR_AMOUNTS = [42, 68, 55, 80, 48, 72, 60, 85];

const LOADING_BAR_DATA = LOADING_BAR_AMOUNTS.map((amount, index) => ({
  displayDate: `loading-${index}`,
  amount,
}));

interface SpendingTrendCardProps {
  loading?: boolean;
  trend: TrendWidget | null | undefined;
  className?: string;
}

export function SpendingTrendCard({
  loading = false,
  trend,
  className,
}: SpendingTrendCardProps) {
  const chartData = useMemo(() => {
    const points = trend?.points ?? [];

    return [...points]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((point) => ({
        date: point.date,
        displayDate: formatTrendDate(point.date),
        tooltipDate: formatTrendTooltipDate(point.date),
        amount: point.amount,
      }));
  }, [trend?.points]);

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle>Spending trend</CardTitle>
        <CardDescription>Daily spending pattern over time</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        {loading ? (
          <ChartContainer
            config={TREND_CHART_CONFIG}
            className="aspect-auto h-[220px] w-full animate-pulse"
          >
            <BarChart
              data={LOADING_BAR_DATA}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tick={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={false}
                width={50}
              />
              <Bar
                dataKey="amount"
                fill="hsl(0 0% 35%)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        ) : chartData.length > 0 ? (
          <ChartContainer
            config={TREND_CHART_CONFIG}
            className="aspect-auto h-[220px] w-full"
          >
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={50}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat("en-IN", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.tooltipDate ?? "")
                    }
                    hideIndicator
                    formatter={(value) => (
                      <div className="flex w-full justify-between gap-4 leading-none">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {formatAmount(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                name="Amount"
                dataKey="amount"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[150px] flex items-center justify-center">
            <EmptyState
              heading="No transactions detected"
              message="Spending trend insights will appear here."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
