import React, { useState, useEffect } from "react";
import { Input } from "@/lib/ui/input";
import { Label } from "@/lib/ui/label";
import { Button } from "@/lib/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/lib/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/lib/ui/input-otp";
import {
  CreditCardFormValues,
  CreditCardFormErrors,
  CreditCardFormProps,
  BankOption,
} from "./creditCard.form.types";
import {
  INITIAL_FORM_VALUES,
  validate,
  buildPayload,
} from "./creditCard.form.utils";
import { getBanks } from "@/lib/constants/banks";

// ─────────────────────────────────────────────────────────────────────────────
// CreditCardForm — Reusable form for create & edit modes
// ─────────────────────────────────────────────────────────────────────────────

export function CreditCardForm({
  mode,
  initialValues,
  onSave,
  onCancel,
}: CreditCardFormProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [values, setValues] =
    useState<CreditCardFormValues>(INITIAL_FORM_VALUES);
  const [errors, setErrors] = useState<CreditCardFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);

  // ── Load bank list ─────────────────────────────────────────────────────────
  useEffect(() => {
    const bankList = getBanks();
    setBanks(bankList);
  }, []);

  // ── Edit mode: merge initialValues into form state ─────────────────────────
  useEffect(() => {
    if (initialValues) {
      // Map initialValues to form state, ensuring everything is a string
      const v = { ...INITIAL_FORM_VALUES };

      if (initialValues.name) v.name = initialValues.name;
      if (initialValues.bank) v.bank = String(initialValues.bank);
      if (initialValues.last4) v.last4 = initialValues.last4;

      // Handle numeric days from API -> strings for form
      if (initialValues.billingCycleDay !== undefined) {
        v.billingCycleDay = String(initialValues.billingCycleDay);
      }
      if (initialValues.dueDateDay !== undefined) {
        v.dueDateDay = String(initialValues.dueDateDay);
      }

      // ── Expiry Logic ───────────────────────────────────────────────────────
      // 1. If 'expiry' (MMYY) is explicitly provided in initialValues, use it
      if (initialValues.expiry) {
        v.expiry = initialValues.expiry;
      }
      // 2. Otherwise, derive it from legacy expiryMonth/expiryYear (numbers)
      else {
        const legacy = initialValues as any;
        if (legacy.expiryMonth && legacy.expiryYear) {
          const mm = String(legacy.expiryMonth).padStart(2, "0");
          const yy = String(legacy.expiryYear).slice(-2);
          v.expiry = `${mm}${yy}`;
        }
      }

      setValues(v);
    }
  }, [initialValues]);

  // ── Change handlers ────────────────────────────────────────────────────────

  /** For native <Input> fields (name, last4) */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof CreditCardFormValues]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  /** For shadcn <Select> fields — returns a curried handler for onValueChange */
  const handleSelectChange =
    (field: keyof CreditCardFormValues) => (value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  /** For day numeric inputs (1-31) */
  const handleDayChange = (
    field: keyof CreditCardFormValues,
    value: string,
  ) => {
    // Strip non-numeric and limit to 2 digits
    const cleaned = value.replace(/\D/g, "").slice(0, 2);
    setValues((prev) => ({ ...prev, [field]: cleaned }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    // 2. Build typed payload
    const payload = buildPayload(values);

    // 3. Call onSave with loading guard
    setIsSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      console.error("CreditCardForm save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>
            <span className="mr-2">💳</span>
            {mode === "edit" ? "Edit Credit Card" : "Add Credit Card"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Row 1: Bank + Name */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bank */}
            <div className="space-y-2">
              <Label htmlFor="bank">Bank</Label>
              <Select
                key={banks.length || 0}
                value={values.bank || undefined}
                onValueChange={handleSelectChange("bank")}
              >
                <SelectTrigger
                  id="bank"
                  className={errors.bank ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.value}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bank && (
                <p className="text-sm text-destructive">{errors.bank}</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Card Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. HDFC Millennia"
                value={values.name}
                onChange={handleInputChange}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
          </div>

          {/* Row 2: Last 4 Digits + Expiry MM/YY */}
          <div className="grid grid-cols-2 gap-4">
            {/* Last 4 Digits */}
            <div className="space-y-2">
              <Label htmlFor="last4">Last 4 Digits</Label>
              <Input
                id="last4"
                name="last4"
                placeholder="1234"
                value={values.last4}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setValues((prev) => ({ ...prev, last4: cleaned }));
                  if (errors.last4) {
                    setErrors((prev) => ({ ...prev, last4: undefined }));
                  }
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className={errors.last4 ? "border-destructive" : ""}
              />
              {errors.last4 && (
                <p className="text-sm text-destructive">{errors.last4}</p>
              )}
            </div>

            {/* Expiry MM/YY (InputOTP) */}
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date (MM / YY)</Label>
              <div className="flex flex-col gap-1.5">
                <InputOTP
                  id="expiry"
                  maxLength={4}
                  value={values.expiry}
                  onChange={(val) => {
                    setValues((prev) => ({ ...prev, expiry: val }));
                    if (errors.expiry)
                      setErrors((prev) => ({ ...prev, expiry: undefined }));
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} placeholder="M" />
                    <InputOTPSlot index={1} placeholder="M" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} placeholder="Y" />
                    <InputOTPSlot index={3} placeholder="Y" />
                  </InputOTPGroup>
                </InputOTP>
                {errors.expiry && (
                  <p className="text-sm text-destructive">{errors.expiry}</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Billing Cycle Day + Due Date Day (Numeric Inputs) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Billing Cycle Day */}
            <div className="space-y-2">
              <Label htmlFor="billingCycleDay">Billing day</Label>
              <Input
                id="billingCycleDay"
                placeholder="1-31"
                value={values.billingCycleDay}
                onChange={(e) =>
                  handleDayChange("billingCycleDay", e.target.value)
                }
                className={errors.billingCycleDay ? "border-destructive" : ""}
              />
              {errors.billingCycleDay && (
                <p className="text-sm text-destructive">
                  {errors.billingCycleDay}
                </p>
              )}
            </div>

            {/* Due Date Day */}
            <div className="space-y-2">
              <Label htmlFor="dueDateDay">Bill due day</Label>
              <Input
                id="dueDateDay"
                placeholder="1-31"
                value={values.dueDateDay}
                onChange={(e) => handleDayChange("dueDateDay", e.target.value)}
                className={errors.dueDateDay ? "border-destructive" : ""}
              />
              {errors.dueDateDay && (
                <p className="text-sm text-destructive">{errors.dueDateDay}</p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
