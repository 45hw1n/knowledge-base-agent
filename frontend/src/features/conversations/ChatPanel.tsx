import { useEffect } from "react";
import { Menu, Loader2, RotateCw, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/lib/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConversationStore, type ChatMessage } from "@/store/conversationStore";
import { useMessageStatusPoll } from "./polling/useMessageStatusPoll";
import { SourcesList } from "./SourcesList";
import { ChatComposer } from "./ChatComposer";

const EXAMPLE_PROMPTS = [
  "What invoices are still unpaid?",
  "Summarize my open tickets",
  "Which vendors have I paid this month?",
];

interface ChatPanelProps {
  conversationId: string | null;
  onOpenHistory: () => void;
}

export function ChatPanel({ conversationId, onOpenHistory }: ChatPanelProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const conversation = useConversationStore((s) =>
    conversationId ? s.conversations.find((c) => c.id === conversationId) ?? null : null
  );
  const sendNewConversation = useConversationStore((s) => s.sendNewConversation);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const applyStatusUpdate = useConversationStore((s) => s.applyStatusUpdate);
  const loadConversations = useConversationStore((s) => s.loadConversations);

  // At most one message is ever polled per conversation — the most recent
  // assistant turn, and only while it's still PROCESSING or has timed out
  // (TIMEOUT keeps the same poll hook instance alive so its `refresh()`
  // stays reachable; a terminal COMPLETED/FAILED stops tracking it).
  const lastMessage = conversation?.messages[conversation.messages.length - 1];
  const isTracking =
    lastMessage?.role === "assistant" && (lastMessage.status === "PROCESSING" || lastMessage.status === "TIMEOUT");
  const trackedMessageId = isTracking ? lastMessage.id : null;
  const poll = useMessageStatusPoll(trackedMessageId ? conversationId : null, trackedMessageId);

  useEffect(() => {
    if (!trackedMessageId || !conversationId) return;
    applyStatusUpdate(conversationId, trackedMessageId, {
      status: poll.status,
      content: poll.message,
      sources: poll.sources,
      error: poll.error,
    });

    // A completed/failed turn is also when a new conversation's AI-generated
    // title (set server-side, in parallel with orchestration — see
    // chatController.js's processNewConversationAsync) actually lands.
    // Without this, the sidebar would keep showing the "New conversation"
    // placeholder title until some unrelated navigation happened to
    // refetch the list.
    if (poll.status === "COMPLETED" || poll.status === "FAILED") {
      loadConversations().catch((error) => console.error("[ChatPanel] Failed to refresh conversation list:", error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.status, poll.message, poll.sources, poll.error]);

  // Sending from the welcome screen (no conversation selected yet) creates
  // one on the fly and navigates to it — matches Claude Desktop, where
  // there's no separate "create" step before you can just start typing.
  const handleSend = async (content: string) => {
    if (!conversationId) {
      const { conversationId: newId } = await sendNewConversation(content);
      navigate(`/conversations/${newId}`);
      return;
    }
    await sendMessage(conversationId, content);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isMobile && (
        <div className="flex items-center gap-2 border-b p-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenHistory}>
            <Menu className="h-4 w-4" />
          </Button>
          <span className="truncate text-sm font-medium">{conversation?.title ?? "New conversation"}</span>
        </div>
      )}

      {!conversation ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Ask Cortex about your knowledge base</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Start a new conversation to ask about your invoices, tickets, and everything else Cortex has
            extracted from your inbox.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Capped at the same max-w-3xl/mx-auto as ChatComposer below, so
              the message thread reads as one centered column instead of
              stretching edge-to-edge in a wide chat panel. */}
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {conversation.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Send a message to get started.</p>
            ) : (
              conversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} onRefresh={message.id === trackedMessageId ? poll.refresh : undefined} />
              ))
            )}
          </div>
        </div>
      )}

      <ChatComposer onSend={handleSend} />
    </div>
  );
}

function MessageBubble({ message, onRefresh }: { message: ChatMessage; onRefresh?: () => void }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.status === "PROCESSING" && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </span>
        )}

        {message.status === "COMPLETED" && (
          <>
            {message.content}
            <SourcesList sources={message.sources} />
          </>
        )}

        {message.status === "FAILED" && (
          <span className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" />
            {message.error?.message || "Something went wrong."}
          </span>
        )}

        {message.status === "TIMEOUT" && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground">This is taking longer than expected.</span>
            <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={onRefresh}>
              <RotateCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
