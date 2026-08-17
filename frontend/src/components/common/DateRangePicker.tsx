"use client";

import * as React from "react";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/lib/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";

function isDayDisabled(day: Date, min?: Date, max?: Date): boolean {
  const d = startOfDay(day);
  if (min && isBefore(d, startOfDay(min))) return true;
  if (max && isAfter(d, startOfDay(max))) return true;
  return false;
}

function formatRangeDisplay(range: DateRange | undefined): string | null {
  if (!range?.from) return null;
  if (!range.to) return format(range.from, "PPP");
  return `${format(range.from, "PPP")} – ${format(range.to, "PPP")}`;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  disabled?: boolean;
  min?: Date;
  max?: Date;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function DateRangePicker({
  value,
  onChange,
  disabled = false,
  min,
  max,
  placeholder = "Pick a date range",
  className,
  triggerClassName,
  "aria-label": ariaLabel = "Date range picker",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const disabledDays = React.useCallback(
    (day: Date) => isDayDisabled(day, min, max),
    [min, max],
  );

  const displayText = mounted ? formatRangeDisplay(value) : null;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "flex h-9 w-full min-w-[240px] cursor-pointer items-center rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              triggerClassName,
              !value?.from && "text-muted-foreground",
            )}
          >
            <span className="flex-1 truncate text-left">
              {displayText ?? placeholder}
            </span>
            <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-0"
          align="start"
          role="dialog"
          aria-label={ariaLabel}
        >
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            disabled={disabledDays}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
