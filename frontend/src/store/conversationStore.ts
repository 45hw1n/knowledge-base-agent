import { create } from "zustand";

// Local-only for now — no backend persistence, no real AI reply yet. See
// decisions.md: this is the UI shell for the chat feature; LLM/RAG wiring
// and server-side persistence are an explicit follow-up phase.

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

interface ConversationState {
  conversations: Conversation[];
  createConversation: () => string;
  addMessage: (conversationId: string, role: ChatRole, content: string) => void;
}

function deriveTitle(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "New conversation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],

  createConversation: () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    set((state) => ({
      conversations: [
        { id, title: "New conversation", messages: [], updatedAt: now },
        ...state.conversations,
      ],
    }));
    return id;
  },

  addMessage: (conversationId, role, content) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;

        const messages = [
          ...conversation.messages,
          { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() },
        ];
        // First user message in a fresh conversation becomes its title —
        // same "derive, don't ask" convention as everything else here.
        const title =
          conversation.messages.length === 0 && role === "user" ? deriveTitle(content) : conversation.title;

        return { ...conversation, messages, title, updatedAt: new Date().toISOString() };
      }),
    }));
  },
}));
