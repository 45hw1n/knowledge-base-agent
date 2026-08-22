import config from "@/lib/config";

// Plain REST client for the chat feature — everything else in this app goes
// through Apollo/GraphQL, but the chat backend is deliberately REST (see
// decisions.md: short-polling a status endpoint doesn't need a GraphQL
// schema). `credentials: "include"` matches the session-cookie auth pattern
// Apollo's uploadLink already uses for this same backend.

export type SourceType = "TICKET" | "INVOICE" | "PAYMENT" | "EVENT" | "DOCUMENT";

export interface ChatSource {
  entityId: string;
  displayId: string;
  title: string;
  type: SourceType;
}

export interface ChatError {
  code: string;
  message: string;
}

export type SendResult = { conversationId: string; messageId: string; status: "PROCESSING" };

export type MessageStatusResult =
  | { status: "PROCESSING" }
  | { status: "COMPLETED"; message: string; sources: ChatSource[] }
  | { status: "FAILED"; error: ChatError };

export interface ConversationSummary {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  messageId: string;
  role: "user" | "assistant";
  content: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  sources: ChatSource[];
  error: ChatError | null;
  createdAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}/api/conversations${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body?.error === "string" ? body.error : body?.error?.message || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export const chatApi = {
  createConversation: (input: string) =>
    request<SendResult>("", { method: "POST", body: JSON.stringify({ input }) }),

  postMessage: (conversationId: string, input: string) =>
    request<SendResult>(`/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ input }) }),

  getMessageStatus: (conversationId: string, messageId: string) =>
    request<MessageStatusResult>(`/${conversationId}/messages/${messageId}/status`),

  listConversations: () => request<ConversationSummary[]>(""),

  getMessages: (conversationId: string) => request<ChatMessageRecord[]>(`/${conversationId}/messages`),
};
