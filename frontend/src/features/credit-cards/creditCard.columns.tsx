import React from "react";
import { SuperColumnDef } from "@/components/SuperTable";
import DayOfMonth from "@/components/common/DayOfMonth";
import { CreditCard } from "./creditCard.types";
import { formatCardLast4, formatExpiry } from "./creditCard.utils";
import CreditCardActions from "./creditCard.actions";

export const creditCardColumns: SuperColumnDef<CreditCard, any>[] = [
  {
    accessorKey: "name",
    backendKey: "name",
    header: "Card Name",
    enableSorting: true,
  },
  {
    accessorKey: "bank",
    header: "Bank",
  },
  {
    accessorKey: "last4",
    header: "Last 4 Digits",
    cell: ({ row }) => {
      const last4 = row.original.last4;
      return (
        <span className="font-mono text-muted-foreground">**** {last4}</span>
      );
    },
  },
  {
    accessorKey: "expiry",
    header: "Expiry",
    cell: ({ row }) =>
      formatExpiry(row.original.expiryMonth, row.original.expiryYear),
  },
  {
    accessorKey: "billingCycleDay",
    header: "Billing Cycle",
    cell: ({ row }) => <DayOfMonth day={row.original.billingCycleDay} />,
  },
  {
    accessorKey: "dueDateDay",
    header: "Due Date",
    cell: ({ row }) => <DayOfMonth day={row.original.dueDateDay} />,
  },
  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => {
      const card = row.original;
      return <CreditCardActions card={card} />;
    },
  },
];
