"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const CYCLE_PATTERN = /^(0[1-9]|1[0-2])-\d{4}$/;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const value = String(i + 1).padStart(2, "0");
  const label = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
    new Date(2000, i, 1),
  );
  return { value, label };
});

const MIN_YEAR = 2025;
const MAX_YEAR = 2099;

function defaultYearRange(): { minYear: number; maxYear: number } {
  return { minYear: MIN_YEAR, maxYear: MAX_YEAR };
}

function buildYearOptions(minYear: number, maxYear: number): string[] {
  return Array.from({ length: maxYear - minYear + 1 }, (_, i) =>
    String(minYear + i),
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function parseCycle(
  cycle: string | null | undefined,
): { month: string; year: string } | null {
  if (!cycle || !CYCLE_PATTERN.test(cycle)) return null;
  const [month, year] = cycle.split("-");
  return { month, year };
}

export function formatCycleValue(month: string, year: string): string {
  return `${month}-${year}`;
}

function getMonthLabel(month: string): string {
  return (
    MONTH_OPTIONS.find((option) => option.value === month)?.label ?? month
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CyclePickerProps {
  value: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
  minYear?: number;
  maxYear?: number;
  monthPlaceholder?: string;
  yearPlaceholder?: string;
  "aria-label"?: string;
}

export function CyclePicker({
  value,
  onChange,
  disabled = false,
  className,
  hasError = false,
  minYear: minYearProp,
  maxYear: maxYearProp,
  monthPlaceholder = "Month",
  yearPlaceholder = "Year",
  "aria-label": ariaLabel = "Billing cycle",
}: CyclePickerProps) {
  const { minYear, maxYear } = React.useMemo(() => {
    const defaults = defaultYearRange();
    return {
      minYear: minYearProp ?? defaults.minYear,
      maxYear: maxYearProp ?? defaults.maxYear,
    };
  }, [minYearProp, maxYearProp]);

  const yearOptions = React.useMemo(() => {
    const options = buildYearOptions(minYear, maxYear);
    const parsedYear = parseCycle(value)?.year;
    if (parsedYear && !options.includes(parsedYear)) {
      return [...options, parsedYear].sort(
        (a, b) => Number(a) - Number(b),
      );
    }
    return options;
  }, [minYear, maxYear, value]);

  const parsed = parseCycle(value);
  const [month, setMonth] = React.useState(parsed?.month ?? "");
  const [year, setYear] = React.useState(parsed?.year ?? "");

  React.useEffect(() => {
    const next = parseCycle(value);
    setMonth(next?.month ?? "");
    setYear(next?.year ?? "");
  }, [value]);

  const showClear = (month || year) && !disabled;

  function emitChange(nextMonth: string, nextYear: string) {
    if (nextMonth && nextYear) {
      onChange?.(formatCycleValue(nextMonth, nextYear));
      return;
    }
    if (!nextMonth && !nextYear) {
      onChange?.(null);
    }
  }

  function handleMonthChange(nextMonth: string) {
    setMonth(nextMonth);
    emitChange(nextMonth, year);
  }

  function handleYearChange(nextYear: string) {
    setYear(nextYear);
    emitChange(month, nextYear);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setMonth("");
    setYear("");
    onChange?.(null);
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-2 min-w-0", className)}
    >
      <Select
        value={month}
        onValueChange={handleMonthChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("w-[150px] shrink-0", hasError && "border-destructive")}
          aria-label="Month"
        >
          <div className="flex items-center flex-1 min-w-0 mr-[5px]">
            <SelectValue placeholder={monthPlaceholder}>
              {month ? getMonthLabel(month) : undefined}
            </SelectValue>
            {showClear && (
              <span
                role="button"
                aria-label="Clear cycle"
                className="ml-auto pl-1 rounded-sm opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {MONTH_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={handleYearChange} disabled={disabled}>
        <SelectTrigger
          className={cn("w-[100px] shrink-0", hasError && "border-destructive")}
          aria-label="Year"
        >
          <SelectValue placeholder={yearPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
