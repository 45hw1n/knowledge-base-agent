// Mirrors the backend Mongoose schemas (backend/src/models/*.js) AND the
// GraphQL schema (backend/src/graphql/schema.js) field for field — this is
// now the real API contract's frontend type definitions, not mock-only
// (the mock *data* files this used to back have been removed; the real
// entities/entityDetail queries are wired in EntityList.tsx/
// EntityDetailSheet.tsx). Kept in `mocks/` to avoid a churny cross-file
// rename; only the data files moved on, not this one.
//
// Naming note: the typed entities are called `CalendarEvent` and
// `KnowledgeDocument` here rather than `Event`/`Document` — those names
// would shadow the global DOM `Event`/`Document` types in any file that
// also touches the browser API, which is exactly the kind of subtle bug
// worth avoiding up front. (The backend GraphQL types ARE named `Event`/
// `Document` — no such collision risk server-side.)

export interface Person {
  name: string | null;
  email: string | null;
}

export interface Money {
  value: number;
  currency: string | null;
}

export interface AttachmentRef {
  attachmentId: string;
  fileName: string;
}

export type ConversationDirection = 'SENT' | 'RECEIVED';

export interface ConversationMessage {
  messageId: string;
  direction: ConversationDirection;
  content: string;
  timestamp: string;
  attachments: AttachmentRef[];
}

export type SourceType = 'EMAIL' | 'DOCUMENT';

// ---------------------------------------------------------------------------
// Entity — the top-level registry
// ---------------------------------------------------------------------------

export type EntityType = 'TICKET' | 'INVOICE' | 'PAYMENT' | 'EVENT' | 'DOCUMENT';
export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

// Backend today only implements EMAIL/GMAIL (see backend/src/models/Entity.js
// — SOURCE_TYPES is deliberately kept generic for MANUAL/UPLOAD/API to be
// added later without a migration). MANUAL is added here, mock-only, ahead
// of that backend work so the Source column has both cases to render.
export interface EntitySourceEmail {
  type: 'EMAIL';
  provider: 'GMAIL';
  url: string;
  emailId: string;
  threadId: string;
}

export interface EntitySourceManual {
  type: 'MANUAL';
}

export type EntitySource = EntitySourceEmail | EntitySourceManual;

export interface EntityExtraction {
  status: ExtractionStatus;
  model: string | null;
  confidence: number | null;
  extractedAt: string | null;
}

export interface Entity {
  id: string;
  userId: string;
  type: EntityType;
  displayId: string;
  title: string;
  source: EntitySource;
  entityId: string;
  extraction: EntityExtraction;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------------

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';
export type TicketLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Ticket {
  id: string;
  userId: string;
  ticketNumber: string | null;
  title: string;
  summary: string | null;
  status: TicketStatus;
  urgency: TicketLevel | null;
  priority: TicketLevel | null;
  dueDate: string | null;
  assignee: Person | null;
  requester: Person | null;
  conversation: ConversationMessage[];
  parentTicketId: string | null;
  duplicateOfTicketId: string | null;
  sourceUrl: string;
  sourceType: SourceType;
  threadId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Resolved server-side (Ticket.parentTicket/duplicateOfTicket) — only
  // present when fetched via GET_ENTITY_DETAIL, not the list query.
  parentTicket?: Pick<Ticket, 'id' | 'title'> | null;
  duplicateOfTicket?: Pick<Ticket, 'id' | 'title'> | null;
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string | null;
  amount: Money;
  dueDate: string | null;
  issuer: Person | null;
  status: InvoiceStatus;
  conversation: ConversationMessage[];
  sourceUrl: string;
  sourceType: SourceType;
  threadId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Resolved server-side (Invoice.linkedPayments) — only present when
  // fetched via GET_ENTITY_DETAIL, not the list query.
  linkedPayments?: Pick<Payment, 'id' | 'amount' | 'paidAt' | 'linkMethod'>[];
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export type PaymentLinkMethod = 'THREAD_CONTEXT' | 'RECONCILED' | 'MANUAL';

export interface Payment {
  id: string;
  userId: string;
  amount: Money;
  paidAt: string;
  payer: Person | null;
  payee: Person | null;
  invoiceId: string | null;
  linkMethod: PaymentLinkMethod | null;
  sourceUrl: string;
  sourceType: SourceType;
  threadId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Resolved server-side (Payment.invoice) — only present when fetched via
  // GET_ENTITY_DETAIL, not the list query.
  invoice?: Pick<Invoice, 'id' | 'invoiceNumber' | 'amount' | 'status' | 'issuer'> | null;
}

// ---------------------------------------------------------------------------
// CalendarEvent (backend model name: Event)
// ---------------------------------------------------------------------------

export interface EventAttachmentRef {
  documentId: string;
  filename: string;
  // Resolved server-side (EventAttachmentRef.document) — only present when
  // fetched via GET_ENTITY_DETAIL.
  document?: Pick<KnowledgeDocument, 'id' | 'title'> | null;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  timezone: string | null;
  location: string | null;
  url: string | null;
  attendees: Person[];
  organizer: Person | null;
  attachments: EventAttachmentRef[];
  sourceUrl: string;
  sourceType: SourceType;
  threadId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// KnowledgeDocument (backend model name: Document)
// ---------------------------------------------------------------------------

export type KnowledgeDocumentType =
  | 'CONTRACT'
  | 'NDA'
  | 'TERMS_AND_CONDITIONS'
  | 'PRIVACY_POLICY'
  | 'COMPLIANCE'
  | 'CERTIFICATE'
  | 'LICENSE'
  | 'AGREEMENT'
  | 'POLICY'
  | 'OTHER';

export interface Party {
  name: string;
  role: string | null;
}

export interface KnowledgeDocument {
  id: string;
  userId: string;
  type: KnowledgeDocumentType;
  title: string;
  description: string | null;
  summary: string;
  documentNumber: string | null;
  issuer: Person | null;
  parties: Party[];
  effectiveDate: string | null;
  expiryDate: string | null;
  attachments: AttachmentRef[];
  sourceUrl: string;
  sourceType: SourceType;
  threadId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
