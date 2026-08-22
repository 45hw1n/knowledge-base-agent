import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/lib/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConversationStore } from "@/store/conversationStore";
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
  const createConversation = useConversationStore((s) => s.createConversation);
  const addMessage = useConversationStore((s) => s.addMessage);

  // Sending from the welcome screen (no conversation selected yet) creates
  // one on the fly and navigates to it — matches Claude Desktop, where
  // there's no separate "create" step before you can just start typing.
  const handleSend = (content: string) => {
    let targetId = conversationId;
    if (!targetId) {
      targetId = createConversation();
      navigate(`/conversations/${targetId}`);
    }
    addMessage(targetId, "user", content);
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
              <span key={prompt} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
                {prompt}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {conversation.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Send a message to get started.</p>
          ) : (
            conversation.messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ChatComposer onSend={handleSend} />
    </div>
  );
}
