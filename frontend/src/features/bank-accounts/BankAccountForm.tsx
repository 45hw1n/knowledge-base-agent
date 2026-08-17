import React, { useState, useEffect } from "react";
import { SquarePlus, Edit2, Trash2, Check, X } from "lucide-react";
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
  BankAccountFormProps,
  BankAccountFormValues,
  BankAccountFormErrors,
  BankOption,
  DebitCardFormValues,
} from "./bankAccount.form.types";
import {
  INITIAL_FORM_VALUES,
  validateBankAccountForm,
  buildBankAccountPayload,
} from "./bankAccount.form.utils";
import { getBanks } from "@/lib/constants/banks";
import { DebitCardModal } from "./DebitCardModal";

import { DebitCardTable } from "./DebitCardTable";

export function BankAccountForm({
  mode,
  initialValues,
  onSave,
  onCancel,
}: BankAccountFormProps) {
  // ── Main Form State ────────────────────────────────────────────────────────
  const [values, setValues] = useState<BankAccountFormValues>(() => {
    if (initialValues) {
      return {
        accountName: initialValues.name || "",
        bank: initialValues.bank || "",
        last4: initialValues.last4 || "",
        accountType: (initialValues.accountType?.toUpperCase() as any) || "",
        debitCards: (initialValues.debitCards || []).map((dc) => {
          const mm = String(dc.expiryMonth || 0).padStart(2, "0");
          const yy = String(dc.expiryYear || 0).slice(-2);
          return {
            name: dc.name || "",
            last4: dc.last4 || "",
            expiry: `${mm}${yy}`,
          };
        }),
        upiIds: initialValues.upiIds || [],
      };
    }
    return INITIAL_FORM_VALUES;
  });
  const [errors, setErrors] = useState<BankAccountFormErrors>({});
  const [banks] = useState<BankOption[]>(getBanks());
  const [isSaving, setIsSaving] = useState(false);

  // ── Debit Card Modal State ────────────────────────────────────────────────
  const [dcModalOpen, setDcModalOpen] = useState(false);
  const [dcEditingIndex, setDcEditingIndex] = useState<number | null>(null);

  // ── UPI Inline Edit State ──────────────────────────────────────────────────
  const [upiEditIndex, setUpiEditIndex] = useState<number | null>(null);
  const [upiEditValue, setUpiEditValue] = useState("");
  const [newUpiId, setNewUpiId] = useState("");

  // ── Initialization ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialValues) {
      setValues({
        accountName: initialValues.name || "",
        bank: initialValues.bank || "",
        last4: initialValues.last4 || "",
        accountType: (initialValues.accountType?.toUpperCase() as any) || "",
        debitCards: (initialValues.debitCards || []).map((dc) => {
          const mm = String(dc.expiryMonth || 0).padStart(2, "0");
          const yy = String(dc.expiryYear || 0).slice(-2);
          return {
            name: dc.name || "",
            last4: dc.last4 || "",
            expiry: `${mm}${yy}`,
          };
        }),
        upiIds: initialValues.upiIds || [],
      });
    }
  }, [initialValues]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof BankAccountFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSelectChange =
    (name: keyof BankAccountFormValues) => (value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      if (errors[name as keyof BankAccountFormErrors]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    };

  // ── Debit Card Logic ───────────────────────────────────────────────────────
  const openAddDc = () => {
    setDcEditingIndex(null);
    setDcModalOpen(true);
  };

  const openEditDc = (_card: DebitCardFormValues, index: number) => {
    setDcEditingIndex(index);
    setDcModalOpen(true);
  };

  const deleteDc = (index: number) => {
    setValues((prev) => ({
      ...prev,
      debitCards: prev.debitCards.filter((_, i) => i !== index),
    }));
  };

  const saveDc = (dcValues: DebitCardFormValues) => {
    setValues((prev) => {
      const newDcs = [...prev.debitCards];
      if (dcEditingIndex !== null) {
        newDcs[dcEditingIndex] = dcValues;
      } else {
        newDcs.push(dcValues);
      }
      return { ...prev, debitCards: newDcs };
    });
  };

  // ── UPI ID Logic ──────────────────────────────────────────────────────────
  const addUpiId = () => {
    if (!newUpiId.trim()) return;
    setValues((prev) => ({
      ...prev,
      upiIds: [...prev.upiIds, newUpiId.trim()],
    }));
    setNewUpiId("");
  };

  const startEditUpi = (index: number) => {
    setUpiEditIndex(index);
    setUpiEditValue(values.upiIds[index]);
  };

  const confirmEditUpi = () => {
    if (upiEditIndex === null) return;
    setValues((prev) => {
      const newUpis = [...prev.upiIds];
      newUpis[upiEditIndex] = upiEditValue.trim();
      return { ...prev, upiIds: newUpis };
    });
    setUpiEditIndex(null);
  };

  const cancelEditUpi = () => {
    setUpiEditIndex(null);
  };

  const deleteUpi = (index: number) => {
    setValues((prev) => ({
      ...prev,
      upiIds: prev.upiIds.filter((_, i) => i !== index),
    }));
  };

  // ── Form Submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateBankAccountForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = buildBankAccountPayload(values);
    setIsSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      console.error("BankAccountForm save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>
            <span className="mr-2">🏦</span>
              {mode === "edit" ? "Edit Bank Account" : "Add Bank Account"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Row 1: Account Name + Bank */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  name="accountName"
                  placeholder="e.g. Primary Savings"
                  value={values.accountName}
                  onChange={handleInputChange}
                  className={errors.accountName ? "border-destructive" : ""}
                />
                {errors.accountName && (
                  <p className="text-sm text-destructive">
                    {errors.accountName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank">Bank</Label>
                <Select
                  key={`bank-${initialValues?.id || 'new'}`}
                  value={values.bank}
                  onValueChange={handleSelectChange("bank")}
                >
                  <SelectTrigger
                    id="bank"
                    className={errors.bank ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Bank" />
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
            </div>

            {/* Row 2: Last 4 digits + Account Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="last4">Account Last 4 Digits</Label>
                <Input
                  id="last4"
                  name="last4"
                  placeholder="1234"
                  maxLength={4}
                  value={values.last4}
                  onChange={handleInputChange}
                  className={errors.last4 ? "border-destructive" : ""}
                />
                {errors.last4 && (
                  <p className="text-sm text-destructive">{errors.last4}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select
                  key={`type-${initialValues?.id || 'new'}`}
                  value={values.accountType}
                  onValueChange={handleSelectChange("accountType")}
                >
                  <SelectTrigger
                    id="accountType"
                    className={errors.accountType ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">SAVINGS</SelectItem>
                    <SelectItem value="CURRENT">CURRENT</SelectItem>
                    <SelectItem value="SALARY">SALARY</SelectItem>
                    <SelectItem value="JOINT">JOINT</SelectItem>
                  </SelectContent>
                </Select>
                {errors.accountType && (
                  <p className="text-sm text-destructive">
                    {errors.accountType}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Debit Cards */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Associated Debit Cards
                </Label>
                <Button
                  variant="outline"
                  type="button"
                  onClick={openAddDc}
                >
                  <SquarePlus className="w-4 h-4" />Debit Card
                </Button>
              </div>

              <div className="space-y-2">
                {values.debitCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/20 border-dashed">
                    <p className="text-sm text-muted-foreground italic">
                      No debit cards added yet.
                    </p>
                  </div>
                ) : (
                  <DebitCardTable
                    data={values.debitCards}
                    onEdit={openEditDc}
                    onDelete={deleteDc}
                  />
                )}
              </div>
            </div>

            {/* Row 4: UPI IDs */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-semibold">
                Associated UPI IDs
              </Label>

              <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                {values.upiIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/20 border-dashed">
                    <p className="text-sm text-muted-foreground italic">
                      No UPI IDs added yet.
                    </p>
                  </div>
                ) : (
                  values.upiIds.map((upi, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 h-[52px]"
                    >
                      {upiEditIndex === index ? (
                        <div className="flex items-center flex-1 gap-2">
                          <Input
                            value={upiEditValue}
                            onChange={(e) => setUpiEditValue(e.target.value)}
                            className="flex-1 h-8"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={confirmEditUpi}
                            className="text-emerald-500 hover:text-emerald-400"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={cancelEditUpi}
                            className="text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium">{upi}</p>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => startEditUpi(index)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              type="button"
                              onClick={() => deleteUpi(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 items-end pt-2">
                <div className="space-y-2 flex-1">
                  <Input
                    placeholder="example@upi"
                    value={newUpiId}
                    onChange={(e) => setNewUpiId(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addUpiId())
                    }
                  />
                </div>
                <Button variant="secondary" type="button" onClick={addUpiId}>
                <SquarePlus className="w-4 h-4" /> UPI ID
                </Button>
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

      <DebitCardModal
        open={dcModalOpen}
        onOpenChange={setDcModalOpen}
        initialValues={
          dcEditingIndex !== null
            ? values.debitCards[dcEditingIndex]
            : undefined
        }
        onSave={saveDc}
        mode={dcEditingIndex !== null ? "edit" : "add"}
      />
    </div>
  );
}
