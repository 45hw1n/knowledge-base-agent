import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Download } from "lucide-react";
import { TransactionPeriodFilter } from "@/components/common/TransactionPeriodFilter";
import { Button } from "@/lib/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/lib/ui/card";
import { Label } from "@/lib/ui/label";
import { Checkbox } from "@/lib/ui/checkbox";
import { Modal } from "@/lib/ui/modal";
import { RadioGroup, RadioGroupItem } from "@/lib/ui/radio-group";
import { downloadBase64File } from "@/lib/utils/downloadBase64File";
import { toast } from "sonner";
import type { TransactionListCondition } from "./TransactionList";
import {
  buildTransactionExportConditions,
  TRANSACTION_EXPORT_SORT,
} from "./transactionExport.utils";
import {
  EXPORT_TRANSACTIONS,
  type TransactionExportType,
} from "./transaction.types";

type ExportTransactionProps = {
  label?: string;
  variant?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ExportTransaction({
  label = "Export",
  variant = "outline",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ExportTransactionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;
  const [periodCondition, setPeriodCondition] =
    useState<TransactionListCondition | null>(null);
  const [includePrivateTransactions, setIncludePrivateTransactions] =
    useState(false);
  const [exportType, setExportType] = useState<TransactionExportType | "">("");
  const [exporting, setExporting] = useState(false);

  const [exportTransactions] = useMutation(EXPORT_TRANSACTIONS);

  const conditions = buildTransactionExportConditions(
    periodCondition,
    includePrivateTransactions,
  );
  const canExport = Boolean(exportType && conditions);

  async function handleExport() {
    if (!exportType || !conditions) return;

    setExporting(true);
    try {
      const { data: result } = await exportTransactions({
        variables: {
          input: {
            exportType,
            sort: TRANSACTION_EXPORT_SORT,
            conditions,
          },
        },
      });

      const payload = result?.exportTransactions;
      if (
        payload?.success
        && payload.contentBase64
        && payload.fileName
        && payload.mimeType
      ) {
        downloadBase64File(
          payload.contentBase64,
          payload.fileName,
          payload.mimeType,
        );
        toast.success(
          payload.rowCount != null
            ? `Exported ${payload.rowCount} transaction${payload.rowCount === 1 ? "" : "s"}`
            : "Transactions exported",
        );
        setOpen(false);
        return;
      }

      toast.error(payload?.error?.message ?? "Failed to export transactions");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to export transactions",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleExport();
  }

  const activator = isControlled ? undefined : (
    <Button variant={variant as "outline"} className="flex items-center gap-2">
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={setOpen} activator={activator}>
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>
              <span className="mr-2">📤</span>
              Export transactions
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Period */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">1. Select Period</Label>
              <TransactionPeriodFilter onFilterChange={setPeriodCondition} />
            </div>

            {/* Private transactions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                2. Private transaction
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="export-include-private"
                  checked={includePrivateTransactions}
                  onCheckedChange={(checked) =>
                    setIncludePrivateTransactions(checked === true)
                  }
                />
                <Label htmlFor="export-include-private">
                  Check the box to export private transactions.
                </Label>
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground pb-4">3. Select file format</Label>
              <RadioGroup
                value={exportType}
                onValueChange={(value) =>
                  setExportType(value as TransactionExportType)
                }
              >
                <div className="flex items-center gap-2 mb-2">
                  <RadioGroupItem value="CSV" id="export-format-csv" />
                  <Label htmlFor="export-format-csv">CSV</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="XLSX" id="export-format-xlsx" />
                  <Label htmlFor="export-format-xlsx">XLSX</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t pt-6">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canExport || exporting}>
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Modal>
  );
}
