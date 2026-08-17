import { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { Card, CardContent } from "@/lib/ui/card";
import { Badge } from "@/lib/ui/badge";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { Textarea } from "@/lib/ui/textarea";
import { Checkbox } from "@/lib/ui/checkbox";
import { Label } from "@/lib/ui/label";
import { Switch } from "@/lib/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/lib/ui/dialog";
import {
  TransactionToReview,
  PAYMENT_MODE_OPTIONS,
} from "./transactionReview.types";
import {
  AttachmentGroup,
  AttachmentUploaderButton,
} from "@/components/AttachmentGroup";
import { AttachmentItem } from "@/features/attachments/types";
import CategorySubCategory from "@/components/common/CategorySubCategory";
import PaymentMode, {
  isPaymentModeType,
} from "@/components/common/PaymentMode";
import PaymentSource from "@/components/common/PaymentSource";
import { DateTimePicker } from "@/components/common/DateTimePicker";
import { CyclePicker } from "@/components/common/CyclePicker";
import { FieldDropdown } from "@/components/common/FieldDropdown";
import {
  formatAmount,
  formatDate,
  formatCycle,
  formatPaymentMode,
} from "./helpers/transactionReview.helpers";
import {
  EditFields,
  TransactionReviewFormErrors,
  buildTransactionChanges,
  validateTransactionReviewForm,
} from "./transactionReview.form.utils";
import { GET_CREDIT_CARDS } from "@/features/credit-cards/creditCard.types";
import { GET_BANK_ACCOUNTS } from "@/features/bank-accounts/bankAccount.types";
import { CreditCard } from "@/features/credit-cards/creditCard.types";
import { BankAccount } from "@/features/bank-accounts/bankAccount.types";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Trash2,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
// ─── Sub-components ────────────────────────────────────────────────────────────

function MetaRow({
  label,
  value,
  centerAlign = false,
}: {
  label: string;
  value: React.ReactNode;
  centerAlign?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        centerAlign ? "items-center" : "items-baseline",
      )}
    >
      <span className="text-sm text-muted-foreground w-12 shrink-0 leading-5">
        {label}
      </span>
      <span className="text-sm text-foreground/75 font-medium leading-5 truncate">
        {value}
      </span>
    </div>
  );
}

function TransactionTypeBadge({ type }: { type: string | null | undefined }) {
  const isDebit = type === "DEBIT";

  return (
    <Badge
      className={`flex items-center gap-2 mr-2 ${
        !isDebit
          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      <div>{type ?? "—"}</div>
    </Badge>
  );
}

function parseTransactionDate(date: string | null): Date | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface TransactionReviewCardProps {
  data: TransactionToReview;
  variant?: "review" | "transaction" | "create";
  initialEditMode?: boolean;
  onApprove?: (
    id: string,
    changes: Partial<TransactionToReview>,
  ) => Promise<boolean>;
  onReject?: (id: string, notes?: string) => Promise<boolean>;
  onSaveAndApprove?: (
    id: string,
    changes: Partial<TransactionToReview>,
  ) => Promise<boolean>;
  onSave?: (
    id: string,
    changes: Partial<TransactionToReview>,
  ) => Promise<boolean>;
  onCancel?: () => void;
  saveLabel?: string;
  attachmentItems?: AttachmentItem[];
  maxAttachments?: number;
  onAddAttachmentFiles?: (files: File[]) => void;
  onRetryAttachment?: (localId: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onDismissFailedAttachment?: (localId: string) => void;
}

export function TransactionReviewCard({
  data,
  variant = "review",
  initialEditMode = false,
  onApprove,
  onReject,
  onSaveAndApprove,
  onSave,
  onCancel,
  saveLabel = "Save",
  attachmentItems = [],
  maxAttachments = 3,
  onAddAttachmentFiles,
  onRetryAttachment,
  onRemoveAttachment,
  onDismissFailedAttachment,
}: TransactionReviewCardProps) {
  const isTransactionVariant = variant === "transaction";
  const isCreateVariant = variant === "create";
  const usesTransactionFooter = isTransactionVariant || isCreateVariant;
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [transactionType, setTransactionType] = useState(data.type ?? "DEBIT");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isApproveLoading, setIsApproveLoading] = useState(false);
  const [isRejectLoading, setIsRejectLoading] = useState(false);
  const [isSaveAndApproveLoading, setIsSaveAndApproveLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [name, setName] = useState(data.name ?? "");
  const [merchant, setMerchant] = useState(data.merchant ?? "");
  const [notes, setNotes] = useState(data.notes ?? "");
  const [isCreditCardRepayment, setIsCreditCardRepayment] = useState(
    data.isCreditCardRepayment ?? false,
  );
  const [isPrivate, setIsPrivate] = useState(data.isPrivate ?? false);
  const [errors, setErrors] = useState<TransactionReviewFormErrors>({});

  const [editFields, setEditFields] = useState<EditFields>({
    amount: String(data.amount),
    date: parseTransactionDate(data.date),
    cycle: data.cycle,
    category: data.category?.id
      ? {
          id: data.category.id,
          value: data.category.value ?? "",
          label: data.category.label ?? "",
        }
      : null,
    subCategory: data.subCategory?.id
      ? {
          id: data.subCategory.id,
          value: data.subCategory.value ?? "",
          label: data.subCategory.label ?? "",
        }
      : null,
    paymentMode: data.paymentMode ?? "",
    paymentSourceId: data.paymentSource
      ? `${data.paymentSource.kind}:${data.paymentSource.instrumentId}`
      : "",
  });

  const { data: creditCardsData } = useQuery<{ getCreditCards: CreditCard[] }>(
    GET_CREDIT_CARDS,
    { skip: !isEditMode },
  );
  const { data: bankAccountsData } = useQuery<{
    getBankAccounts: BankAccount[];
  }>(GET_BANK_ACCOUNTS, { skip: !isEditMode });

  const instrumentOptions = isEditMode
    ? [
        ...(creditCardsData?.getCreditCards ?? []).map((cc) => ({
          value: `CREDIT_CARD:${cc.id}`,
          label: `${cc.name} •••• ${cc.last4}`,
        })),
        ...(bankAccountsData?.getBankAccounts ?? []).map((ba) => ({
          value: `BANK_ACCOUNT:${ba.id}`,
          label: `${ba.name} •••• ${ba.last4}`,
        })),
      ]
    : [];

  useEffect(() => {
    setIsPrivate(data.isPrivate ?? false);
  }, [data.id, data.isPrivate]);

  function clearError(field: keyof TransactionReviewFormErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateForm(): boolean {
    const validationErrors = validateTransactionReviewForm({
      name,
      merchant,
      editFields,
      requireMerchant: isCreateVariant,
    });
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }

  function handleEdit() {
    setEditFields({
      amount: String(data.amount),
      date: parseTransactionDate(data.date),
      cycle: data.cycle,
      category: data.category?.id
        ? {
            id: data.category.id,
            value: data.category.value ?? "",
            label: data.category.label ?? "",
          }
        : null,
      subCategory: data.subCategory?.id
        ? {
            id: data.subCategory.id,
            value: data.subCategory.value ?? "",
            label: data.subCategory.label ?? "",
          }
        : null,
      paymentMode: data.paymentMode ?? "",
      paymentSourceId: data.paymentSource
        ? `${data.paymentSource.kind}:${data.paymentSource.instrumentId}`
        : "",
    });
    setIsPrivate(data.isPrivate ?? false);
    setErrors({});
    setIsEditMode(true);
  }

  function handleCancel() {
    if (usesTransactionFooter) {
      onCancel?.();
      return;
    }
    setErrors({});
    setIsEditMode(false);
  }

  async function handleSave() {
    if (!onSave || isSaveLoading) return;
    if (!validateForm()) return;

    setIsSaveLoading(true);
    try {
      const success = await onSave(
        data.id,
        buildTransactionChanges(editFields, {
          name,
          notes,
          merchant,
          isCreditCardRepayment,
          isPrivate,
          isCreateVariant,
          transactionType,
        }),
      );
      if (success) {
        setIsEditMode(false);
      }
    } finally {
      setIsSaveLoading(false);
    }
  }

  async function handleSaveAndApprove() {
    if (!onSaveAndApprove || isSaveAndApproveLoading) return;
    if (!validateForm()) return;

    setIsSaveAndApproveLoading(true);
    try {
      const success = await onSaveAndApprove(
        data.id,
        buildTransactionChanges(editFields, {
          name,
          notes,
          merchant,
          isCreditCardRepayment,
          isPrivate,
          isCreateVariant,
          transactionType,
        }),
      );
      if (success) {
        setIsEditMode(false);
      }
    } finally {
      setIsSaveAndApproveLoading(false);
    }
  }

  async function handleApprove() {
    if (!onApprove || isApproveLoading) return;

    if (!name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }

    setIsApproveLoading(true);
    try {
      await onApprove(data.id, {
        name: name.trim(),
        notes: notes || undefined,
        isCreditCardRepayment,
        isPrivate,
      });
    } finally {
      setIsApproveLoading(false);
    }
  }

  function handleRejectCancel() {
    if (isRejectLoading) return;
    setRejectModalOpen(false);
    setRejectNotes("");
  }

  async function handleConfirmDelete() {
    if (!onReject || isRejectLoading) return;

    setIsRejectLoading(true);
    try {
      const success = await onReject(data.id, rejectNotes.trim() || undefined);
      if (success) {
        setRejectModalOpen(false);
        setRejectNotes("");
      }
    } finally {
      setIsRejectLoading(false);
    }
  }

  const effectiveType = isCreateVariant ? transactionType : data.type;
  const isDebit = effectiveType === "DEBIT";

  return (
    <Card className="flex flex-col h-full bg-card border border-border/40 shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="flex flex-col flex-1 gap-0 px-5 py-5">
        {/* ── Amount + type/AI column ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          {isEditMode ? (
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div
                className={cn(
                  "flex items-center rounded-md border border-input overflow-hidden",
                  errors.amount && "border-destructive",
                )}
              >
                <span className="px-2.5 text-sm text-muted-foreground bg-muted border-r border-input self-stretch flex items-center shrink-0">
                  {data.currency ?? "INR"}
                </span>
                <Input
                  type="number"
                  value={editFields.amount}
                  onChange={(e) => {
                    setEditFields((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }));
                    clearError("amount");
                  }}
                  className="border-0 shadow-none rounded-none focus-visible:ring-0"
                />

                {isCreateVariant ? (
                  <Select
                    value={transactionType}
                    onValueChange={setTransactionType}
                  >
                    <SelectTrigger className="w-auto border-0 shadow-none rounded-none focus:ring-0 h-auto px-2 py-1 gap-1 bg-transparent">
                      {/* <SelectValue className="sr-only" /> */}
                      <TransactionTypeBadge type={transactionType} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBIT">DEBIT</SelectItem>
                      <SelectItem value="CREDIT">CREDIT</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <TransactionTypeBadge type={data.type} />
                  </div>
                )}
              </div>
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className={`text-[1.85rem] font-bold tracking-tight leading-none`}
              >
                {formatAmount(data.amount, data.currency ?? "INR")}
              </div>

              <div>
                <TransactionTypeBadge type={data.type} />
              </div>
            </div>
          )}

          {!isEditMode && variant === "review" && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                onClick={handleEdit}
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Merchant ── */}
        {isCreateVariant ? (
          <div className="flex flex-col gap-0.5 mb-2">
            <span className="text-[12px] text-muted-foreground font-medium mb-[5px]">
              Merchant
            </span>
            <Input
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                clearError("merchant");
              }}
              placeholder="Merchant name…"
              className={errors.merchant ? "border-destructive" : ""}
            />
            {errors.merchant && (
              <p className="text-sm text-destructive">{errors.merchant}</p>
            )}
          </div>
        ) : (
          <p className="text-[15px] font-semibold text-foreground leading-snug truncate mb-2">
            {data.merchant}
          </p>
        )}

        {/* ── Category / subcategory ── */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6 min-h-[18px]">
          {isEditMode ? (
            <div className="flex items-center gap-2 w-full mt-4">
              <div className="w-full">
                <FieldDropdown
                  fieldName="category"
                  value={editFields.category}
                  triggerClassName={
                    errors.category ? "border-destructive" : undefined
                  }
                  onChange={({ value, resetChildren }) => {
                    setEditFields((prev) => ({
                      ...prev,
                      category: value,
                      ...(resetChildren?.includes("subCategory")
                        ? { subCategory: null }
                        : {}),
                    }));
                    clearError("category");
                  }}
                />
              </div>
              <div className="w-full">
                <FieldDropdown
                  fieldName="subCategory"
                  value={editFields.subCategory}
                  parentValue={editFields.category}
                  triggerClassName={
                    errors.subCategory ? "border-destructive" : undefined
                  }
                  onChange={({ value }) => {
                    setEditFields((prev) => ({ ...prev, subCategory: value }));
                    clearError("subCategory");
                  }}
                />
              </div>
            </div>
          ) : data.category?.label && data.category?.value ? (
            <CategorySubCategory
              category={{
                id: data.category.id ?? "",
                label: data.category.label,
                value: data.category.value,
              }}
              subCategory={
                data.subCategory?.label && data.subCategory?.value
                  ? {
                      id: data.subCategory.id ?? "",
                      label: data.subCategory.label,
                      value: data.subCategory.value,
                    }
                  : null
              }
            />
          ) : (
            <span className="text-xs text-muted-foreground/30 italic">
              Uncategorized
            </span>
          )}
        </div>

        <div className="flex justify-between items-center gap-4 mb-6 p-4 border border-radius-md bg-black/80 rounded-md">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">🔒 Mark as private</h3>
            <p className="text-sm text-muted-foreground">
              Hidden from the views untill you enable show private entity in
              settings
            </p>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        {/* ── Metadata ── */}
        <div className="flex flex-col gap-3 mb-6">
          {isEditMode ? (
            <div className="flex gap-3 items-center">
              <p className="text-sm text-muted-foreground w-12 shrink-0 leading-5">
                Date
              </p>
              <DateTimePicker
                type="date-time"
                value={editFields.date}
                onSave={(d) => {
                  setEditFields((prev) => ({ ...prev, date: d }));
                  clearError("date");
                }}
                className="flex-1 min-w-0"
                triggerClassName={
                  errors.date ? "border-destructive" : undefined
                }
                aria-label="Transaction date and time"
              />
            </div>
          ) : (
            <MetaRow label="Date" value={formatDate(data.date)} />
          )}

          {isEditMode ? (
            <div className="flex gap-3 items-center">
              <p className="text-sm text-muted-foreground w-12 shrink-0 leading-5">
                Cycle
              </p>
              <CyclePicker
                value={editFields.cycle}
                onChange={(cycle) => {
                  setEditFields((prev) => ({ ...prev, cycle }));
                  clearError("cycle");
                }}
                className="flex-1 min-w-0"
                hasError={Boolean(errors.cycle)}
              />
            </div>
          ) : (
            <MetaRow label="Cycle" value={formatCycle(data.cycle)} />
          )}

          {isEditMode ? (
            <div className="flex gap-3 items-center">
              <p className="text-sm text-muted-foreground w-12 shrink-0 leading-5">
                Source
              </p>
              <Select
                value={editFields.paymentSourceId}
                onValueChange={(v) => {
                  setEditFields((prev) => ({ ...prev, paymentSourceId: v }));
                  clearError("paymentSourceId");
                }}
              >
                <SelectTrigger
                  className={cn(
                    "flex-1 min-w-0",
                    errors.paymentSourceId && "border-destructive",
                  )}
                >
                  <SelectValue placeholder="Select source…" />
                </SelectTrigger>
                <SelectContent>
                  {instrumentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <MetaRow
              label="Source"
              value={<PaymentSource paymentSource={data.paymentSource} />}
            />
          )}

          {isEditMode ? (
            <div className="flex gap-3 items-center">
              <p className="text-sm text-muted-foreground w-12 shrink-0 leading-5">
                Mode
              </p>
              <Select
                value={editFields.paymentMode}
                onValueChange={(v) => {
                  setEditFields((prev) => ({ ...prev, paymentMode: v }));
                  clearError("paymentMode");
                }}
              >
                <SelectTrigger
                  className={cn(
                    "flex-1 min-w-0",
                    errors.paymentMode && "border-destructive",
                  )}
                >
                  <SelectValue placeholder="Select mode…" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <MetaRow
              label="Mode"
              centerAlign={true}
              value={
                data.paymentMode && isPaymentModeType(data.paymentMode) ? (
                  <PaymentMode mode={data.paymentMode} />
                ) : (
                  formatPaymentMode(data.paymentMode)
                )
              }
            />
          )}

          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id={`credit-card-repayment-${data.id}`}
              checked={isCreditCardRepayment}
              onCheckedChange={(checked) =>
                setIsCreditCardRepayment(checked === true)
              }
            />
            <Label
              htmlFor={`credit-card-repayment-${data.id}`}
              className="text-sm font-normal cursor-pointer"
            >
              Mark as credit card repayment
            </Label>
          </div>
        </div>

        {/* ── Editable fields ── */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] text-muted-foreground font-medium mb-[5px]">
              Name
            </span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              placeholder="Transaction name…"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] text-muted-foreground font-medium mb-[5px]">
              Notes
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
              // className={`min-h-[52px] text-sm resize-none ${subtleInput}`}
              rows={2}
            />
          </div>
        </div>

        {/* ── Attachments ── */}
        {(variant === "review" || isTransactionVariant || isCreateVariant) && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-foreground">
                Attachments
              </span>
              {onAddAttachmentFiles && (
                <AttachmentUploaderButton
                  onFilesSelected={onAddAttachmentFiles}
                  disabled={
                    attachmentItems.filter((item) => item.status !== "FAILED")
                      .length >= maxAttachments
                  }
                />
              )}
            </div>
            <AttachmentGroup
              items={attachmentItems}
              entityType={
                isTransactionVariant
                  ? "TRANSACTION"
                  : variant === "review"
                    ? "REVIEW"
                    : undefined
              }
              entityId={isCreateVariant ? undefined : data.id}
              onRemove={
                onRemoveAttachment
                  ? (attachmentId) => onRemoveAttachment(attachmentId)
                  : undefined
              }
              onRetry={
                onRetryAttachment
                  ? (localId) => onRetryAttachment(localId)
                  : undefined
              }
              onDismissFailed={
                onDismissFailedAttachment
                  ? (localId) => onDismissFailedAttachment(localId)
                  : undefined
              }
            />
          </div>
        )}

        {/* ── Actions ── */}
        {variant === "review" && (
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground hover:text-foreground"
                  onClick={handleCancel}
                  disabled={isSaveAndApproveLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSaveAndApprove}
                  disabled={isSaveAndApproveLoading}
                >
                  {isSaveAndApproveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Save & approve
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setRejectModalOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Reject
                </Button>
                <Dialog
                  open={rejectModalOpen}
                  onOpenChange={(open) => {
                    if (isRejectLoading) return;
                    setRejectModalOpen(open);
                    if (!open) setRejectNotes("");
                  }}
                >
                  <DialogContent className="sm:max-w-md [&>button]:hidden">
                    <div className="flex flex-col gap-4">
                      <Trash2 className="h-6 w-6 text-destructive" />
                      <DialogHeader className="space-y-1 p-0 text-left">
                        <DialogTitle className="text-base font-semibold leading-snug mb-1">
                          Are you sure you want to delete this transaction
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                          This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        placeholder="Notes.."
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        className="min-h-[80px] resize-none mt-1"
                        disabled={isRejectLoading}
                      />
                      <DialogFooter className="flex-row gap-2 p-0 sm:justify-stretch">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={handleRejectCancel}
                          disabled={isRejectLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="flex-1"
                          onClick={handleConfirmDelete}
                          disabled={isRejectLoading}
                        >
                          {isRejectLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  className="flex-[2]"
                  size="sm"
                  onClick={handleApprove}
                  disabled={isApproveLoading}
                >
                  {isApproveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </div>
        )}

        {usesTransactionFooter && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-foreground hover:text-foreground"
              onClick={handleCancel}
              disabled={isSaveLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSave}
              disabled={isSaveLoading}
            >
              {isSaveLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {saveLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
