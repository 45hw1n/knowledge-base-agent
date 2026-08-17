import { CyclePicker, parseCycle } from "@/components/common/CyclePicker";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import type { TransactionListCondition } from "@/features/transactions/TransactionList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select";
import { useLayoutEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

type FilterType = "cycle" | "month" | "ytd" | "dateRange";

function getCurrentCycleValue(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}-${year}`;
}

function buildDateBetweenCondition(start: Date, end: Date): TransactionListCondition {
  return {
    attribute: "date",
    operator: "between",
    value: [start.toISOString(), end.toISOString()],
  };
}

function buildUtcMonthRange(year: number, month: number): TransactionListCondition {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return buildDateBetweenCondition(start, end);
}

function buildYtdCondition(date = new Date()): TransactionListCondition {
  const year = date.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return buildDateBetweenCondition(start, end);
}

function buildDateRangeCondition(range: DateRange | undefined): TransactionListCondition | null {
  if (!range?.from || !range.to) return null;

  const start = new Date(
    Date.UTC(
      range.from.getFullYear(),
      range.from.getMonth(),
      range.from.getDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      range.to.getFullYear(),
      range.to.getMonth(),
      range.to.getDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return buildDateBetweenCondition(start, end);
}

function getDefaultDateRange(date = new Date()): DateRange {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    from: new Date(year, month, 1),
    to: new Date(year, month + 1, 0),
  };
}

function buildTransactionFilterCondition(
  filterType: FilterType,
  selectedCycle: string | null,
  dateRange: DateRange | undefined,
): TransactionListCondition | null {
  if (filterType === "ytd") {
    return buildYtdCondition();
  }

  if (filterType === "dateRange") {
    return buildDateRangeCondition(dateRange);
  }

  if (!selectedCycle) return null;

  if (filterType === "cycle") {
    return {
      attribute: "cycle",
      operator: "is",
      value: selectedCycle,
    };
  }

  const parsed = parseCycle(selectedCycle);
  if (!parsed) return null;

  return buildUtcMonthRange(Number(parsed.year), Number(parsed.month));
}

export function getInitialTransactionFilterCondition(): TransactionListCondition | null {
  return buildTransactionFilterCondition("cycle", getCurrentCycleValue(), undefined);
}

interface TransactionPeriodFilterProps {
  onFilterChange: (condition: TransactionListCondition | null) => void;
}

export function TransactionPeriodFilter({
  onFilterChange,
}: TransactionPeriodFilterProps) {
  const [filterType, setFilterType] = useState<FilterType>("cycle");
  const [selectedCycle, setSelectedCycle] = useState<string | null>(() =>
    getCurrentCycleValue(),
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  function handleFilterTypeChange(value: FilterType) {
    setFilterType(value);
    if (value === "dateRange" && !dateRange?.from) {
      setDateRange(getDefaultDateRange());
    }
  }

  const filterCondition = useMemo(
    () => buildTransactionFilterCondition(filterType, selectedCycle, dateRange),
    [filterType, selectedCycle, dateRange],
  );

  useLayoutEffect(() => {
    onFilterChange(filterCondition);
  }, [filterCondition, onFilterChange]);

  const showSecondaryPicker = filterType !== "ytd";

  return (
    <>
      <div className="flex flex-row flex-nowrap gap-3">
        <div className="min-w-[140px] space-y-1">
          <p className="text-sm font-medium mb-2">Filter by</p>
          <Select
            value={filterType}
            onValueChange={(value) => handleFilterTypeChange(value as FilterType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cycle">Cycle</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="ytd">YTD</SelectItem>
              <SelectItem value="dateRange">Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showSecondaryPicker && (
          <div className="space-y-1">
            <p className="text-sm font-medium mb-2">
              {filterType === "cycle"
                ? "Cycle"
                : filterType === "month"
                  ? "Month"
                  : "Date range"}
            </p>
            {filterType === "dateRange" ? (
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                max={new Date()}
              />
            ) : (
              <CyclePicker value={selectedCycle} onChange={setSelectedCycle} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
