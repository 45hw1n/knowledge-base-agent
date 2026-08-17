import type { ChartConfig } from "@/lib/ui/chart";
import type { SpendByCategoryItem } from "./transactionWidget.types";
import { formatCategoryLabel } from "./widgetFormatters";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.15 250)",
  "oklch(0.6 0.12 160)",
  "oklch(0.65 0.14 55)",
  "oklch(0.58 0.14 300)",
  "oklch(0.62 0.16 15)",
];

export function buildCategoryChartConfig(
  categories: SpendByCategoryItem[],
): ChartConfig {
  const config: ChartConfig = {};

  categories.forEach((item, index) => {
    const key = item.category;
    config[key] = {
      label: `${formatCategoryLabel(item.category)} ${item.percent}%`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  return config;
}

export const TREND_CHART_CONFIG: ChartConfig = {
  amount: {
    label: "Amount",
    color: "var(--chart-1)",
  },
};
