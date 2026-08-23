import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatPanel } from "@/features/conversations/ChatPanel";
import { ConversationHistorySidebar } from "@/features/conversations/ConversationHistorySidebar";
import { useConversationStore } from "@/store/conversationStore";

export default function ConversationsPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const loadConversation = useConversationStore((s) => s.loadConversation);

  // Hydrates the history sidebar — the store is a client-side cache now,
  // not local-only state, so this needs a real fetch on mount.
  useEffect(() => {
    loadConversations().catch((error) => console.error("[ConversationsPage] Failed to load conversations:", error));
  }, [loadConversations]);

  // Hydrates the active conversation's transcript on navigation/refresh —
  // without this, refreshing /ask-cortex/:id would show an empty panel
  // with no way to reload it (the store holds no history across reloads).
  useEffect(() => {
    if (!conversationId) return;
    loadConversation(conversationId).catch((error) => console.error("[ConversationsPage] Failed to load conversation:", error));
  }, [conversationId, loadConversation]);

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
