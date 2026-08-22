import { useState } from "react";
import { useParams } from "react-router-dom";
import { ChatPanel } from "@/features/conversations/ChatPanel";
import { ConversationHistorySidebar } from "@/features/conversations/ConversationHistorySidebar";

export default function ConversationsPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full">
      <ConversationHistorySidebar
        activeConversationId={conversationId ?? null}
        mobileOpen={mobileHistoryOpen}
        onMobileOpenChange={setMobileHistoryOpen}
      />
      <ChatPanel conversationId={conversationId ?? null} onOpenHistory={() => setMobileHistoryOpen(true)} />
    </div>
  );
}
