import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { EmptyState } from "@/components/EmptyState";
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
  Skeleton,
} from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "@/lib/ui/chart";
import type { SpendByCategoryWidget } from "./transactionWidget.types";
import { buildCategoryChartConfig } from "./widgetChartConfig";
import { formatCategoryLabel } from "./widgetFormatters";

const LOADING_PIE_COLORS = [
  "hsl(0 0% 55%)",
  "hsl(0 0% 45%)",
  "hsl(0 0% 35%)",
  "hsl(0 0% 25%)",
  "hsl(0 0% 15%)",
] as const;

const LOADING_PIE_DATA = LOADING_PIE_COLORS.map((fill, index) => ({
  category: `loading-${index + 1}`,
  amount: [30, 22, 18, 16, 14][index],
  fill,
}));

const LOADING_CHART_CONFIG = LOADING_PIE_COLORS.reduce<ChartConfig>(
  (config, color, index) => {
    config[`loading-${index + 1}`] = { label: "", color };
    return config;
  },
  {},
);

interface SpendByCategoryCardProps {
  loading?: boolean;
  spendByCategory: SpendByCategoryWidget | null | undefined;
  className?: string;
}

function LoadingContent({ isEmpty = false }: { isEmpty?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center justify-center sm:w-[40%]">
        <ChartContainer
          config={LOADING_CHART_CONFIG}
          className={cn(
            "mx-auto aspect-square h-full max-h-[220px] w-full",
            !isEmpty && "animate-pulse",
          )}
        >
          <PieChart>
            <Pie
              data={LOADING_PIE_DATA}
              dataKey="amount"
              nameKey="category"
              innerRadius="60%"
              outerRadius="100%"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {LOADING_PIE_DATA.map((entry) => (
                <Cell key={entry.category} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:w-[60%]">
        {isEmpty ? (
          <EmptyState
            heading="No transactions detected"
            message="Category insights will appear here."
          />
        ) : (
          <ul className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index}>
                <div className="flex w-full items-center justify-between gap-6 leading-none">
                  <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-[4px] bg-muted animate-pulse" />
                    <Skeleton className="h-4 w-40 bg-muted rounded-md animate-pulse" />
                  </div>
                  <Skeleton className="h-4 w-20 shrink-0 bg-muted rounded-md animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SpendByCategoryCard({
  loading = false,
  spendByCategory,
  className,
}: SpendByCategoryCardProps) {
  const categories = useMemo(
    () => spendByCategory?.categories ?? [],
    [spendByCategory?.categories],
  );

  const chartData = useMemo(
    () =>
      categories.map((item) => ({
        category: item.category,
        amount: item.amount,
        percent: item.percent,
        fill: `var(--color-${item.category})`,
      })),
    [categories],
  );

  const chartConfig = useMemo(
    () => buildCategoryChartConfig(categories),
    [categories],
  );

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle>Category Breakdown</CardTitle>
        <CardDescription>
          Where your money went across different categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <LoadingContent isEmpty={false} />
        ) : categories.length > 0 ? (
            <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center justify-center sm:w-[40%]">
                <ChartContainer
                  config={chartConfig}
                  className="mx-auto aspect-square h-full max-h-[220px] w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, _name, item) => {
                            const payload = item.payload as {
                              category: string;
                              percent: number;
                            };
                            const categoryIndex = categories.findIndex(
                              (c) => c.category === payload.category,
                            );
                            const color =
                              chartConfig[payload.category]?.color ??
                              `var(--chart-${((categoryIndex >= 0 ? categoryIndex : 0) % 5) + 1})`;

                            return (
                              <div className="flex w-full items-center justify-between gap-6 leading-none">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div
                                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>
                                    {formatCategoryLabel(payload.category)}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                                  <span className="text-muted-foreground">
                                    {payload.percent}%
                                  </span>
                                  <span className="font-mono font-medium">
                                    {formatAmount(Number(value))}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={chartData}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius="60%"
                      outerRadius="100%"
                      strokeWidth={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.category} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:w-[60%]">
                {/* <p className="text-sm font-medium text-muted-foreground">
                Spends detected across {categories.length}{" "}
                {categories.length === 1 ? "category" : "categories"}
              </p> */}
                <ul className="space-y-2">
                  {categories.map((item, index) => {
                    const color =
                      chartConfig[item.category]?.color ??
                      `var(--chart-${(index % 5) + 1})`;

                    return (
                      <li
                        key={item.category}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate font-normal">
                            {formatCategoryLabel(item.category)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 tabular-nums">
                          <span className="text-muted-foreground">
                            {item.percent}%
                          </span>
                          <span className="min-w-[5.5rem] text-right font-medium">
                            {formatAmount(item.amount)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
        ) : (
          <LoadingContent isEmpty />
        )}
      </CardContent>
    </Card>
  );
}
