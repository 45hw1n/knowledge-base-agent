import { useState } from "react";
import { Download, EllipsisVertical, Plus } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/lib/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/lib/ui/popover";
import { cn } from "@/lib/utils";
import { CreateTransaction } from "./CreateTransaction";
import { ExportTransaction } from "./ExportTransaction";

const menuItemClassName =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus:bg-accent";

export function TransactionListActions() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  if (isDesktop) {
    return (
      <div className="flex items-center gap-2">
        <ExportTransaction />
        <CreateTransaction />
      </div>
    );
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Transaction actions">
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <button
            type="button"
            className={cn(menuItemClassName)}
            onClick={() => {
              setPopoverOpen(false);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add transaction
          </button>
          <button
            type="button"
            className={cn(menuItemClassName)}
            onClick={() => {
              setPopoverOpen(false);
              setExportOpen(true);
            }}
          >
            <Download className="h-4 w-4" />
            Export transactions
          </button>
        </PopoverContent>
      </Popover>

      <CreateTransaction open={createOpen} onOpenChange={setCreateOpen} />
      <ExportTransaction open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}
