import React from "react";
import { SuperColumnDef } from "@/components/SuperTable";
import CategorySubCategory from "@/components/common/CategorySubCategory";
import PaymentMode, {
  isPaymentModeType,
} from "@/components/common/PaymentMode";
import PaymentSource from "@/components/common/PaymentSource";
import { Transaction } from "./transaction.types";
import TransactionActions from "./transaction.actions";
import { TransactionIdCell } from "./TransactionIdCell";
import { TransactionAttachmentsCell } from "./TransactionAttachmentsCell";

export const transactionColumns: SuperColumnDef<Transaction, any>[] = [
  {
    id: "displayId",
    accessorKey: "displayId",
    header: "ID",
    minWidth: 150,
    maxWidth: 300,
    cell: ({ row }) => (
      <div className="pr-2">
        <TransactionIdCell
          displayId={row.original.displayId}
          isPrivate={row.original.isPrivate}
          approvalActor={row.original.approvalActor}
        />
      </div>
    ),
  },
  {
    id: "attachments",
    accessorKey: "attachments",
    header: "Attachments",
    minWidth: 135,
    maxWidth: 180,
    cell: ({ row }) => (
      <TransactionAttachmentsCell
        transactionId={row.original.id}
        attachments={row.original.attachments ?? []}
      />
    ),
  },
  {
    id: "date",
    accessorKey: "date",
    backendKey: "date",
    header: "Date",
    enableSorting: true,
    minWidth: 100,
    maxWidth: 180,
    cell: ({ row }) => {
      const raw = row.original.date;
      if (!raw) return "—";
      return new Date(raw).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
  {
    id: "merchant",
    accessorKey: "merchant",
    backendKey: "merchant",
    header: "Merchant",
    enableSorting: true,
    minWidth: 120,
    maxWidth: 300,
  },
  {
    id: "amount",
    accessorKey: "amount",
    backendKey: "amount",
    header: "Amount",
    enableSorting: true,
    minWidth: 100,
    maxWidth: 160,
    cell: ({ row }) => {
      const { amount, currency } = row.original;
      return (
        <span className="tabular-nums">
          {currency} {amount.toFixed(2)}
        </span>
      );
    },
  },

  {
    id: "name",
    accessorKey: "name",
    backendKey: "name",
    header: "Name",
    enableSorting: true,
    minWidth: 120,
    maxWidth: 300,
  },
  {
    id: "cycle",
    accessorKey: "cycle",
    backendKey: "cycle",
    header: "Cycle",
    minWidth: 80,
    maxWidth: 140,
  },
  {
    id: "category",
    accessorKey: "category",
    header: "Category",
    minWidth: 140,
    maxWidth: 280,
    cell: ({ row }) => {
      const { category, subCategory } = row.original;
      if (!category?.label || !category?.value) return "—";
      return (
        <CategorySubCategory
          category={{
            id: category.id ?? "",
            label: category.label,
            value: category.value,
          }}
          subCategory={
            subCategory?.label && subCategory?.value
              ? {
                  id: subCategory.id ?? "",
                  label: subCategory.label,
                  value: subCategory.value,
                }
              : null
          }
        />
      );
    },
  },
  {
    id: "paymentMode",
    accessorKey: "paymentMode",
    backendKey: "paymentMode",
    header: "Payment Mode",
    minWidth: 120,
    maxWidth: 200,
    cell: ({ row }) => {
      const mode = row.original.paymentMode;
      if (!mode) return "—";
      if (!isPaymentModeType(mode)) return mode;
      return <PaymentMode mode={mode} />;
    },
  },
  {
    id: "paymentSource",
    accessorKey: "paymentSource",
    header: "Payment Source",
    minWidth: 140,
    maxWidth: 280,
    cell: ({ row }) => (
      <PaymentSource paymentSource={row.original.paymentSource} />
    ),
  },
  {
    id: "type",
    accessorKey: "type",
    backendKey: "type",
    header: "Type",
    enableSorting: true,
    minWidth: 80,
    maxWidth: 140,
  },
  {
    id: "actions",
    accessorKey: "actions",
    header: "",
    isPinned: true,
    pinPosition: "right",
    minWidth: 120,
    maxWidth: 120,
    enableResizing: false,
    cell: ({ row }) => {
      const transaction = row.original;
      return <TransactionActions transaction={transaction} />;
    },
  },
];
