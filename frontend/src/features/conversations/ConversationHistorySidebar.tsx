import { useNavigate } from "react-router-dom";
import { SquarePen, X } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConversationStore } from "@/store/conversationStore";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface ConversationHistorySidebarProps {
  activeConversationId: string | null;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

/**
 * The second, always-visible-on-desktop sidebar listing past conversations
 * — distinct from the collapsible app-nav Sidebar (lib/ui/sidebar.tsx),
 * which is locked to its icon rail on this route (see AppLayout.tsx). This
 * one is a plain component, not built on the shadcn Sidebar primitives,
 * since it doesn't need icon/offcanvas collapse modes — just show/hide on
 * mobile via a simple overlay.
 */
export function ConversationHistorySidebar({
  activeConversationId,
  mobileOpen,
  onMobileOpenChange,
}: ConversationHistorySidebarProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const conversations = useConversationStore((s) => s.conversations);
  const createConversation = useConversationStore((s) => s.createConversation);

  const handleNewConversation = () => {
    const id = createConversation();
    navigate(`/conversations/${id}`);
    onMobileOpenChange(false);
  };

  const handleSelect = (id: string) => {
    navigate(`/conversations/${id}`);
    onMobileOpenChange(false);
  };

  const listContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-semibold">Conversations</span>
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMobileOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-3">
        <Button className="w-full justify-start gap-2" variant="outline" onClick={handleNewConversation}>
          <SquarePen className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => handleSelect(conversation.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                conversation.id === activeConversationId && "bg-sidebar-accent font-medium"
              )}
            >
              <span className="w-full truncate">{conversation.title}</span>
              <span className="text-xs text-muted-foreground">{formatUpdatedAt(conversation.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (isMobile) {
    if (!mobileOpen) return null;
    return (
      <div className="fixed inset-0 z-30 flex">
        <div className="w-72 max-w-[85vw] border-r bg-sidebar">{listContent}</div>
        <div className="flex-1 bg-black/50" onClick={() => onMobileOpenChange(false)} />
      </div>
    );
  }

  return <div className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:w-72">{listContent}</div>;
}
