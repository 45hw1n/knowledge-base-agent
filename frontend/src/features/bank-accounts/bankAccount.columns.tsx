import BankAccountActions from "./bankAccount.actions";

export const bankAccountColumns: SuperColumnDef<BankAccount, any>[] = [
  {
    accessorKey: "name",
    header: "Account Name",
    enableSorting: true,
  },
  {
    accessorKey: "bank",
    header: "Bank",
    enableSorting: true,
  },
  {
    accessorKey: "last4",
    header: "Account No.",
    cell: ({ row }) => {
      const last4 = row.original.last4;
      return (
        <span className="font-mono text-muted-foreground">**** {last4}</span>
      );
    },
  },
  {
    accessorKey: "accountType",
    header: "Type",
    meta: {
      type: "text",
      badge: {
        SAVINGS:
          "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
        CURRENT: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
        SALARY:
          "bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25",
        JOINT:
          "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
      },
    },
  },
  {
    accessorKey: "debitCards",
    header: "Debit Cards",
    cell: ({ row }) => {
      const count = row.original.debitCards?.length || 0;
      if (count === 0)
        return <span className="text-muted-foreground">None</span>;
      return (
        <span>
          {count} Debit card{count > 1 ? "s" : ""}
        </span>
      );
    },
  },
  {
    accessorKey: "id", // Use id as accessor for actions
    header: "",
    cell: ({ row }) => <BankAccountActions account={row.original} />,
  },
];
