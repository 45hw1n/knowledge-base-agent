import { create } from "zustand";
import { chatApi, type ChatSource, type ChatError } from "@/lib/api/chatApi";

// Server-backed — see decisions.md's Phase 3 entry. The backend
// (ChatConversation/ChatMessage) is the source of truth; this store is a
// client-side cache hydrated via chatApi, not local-only state anymore.

export type ChatRole = "user" | "assistant";
// PROCESSING/COMPLETED/FAILED come from the backend; TIMEOUT is set locally
// by the polling hook after 60s and is never written back to the server —
// see useMessageStatusPoll.ts.
export type MessageStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "TIMEOUT";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string | null;
  status: MessageStatus;
  sources: ChatSource[];
  error: ChatError | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationState {
  conversations: Conversation[];
  conversationsLoaded: boolean;
  loadConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  sendNewConversation: (input: string) => Promise<{ conversationId: string; messageId: string }>;
  sendMessage: (conversationId: string, input: string) => Promise<{ messageId: string }>;
  applyStatusUpdate: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
}

function makeUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    status: "COMPLETED",
    sources: [],
    error: null,
    createdAt: new Date().toISOString(),
  };
}

function makeProcessingAssistantMessage(messageId: string): ChatMessage {
  return {
    id: messageId,
    role: "assistant",
    content: null,
    status: "PROCESSING",
    sources: [],
    error: null,
    createdAt: new Date().toISOString(),
  };
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  conversationsLoaded: false,

  loadConversations: async () => {
    const summaries = await chatApi.listConversations();
    set((state) => {
      const existingById = new Map(state.conversations.map((c) => [c.id, c]));
      const conversations = summaries.map((summary) => {
        const existing = existingById.get(summary.conversationId);
        return {
          id: summary.conversationId,
          title: summary.title,
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
          messages: existing?.messages ?? [],
        };
      });
      return { conversations, conversationsLoaded: true };
    });
  },

  loadConversation: async (conversationId) => {
    const records = await chatApi.getMessages(conversationId);
    const messages: ChatMessage[] = records.map((record) => ({
      id: record.messageId,
      role: record.role,
      content: record.content,
      status: record.status,
      sources: record.sources,
      error: record.error,
      createdAt: record.createdAt,
    }));

    set((state) => {
      const existing = state.conversations.find((c) => c.id === conversationId);
      if (existing) {
        return {
          conversations: state.conversations.map((c) => (c.id === conversationId ? { ...c, messages } : c)),
        };
      }
      // Direct navigation before loadConversations() has resolved — insert
      // a placeholder; the real title lands once that call completes.
      const now = new Date().toISOString();
      return {
        conversations: [{ id: conversationId, title: "Conversation", messages, createdAt: now, updatedAt: now }, ...state.conversations],
      };
    });
  },

  sendNewConversation: async (input) => {
    const { conversationId, messageId } = await chatApi.createConversation(input);
    const now = new Date().toISOString();
    const messages = [makeUserMessage(input), makeProcessingAssistantMessage(messageId)];
    set((state) => ({
      conversations: [{ id: conversationId, title: "New conversation", messages, createdAt: now, updatedAt: now }, ...state.conversations],
    }));
    return { conversationId, messageId };
  },

  sendMessage: async (conversationId, input) => {
    const { messageId } = await chatApi.postMessage(conversationId, input);
    const now = new Date().toISOString();
    const newMessages = [makeUserMessage(input), makeProcessingAssistantMessage(messageId)];
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, messages: [...c.messages, ...newMessages], updatedAt: now } : c
      ),
    }));
    return { messageId };
  },

  applyStatusUpdate: (conversationId, messageId, patch) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) };
      }),
    }));
  },
}));
