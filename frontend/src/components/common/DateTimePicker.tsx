"use client";

import * as React from "react";
import {
  format,
  set,
  getHours,
  getMinutes,
  startOfDay,
  isBefore,
  isAfter,
  max as dateMax,
  min as dateMin,
  addDays,
} from "date-fns";
import { CalendarClock, CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/lib/ui/button";
import { Calendar } from "@/lib/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";
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

type Meridiem = "AM" | "PM";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

// ---------------------------------------------------------------------------
// Inline utilities (date-fns only)
// ---------------------------------------------------------------------------

/** Convert 12-hour clock + meridiem to 24-hour value for date-fns `set`. */
function to24Hour(hour12: number, meridiem: Meridiem): number {
  if (meridiem === "AM") {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

/** Extract hour/minute/meridiem parts from an existing Date. */
function parseTimeParts(date: Date): {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
} {
  const h24 = getHours(date);
  const minute = getMinutes(date);
  const meridiem: Meridiem = h24 >= 12 ? "PM" : "AM";
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, meridiem };
}

/** Merge a calendar day with 12-hour time parts into a single Date. */
function buildDateTime(
  day: Date,
  hour12: number,
  minute: number,
  meridiem: Meridiem,
): Date {
  return set(startOfDay(day), {
    hours: to24Hour(hour12, meridiem),
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  });
}

/** Clamp a datetime to optional min/max bounds. */
function clampDateTime(date: Date, min?: Date, max?: Date): Date {
  let result = date;
  if (min) result = dateMax([result, min]);
  if (max) result = dateMin([result, max]);
  return result;
}

/** Whether a calendar day falls outside the allowed date range. */
function isDayDisabled(day: Date, min?: Date, max?: Date): boolean {
  const d = startOfDay(day);
  if (min && isBefore(d, startOfDay(min))) return true;
  if (max && isAfter(d, startOfDay(max))) return true;
  return false;
}

/** Consistent display format for trigger and preview. */
function formatPickerDisplay(
  date: Date,
  pickerType: "date" | "date-time",
): string {
  return pickerType === "date" ? format(date, "PPP") : format(date, "PPP p");
}

function getDefaultTimeParts(): {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
} {
  return parseTimeParts(new Date());
}

type DraftParts = {
  day: Date | undefined;
  hour12: number;
  minute: number;
  meridiem: Meridiem;
};

function draftPartsFromDate(date: Date | undefined): DraftParts {
  if (!date) {
    const defaults = getDefaultTimeParts();
    return {
      day: undefined,
      hour12: defaults.hour12,
      minute: defaults.minute,
      meridiem: defaults.meridiem,
    };
  }
  const parts = parseTimeParts(date);
  return {
    day: startOfDay(date),
    hour12: parts.hour12,
    minute: parts.minute,
    meridiem: parts.meridiem,
  };
}

function mergeDraftParts(
  draft: DraftParts,
  isDateOnly: boolean,
  min?: Date,
  max?: Date,
): { value: Date | undefined; wasClamped: boolean } {
  if (!draft.day) {
    return { value: undefined, wasClamped: false };
  }
  const raw = isDateOnly
    ? startOfDay(draft.day)
    : buildDateTime(draft.day, draft.hour12, draft.minute, draft.meridiem);
  const clamped = clampDateTime(raw, min, max);
  return { value: clamped, wasClamped: clamped.getTime() !== raw.getTime() };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type DateTimePickerType = "date" | "date-time";

export interface DateTimePickerProps {
  /** `date` — calendar only; `date-time` — calendar + time picker with Save/Cancel. */
  type?: DateTimePickerType;
  /** Controlled value. Pass `null` to clear. Omit for uncontrolled mode. */
  value?: Date | null;
  /** Initial value when uncontrolled. */
  defaultValue?: Date;
  /** Fires on each change when `type` is `date`. Fires on Save when `type` is `date-time`. */
  onChange?: (date: Date | undefined) => void;
  /** Fires when the user confirms with Save (`date-time` only). */
  onSave?: (date: Date | undefined) => void;
  disabled?: boolean;
  min?: Date;
  max?: Date;
  placeholder?: string;
  /** Show IANA timezone name and UTC offset in the popover footer. */
  showTimezone?: boolean;
  /** Override detected timezone (e.g. `"America/New_York"`). */
  timezone?: string;
  className?: string;
  triggerClassName?: string;
  id?: string;
  /** Hidden input name for native form submission. */
  name?: string;
  "aria-label"?: string;
}

// ---------------------------------------------------------------------------
// DateTimePicker
// ---------------------------------------------------------------------------

export function DateTimePicker({
  type: pickerType = "date-time",
  value,
  defaultValue,
  onChange,
  onSave,
  disabled = false,
  min,
  max,
  placeholder,
  showTimezone = false,
  timezone,
  className,
  triggerClassName,
  id,
  name,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const isDateOnly = pickerType === "date";
  const resolvedPlaceholder =
    placeholder ?? (isDateOnly ? "Pick a date" : "Pick date and time");
  const resolvedAriaLabel =
    ariaLabel ?? (isDateOnly ? "Date picker" : "Date and time picker");

  const isControlled = value !== undefined;

  // Hydration guard: defer locale-sensitive formatting until client mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [open, setOpen] = React.useState(false);

  // Committed value (shown on trigger)
  const [internalValue, setInternalValue] = React.useState<Date | undefined>(
    defaultValue,
  );
  const selected = isControlled ? (value ?? undefined) : internalValue;

  // Immediate-edit state for `date` mode
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(
    selected ? startOfDay(selected) : undefined,
  );
  const [hour12, setHour12] = React.useState(() =>
    selected ? parseTimeParts(selected).hour12 : getDefaultTimeParts().hour12,
  );
  const [minute, setMinute] = React.useState(() =>
    selected ? parseTimeParts(selected).minute : getDefaultTimeParts().minute,
  );
  const [meridiem, setMeridiem] = React.useState<Meridiem>(() =>
    selected
      ? parseTimeParts(selected).meridiem
      : getDefaultTimeParts().meridiem,
  );

  // Draft state for `date-time` popover (applied only on Save)
  const [draft, setDraft] = React.useState<DraftParts>(() =>
    draftPartsFromDate(selected),
  );
  const [draftWasClamped, setDraftWasClamped] = React.useState(false);

  const amButtonRef = React.useRef<HTMLButtonElement>(null);
  const pmButtonRef = React.useRef<HTMLButtonElement>(null);

  // Sync committed + date-mode UI when controlled value changes
  React.useEffect(() => {
    if (!isControlled) return;
    if (value == null) {
      setSelectedDay(undefined);
      return;
    }
    const parts = parseTimeParts(value);
    setSelectedDay(startOfDay(value));
    setHour12(parts.hour12);
    setMinute(parts.minute);
    setMeridiem(parts.meridiem);
  }, [isControlled, value]);

  const disabledDays = React.useCallback(
    (day: Date) => isDayDisabled(day, min, max),
    [min, max],
  );

  /** Apply a committed value to parent + internal state. */
  const applyCommitted = React.useCallback(
    (next: Date | undefined) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  /** Merge day (+ time when applicable) and commit immediately (`date` mode). */
  const commitSelection = React.useCallback(
    (day: Date | undefined, h: number, m: number, mer: Meridiem) => {
      if (!day) {
        applyCommitted(undefined);
        return;
      }
      const raw = isDateOnly ? startOfDay(day) : buildDateTime(day, h, m, mer);
      const clamped = clampDateTime(raw, min, max);
      applyCommitted(clamped);
    },
    [applyCommitted, isDateOnly, min, max],
  );

  const initDraftForOpen = React.useCallback(() => {
    const base = draftPartsFromDate(selected);
    if (base.day) {
      setDraft(base);
      setDraftWasClamped(false);
      return;
    }
    const today = startOfDay(new Date());
    if (!isDayDisabled(today, min, max)) {
      const defaults = getDefaultTimeParts();
      setDraft({
        day: today,
        hour12: defaults.hour12,
        minute: defaults.minute,
        meridiem: defaults.meridiem,
      });
    } else {
      setDraft(base);
    }
    setDraftWasClamped(false);
  }, [selected, min, max]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (!isDateOnly) {
        initDraftForOpen();
      } else if (!selectedDay) {
        const today = startOfDay(new Date());
        if (!isDayDisabled(today, min, max)) {
          setSelectedDay(today);
          commitSelection(today, hour12, minute, meridiem);
        }
      }
    }
    setOpen(next);
  };

  const handleCancel = () => {
    setDraft(draftPartsFromDate(selected));
    setDraftWasClamped(false);
    setOpen(false);
  };

  const handleSave = () => {
    const { value: merged, wasClamped } = mergeDraftParts(
      draft,
      false,
      min,
      max,
    );
    if (!merged) return;

    setDraftWasClamped(wasClamped);
    applyCommitted(merged);
    onSave?.(merged);
    setOpen(false);
  };

  // ── `date` mode handlers (immediate commit) ──

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    const dayStart = startOfDay(day);
    setSelectedDay(dayStart);
    commitSelection(dayStart, hour12, minute, meridiem);
  };

  // ── `date-time` draft handlers ──

  const handleDraftDaySelect = (day: Date | undefined) => {
    if (!day) return;
    setDraft((prev) => ({ ...prev, day: startOfDay(day) }));
  };

  const handleDraftHourChange = (val: string) => {
    setDraft((prev) => ({ ...prev, hour12: parseInt(val, 10) }));
  };

  const handleDraftMinuteChange = (val: string) => {
    setDraft((prev) => ({ ...prev, minute: parseInt(val, 10) }));
  };

  const handleDraftMeridiemChange = (mer: Meridiem) => {
    setDraft((prev) => ({ ...prev, meridiem: mer }));
  };

  const handleMeridiemKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    target: Meridiem,
  ) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next: Meridiem = target === "AM" ? "PM" : "AM";
      if (isDateOnly) {
        setMeridiem(next);
        if (selectedDay) commitSelection(selectedDay, hour12, minute, next);
      } else {
        handleDraftMeridiemChange(next);
        (next === "AM" ? amButtonRef : pmButtonRef).current?.focus();
      }
    }
  };

  const displayText =
    mounted && selected ? formatPickerDisplay(selected, pickerType) : null;

  const draftPreview = React.useMemo(() => {
    if (!mounted || isDateOnly) return null;
    const { value } = mergeDraftParts(draft, false, min, max);
    return value ? formatPickerDisplay(value, "date-time") : null;
  }, [mounted, isDateOnly, draft, min, max]);

  const resolvedTimezone =
    timezone ??
    (mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined);

  const draftMerged = mergeDraftParts(draft, false, min, max).value;
  const timezoneOffset =
    mounted && draftMerged && showTimezone && !isDateOnly
      ? format(draftMerged, "XXX")
      : null;

  const timePickerControls = (
    pickerDay: Date | undefined,
    pickerHour12: number,
    pickerMinute: number,
    pickerMeridiem: Meridiem,
    onHourChange: (val: string) => void,
    onMinuteChange: (val: string) => void,
    onMeridiemChange: (mer: Meridiem) => void,
  ) => (
    <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-3">
      <Select
        value={String(pickerHour12)}
        onValueChange={onHourChange}
        disabled={disabled || !pickerDay}
      >
        <SelectTrigger className="w-[72px]" aria-label="Hour">
          <SelectValue placeholder="Hr" />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground" aria-hidden="true">
        :
      </span>

      <Select
        value={String(pickerMinute).padStart(2, "0")}
        onValueChange={onMinuteChange}
        disabled={disabled || !pickerDay}
      >
        <SelectTrigger className="w-[72px]" aria-label="Minute">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {MINUTE_OPTIONS.map((m) => (
            <SelectItem key={m} value={String(m).padStart(2, "0")}>
              {String(m).padStart(2, "0")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        role="group"
        aria-label="AM or PM"
        className="inline-flex rounded-md border border-input bg-background shadow-sm"
      >
        <Button
          ref={amButtonRef}
          type="button"
          variant={pickerMeridiem === "AM" ? "default" : "ghost"}
          size="sm"
          disabled={disabled || !pickerDay}
          aria-pressed={pickerMeridiem === "AM"}
          className="rounded-r-none px-3"
          onClick={() => onMeridiemChange("AM")}
          onKeyDown={(e) => handleMeridiemKeyDown(e, "AM")}
        >
          AM
        </Button>
        <Button
          ref={pmButtonRef}
          type="button"
          variant={pickerMeridiem === "PM" ? "default" : "ghost"}
          size="sm"
          disabled={disabled || !pickerDay}
          aria-pressed={pickerMeridiem === "PM"}
          className="rounded-l-none px-3"
          onClick={() => onMeridiemChange("PM")}
          onKeyDown={(e) => handleMeridiemKeyDown(e, "PM")}
        >
          PM
        </Button>
      </div>
    </div>
  );

  const Icon = isDateOnly ? CalendarIcon : CalendarClock;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={resolvedAriaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              triggerClassName,
              !selected && "text-muted-foreground",
            )}
          >
            <span className="flex-1 truncate text-left">
              {displayText ?? resolvedPlaceholder}
            </span>
            <Icon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-0"
          align="start"
          role="dialog"
          aria-label={resolvedAriaLabel}
        >
          {isDateOnly ? (
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={handleDaySelect}
              disabled={disabledDays}
              initialFocus
            />
          ) : (
            <div className="flex w-[280px] flex-col sm:w-auto">
              {/* Header: preview center, close top-right */}
              <div className="relative flex items-center justify-center border-b border-border px-10 py-3">
                <p
                  className={cn(
                    "text-center text-sm font-medium",
                    draftPreview ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {draftPreview ?? resolvedPlaceholder}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  disabled={disabled}
                  aria-label="Cancel"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Calendar
                mode="single"
                selected={draft.day}
                onSelect={handleDraftDaySelect}
                disabled={disabledDays}
                initialFocus
                className="w-full"
              />

              <div className="mt-3">
                {timePickerControls(
                  draft.day,
                  draft.hour12,
                  draft.minute,
                  draft.meridiem,
                  handleDraftHourChange,
                  handleDraftMinuteChange,
                  handleDraftMeridiemChange,
                )}
              </div>

              {(draftWasClamped || (showTimezone && resolvedTimezone)) && (
                <div className="border-t border-border px-3 py-2">
                  {draftWasClamped && (
                    <p className="text-xs text-destructive" role="status">
                      Adjusted to fit allowed range
                    </p>
                  )}
                  {showTimezone && resolvedTimezone && (
                    <p className="text-xs text-muted-foreground">
                      {resolvedTimezone}
                      {timezoneOffset ? ` (${timezoneOffset})` : null}
                    </p>
                  )}
                </div>
              )}

              {/* Footer: Cancel + Save */}
              <div className="flex justify-end gap-2 border-t border-border p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || !draft.day}
                  onClick={handleSave}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {name && selected && (
        <input type="hidden" name={name} value={selected.toISOString()} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Example usage
// ---------------------------------------------------------------------------

export function DateTimePickerExample() {
  const [controlled, setControlled] = React.useState<Date | undefined>(
    new Date(),
  );

  const today = new Date();
  const minDate = addDays(today, -7);
  const maxDate = addDays(today, 7);

  return (
    <div className="mx-auto max-w-md space-y-8 p-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Controlled (date-time)</h3>
        <p className="text-xs text-muted-foreground">
          Changes apply on Save via <code>onSave</code> / <code>onChange</code>
        </p>
        <DateTimePicker
          type="date-time"
          id="controlled-dt"
          value={controlled}
          onChange={setControlled}
          onSave={setControlled}
          showTimezone
          aria-label="Controlled date and time"
        />
        {controlled && (
          <p className="text-xs text-muted-foreground">
            ISO: {controlled.toISOString()}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Uncontrolled</h3>
        <DateTimePicker
          type="date-time"
          defaultValue={new Date()}
          onSave={(d) => console.log("saved:", d?.toISOString())}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Disabled</h3>
        <DateTimePicker type="date-time" defaultValue={new Date()} disabled />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Date only</h3>
        <DateTimePicker
          type="date"
          defaultValue={today}
          onChange={(d) => console.log("date only:", d?.toISOString())}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Min / Max (±7 days)</h3>
        <DateTimePicker
          type="date-time"
          min={minDate}
          max={maxDate}
          defaultValue={today}
          showTimezone
        />
      </div>
    </div>
  );
}
