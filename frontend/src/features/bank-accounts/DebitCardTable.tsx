import React from "react";
import { Edit2, Trash2 } from "lucide-react";
import { SuperTable } from "@/components/SuperTable/SuperTable";
import { SuperColumnDef } from "@/components/SuperTable/SuperTable.types";
import { ListInfo } from "@/store/useTableStore";
import { Button } from "@/lib/ui/button";
import { DebitCardFormValues } from "./bankAccount.form.types";

const EMPTY_FILTER: ListInfo['filters'] = {};

interface DebitCardTableProps {
  data: DebitCardFormValues[];
  onEdit: (card: DebitCardFormValues, index: number) => void;
  onDelete: (index: number) => void;
}

export function DebitCardTable({ data, onEdit, onDelete }: DebitCardTableProps) {
  const columns: SuperColumnDef<DebitCardFormValues, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "last4",
      header: "Last 4",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">**** {row.original.last4}</span>
      ),
    },
    {
      accessorKey: "expiry",
      header: "Expiry",
      cell: ({ row }) => {
        const expiry = row.original.expiry;
        return (
          <span>
            {expiry.slice(0, 2)}/{expiry.slice(2)}
          </span>
        );
      },
    },
    {
      accessorKey: "id", // Dummy key for actions
      header: "",
      cell: ({ row }) => {
        const index = row.index;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original, index)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const fetchDataOverride = async (listInfo: ListInfo) => {
    // Basic client-side search/sort could be added here if needed, 
    // but for form state it's usually small.
    return {
      data: data,
      total: data.length,
    };
  };

  return (
      <div className="max-h-[250px] overflow-y-auto">
        <SuperTable<DebitCardFormValues>
          id="debit-cards-form-table"
          name="debitCardsForm"
          columns={columns}
          defaultSort={null}
          defaultFilter={EMPTY_FILTER}
          defaultPageSize={100}
          fetchDataOverride={fetchDataOverride}
        />
      </div>
  );
}
