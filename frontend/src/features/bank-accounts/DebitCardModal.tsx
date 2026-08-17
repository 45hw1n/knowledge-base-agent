import React, { useState, useEffect } from "react";
import { Modal } from "@/lib/ui/modal";
import { Input } from "@/lib/ui/input";
import { Label } from "@/lib/ui/label";
import { Button } from "@/lib/ui/button";
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
import { DebitCardFormValues } from "./bankAccount.form.types";
import { validateDebitCard } from "./bankAccount.form.utils";

interface DebitCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: DebitCardFormValues;
  onSave: (values: DebitCardFormValues) => void;
  mode: "add" | "edit";
}

const INITIAL_VALUES: DebitCardFormValues = {
  name: "",
  last4: "",
  expiry: "",
};

export function DebitCardModal({
  open,
  onOpenChange,
  initialValues,
  onSave,
  mode,
}: DebitCardModalProps) {
  const [values, setValues] = useState<DebitCardFormValues>(() => {
    return initialValues || INITIAL_VALUES;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setValues(initialValues);
      } else {
        setValues(INITIAL_VALUES);
      }
      setErrors({});
    }
  }, [open, initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // For last4, allow only digits
    if (name === "last4") {
      const sanitized = value.replace(/\D/g, "");
      setValues((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setValues((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleExpiryChange = (val: string) => {
    setValues((prev) => ({ ...prev, expiry: val }));
    if (errors.expiry) {
      setErrors((prev) => ({ ...prev, expiry: "" }));
    }
  };

  const handleSave = () => {
    const validationErrors = validateDebitCard(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(values);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Card className="border-none shadow-none">
        <CardHeader>
          <CardTitle>
            {mode === "add" ? "Add Debit Card" : "Edit Debit Card"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dc-name">Card Name</Label>
            <Input
              id="dc-name"
              name="name"
              placeholder="e.g. Salary Card"
              value={values.name}
              onChange={handleChange}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex justify-between">
            <div className="space-y-2">
              <Label htmlFor="dc-last4">Last 4 Digits</Label>
              <Input
                id="dc-last4"
                name="last4"
                placeholder="1234"
                maxLength={4}
                value={values.last4}
                onChange={handleChange}
                className={errors.last4 ? "border-destructive" : ""}
              />
              {errors.last4 && (
                <p className="text-sm text-destructive">{errors.last4}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dc-expiry">Expiry Date (MM / YY)</Label>
              <div className="flex flex-col gap-1.5">
                <InputOTP
                  id="dc-expiry"
                  maxLength={4}
                  value={values.expiry}
                  onChange={handleExpiryChange}
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
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </CardFooter>
      </Card>
    </Modal>
  );
}
