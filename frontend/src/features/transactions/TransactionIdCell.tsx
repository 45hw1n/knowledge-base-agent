import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/lib/ui/tooltip";

type TransactionIdCellProps = {
  displayId: string;
  isPrivate?: boolean;
  approvalActor?: string | null;
};

function IconWithTooltip({ icon, label }: { icon: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default" aria-label={label}>
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TransactionIdCell({
  displayId,
  isPrivate = false,
  approvalActor,
}: TransactionIdCellProps) {
  const showAiApproved = approvalActor === "AI";
  const showIcons = showAiApproved || isPrivate;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="truncate">{displayId}</span>
        {showIcons && (
          <div className="flex items-center gap-1 shrink-0">
            {showAiApproved && (
              <IconWithTooltip icon="✨" label="AI Approved" />
            )}
            {isPrivate && (
              <IconWithTooltip icon="🔒" label="Private transaction" />
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
