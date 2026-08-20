const mongoose = require('mongoose');
const PersonSchema = require('./schemas/PersonSchema');
const ConversationMessageSchema = require('./schemas/ConversationMessageSchema');

/**
 * Ticket represents a support request/problem report — the entity the
 * intent-based classifier's TICKET rules feed into. Like Invoice, it
 * carries a real business `status` (unlike Event/Document), because a
 * support request has a genuine lifecycle.
 */

const SOURCE_TYPES = ['EMAIL', 'DOCUMENT'];
const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];
// Shared value set for both urgency and priority — kept as two distinct
// fields (not merged) because they answer different questions: urgency is
// how time-sensitive the issue is from the reporter's side; priority is
// the business's assigned importance, which can differ (e.g. a VIP
// customer's low-urgency request can still be high-priority). Both are
// optional and never guessed when the source gives no signal.
const TICKET_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const TicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Only populated when an actual reference number is present in the
    // source (e.g. "Ticket #12345") — never generated. The classifier
    // already detects this signal (ticket_number_pattern); this is where
    // it gets to land once extraction runs.
    ticketNumber: {
      type: String,
      default: null,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    // AI-generated, nullable — unlike Document.summary (required), a
    // ticket may not have enough content yet to summarize meaningfully.
    summary: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: TICKET_STATUSES,
      required: true,
      default: 'OPEN',
    },
    urgency: {
      type: String,
      enum: TICKET_LEVELS,
      default: null,
    },
    priority: {
      type: String,
      enum: TICKET_LEVELS,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // Selectable by a human user (this is a mock system — no real
    // staff/user directory integration) — NEVER set by AI extraction. See
    // decisions.md; same principle as Payment.invoiceId never being a
    // pass-through of the AI's guess.
    assignee: {
      type: PersonSchema,
      default: null,
    },
    // Who reported the issue — CAN be populated from extraction (usually
    // inferable from the sender), but not assumed automatically; only set
    // when the source gives actual evidence, same caution as
    // Event.organizer/Document.issuer.
    requester: {
      type: PersonSchema,
      default: null,
    },

    // Relevant messages preserved for context (e.g. the reply that
    // resolved the issue) — same shape and reasoning as Invoice.conversation.
    conversation: {
      type: [ConversationMessageSchema],
      default: [],
    },

    // Structural relationships to other Tickets. Stored on the "pointing"
    // side only (same reasoning as Payment.invoiceId / not storing a
    // payments[] array on Invoice) — to list a ticket's children or
    // duplicates, query Ticket.find({ parentTicketId }) /
    // Ticket.find({ duplicateOfTicketId }). NEVER set by extraction —
    // detecting "is this a duplicate of an existing ticket" needs
    // evidence-based matching (the same kind of deliberate, not-yet-built
    // reconciliation step as Payment↔Invoice linking), not a blind AI
    // guess. See decisions.md.
    parentTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    duplicateOfTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },

    // Application-generated navigation URL back to the original source.
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: SOURCE_TYPES,
      required: true,
    },
    // Same plain-string-for-direct-matching rationale as Invoice/Payment.
    threadId: {
      type: String,
      default: null,
    },
    messageId: {
      type: String,
      default: null,
      required: function () {
        return this.sourceType === 'EMAIL';
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: 'tickets' }
);
// `createdOn`, from the original field list, is just Mongoose's automatic
// `createdAt` (from `timestamps: true` above) — deliberately not a second,
// separate field for the same concept. See decisions.md.

TicketSchema.index({ userId: 1 });
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ userId: 1, createdAt: -1 });
TicketSchema.index({ userId: 1, threadId: 1 });
// Same retry-safety reasoning as Invoice's messageId index — see there.
TicketSchema.index({ userId: 1, messageId: 1 }, { unique: true, sparse: true });
TicketSchema.index({ parentTicketId: 1 }, { sparse: true });
TicketSchema.index({ duplicateOfTicketId: 1 }, { sparse: true });

/**
 * Validates and normalizes a raw LLM-extracted candidate into the Ticket
 * shape. Mirrors Invoice.js/Payment.js's validateExtracted* convention:
 * never throws, returns `{ ticket: null, error }` on malformed input.
 * `assignee`, `parentTicketId`, and `duplicateOfTicketId` are always
 * forced to null here — none of the three are ever a pass-through of
 * whatever the AI guessed (assignee is a human/manual decision;
 * parent/duplicate links need evidence-based matching, not built yet).
 * Standalone — NOT wired into the (generic, being-superseded) orchestrator.
 * See decisions.md.
 *
 * @param {object} raw
 * @returns {{ ticket: object|null, error: string|null }}
 */
function validateExtractedTicket(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ticket: null, error: 'Extracted ticket must be an object' };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    return { ticket: null, error: 'Extracted ticket is missing a required "title"' };
  }

  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (!sourceUrl) {
    return { ticket: null, error: 'Extracted ticket is missing a required "sourceUrl"' };
  }

  if (!SOURCE_TYPES.includes(raw.sourceType)) {
    return { ticket: null, error: `Extracted ticket has an invalid "sourceType": ${raw.sourceType}` };
  }

  if (raw.sourceType === 'EMAIL' && !raw.messageId) {
    return { ticket: null, error: 'Extracted ticket with sourceType EMAIL is missing a required "messageId"' };
  }

  const status = TICKET_STATUSES.includes(raw.status) ? raw.status : 'OPEN';
  const urgency = TICKET_LEVELS.includes(raw.urgency) ? raw.urgency : null;
  const priority = TICKET_LEVELS.includes(raw.priority) ? raw.priority : null;

  const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizePerson = (person) => {
    if (!person || typeof person !== 'object') return null;
    const name = typeof person.name === 'string' ? person.name.trim() : null;
    const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : null;
    if (!name && !email) return null;
    return { name: name || null, email: email || null };
  };

  return {
    ticket: {
      ticketNumber: typeof raw.ticketNumber === 'string' ? raw.ticketNumber : null,
      title,
      summary: typeof raw.summary === 'string' ? raw.summary : null,
      status,
      urgency,
      priority,
      dueDate: parseDate(raw.dueDate),
      assignee: null,
      requester: normalizePerson(raw.requester),
      conversation: [],
      parentTicketId: null,
      duplicateOfTicketId: null,
      sourceUrl,
      sourceType: raw.sourceType,
      threadId: typeof raw.threadId === 'string' ? raw.threadId : null,
      messageId: typeof raw.messageId === 'string' ? raw.messageId : null,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    },
    error: null,
  };
}

module.exports = mongoose.model('Ticket', TicketSchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.TICKET_STATUSES = TICKET_STATUSES;
module.exports.TICKET_LEVELS = TICKET_LEVELS;
module.exports.validateExtractedTicket = validateExtractedTicket;
