const mongoose = require('mongoose');
const PersonSchema = require('./schemas/PersonSchema');
const MoneySchema = require('./schemas/MoneySchema');
const ConversationMessageSchema = require('./schemas/ConversationMessageSchema');
const { CONVERSATION_DIRECTIONS, validateConversationMessage } = ConversationMessageSchema;

/**
 * Invoice represents a financial OBLIGATION/request for payment — distinct
 * from Payment, which represents money actually moving. See Payment.js and
 * decisions.md for the full Invoice-vs-Payment distinction.
 *
 * Unlike Event/Document, Invoice DOES carry a business `status` — it has a
 * genuine financial lifecycle (UNPAID → PAID/OVERDUE) that the other typed
 * entities don't. See decisions.md.
 */

const SOURCE_TYPES = ['EMAIL', 'DOCUMENT'];
// PARTIALLY_PAID exists because multiple Payments can link to one Invoice
// (see decisions.md) — an invoice with SOME but not all of its amount
// covered needs a status distinct from both UNPAID and PAID.
const INVOICE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

const InvoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Only populated when a number is actually present in the source —
    // never generated (same principle as Document.documentNumber).
    invoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    amount: {
      type: MoneySchema,
      required: true,
    },
    // Not every invoice email states one explicitly.
    dueDate: {
      type: Date,
      default: null,
    },
    issuer: {
      type: PersonSchema,
      default: null,
    },

    // The financial lifecycle. Defaults to UNPAID — an invoice, on first
    // extraction, represents an unpaid obligation unless the same source
    // already contains reliable evidence otherwise. Never set to PAID on
    // vague language ("we'll pay this soon") — only on an actual confirmed
    // Payment link (see reconciliation service / decisions.md).
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      required: true,
      default: 'UNPAID',
    },

    // Relevant messages from the same Gmail thread that provide context
    // for this Invoice (e.g. the reply that confirms payment) — a bounded,
    // curated list, not a full conversation sync. See decisions.md.
    conversation: {
      type: [ConversationMessageSchema],
      default: [],
    },

    // Application-generated navigation URL back to the original source.
    // Required only when sourceType is EMAIL — a manually-created invoice
    // has no durable original document to link back to. See
    // sourceUrlService.js's MANUAL case and decisions.md.
    sourceUrl: {
      type: String,
      default: null,
      trim: true,
      required: function () {
        return this.sourceType === 'EMAIL';
      },
    },
    sourceType: {
      type: String,
      enum: SOURCE_TYPES,
      required: true,
    },
    // Gmail's raw thread id — stored as a plain string (not an ObjectId
    // ref) specifically so incoming messages can be matched against it by
    // direct equality during reconciliation. See decisions.md.
    threadId: {
      type: String,
      default: null,
    },
    // No `default: null` — see Ticket.js's identical field for why: a
    // truly-omitted messageId (non-EMAIL source) must stay genuinely
    // absent, or the unique+sparse index below collides across every
    // non-EMAIL invoice for the same user. See decisions.md.
    messageId: {
      type: String,
      required: function () {
        return this.sourceType === 'EMAIL';
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: 'invoices' }
);

InvoiceSchema.index({ userId: 1 });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
// Reconciliation looks up "which Invoice(s) belong to this Gmail thread".
InvoiceSchema.index({ userId: 1, threadId: 1 });
InvoiceSchema.index({ 'metadata.transactionRef': 1 }, { sparse: true });
// One Invoice per source email at most — makes a retried/duplicated
// extraction (e.g. after a stale-PROCESSING reclaim) safe: the repository
// treats the resulting E11000 as "already created" rather than inserting a
// second Invoice for the same message.
//
// A partial index, not sparse: for a COMPOUND index, `sparse` only skips a
// document when EVERY indexed field is absent — since userId is always
// present, a merely-absent messageId (any non-EMAIL source, e.g. a manual
// "Create Knowledge" entry) would still be indexed as null, and every
// second such invoice for the same user would collide with the first
// (E11000). The partialFilterExpression instead indexes a document only
// when messageId is genuinely a string — exactly the EMAIL-only case this
// uniqueness constraint is meant to cover. See decisions.md.
InvoiceSchema.index(
  { userId: 1, messageId: 1 },
  { unique: true, partialFilterExpression: { messageId: { $type: 'string' } } }
);

/**
 * Validates and normalizes a raw LLM-extracted candidate into the Invoice
 * shape. Mirrors Event.js/Document.js's validateExtracted* convention:
 * never throws, returns `{ invoice: null, error }` on malformed input.
 * Standalone — NOT wired into the (generic, being-superseded) orchestrator.
 * See decisions.md.
 *
 * @param {object} raw
 * @returns {{ invoice: object|null, error: string|null }}
 */
function validateExtractedInvoice(raw) {
  if (!raw || typeof raw !== 'object') {
    return { invoice: null, error: 'Extracted invoice must be an object' };
  }

  const amountValue = raw.amount && typeof raw.amount === 'object' ? raw.amount.value : undefined;
  if (typeof amountValue !== 'number' || Number.isNaN(amountValue)) {
    return { invoice: null, error: 'Extracted invoice is missing a required numeric "amount.value"' };
  }

  if (!SOURCE_TYPES.includes(raw.sourceType)) {
    return { invoice: null, error: `Extracted invoice has an invalid "sourceType": ${raw.sourceType}` };
  }

  // Required only for EMAIL — a manual entry has no durable original
  // document to link back to (see sourceUrlService.js's MANUAL case).
  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (raw.sourceType === 'EMAIL' && !sourceUrl) {
    return { invoice: null, error: 'Extracted invoice with sourceType EMAIL is missing a required "sourceUrl"' };
  }

  if (raw.sourceType === 'EMAIL' && !raw.messageId) {
    return { invoice: null, error: 'Extracted invoice with sourceType EMAIL is missing a required "messageId"' };
  }

  const status = INVOICE_STATUSES.includes(raw.status) ? raw.status : 'UNPAID';

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

  const conversation = Array.isArray(raw.conversation)
    ? raw.conversation.reduce((acc, entry) => {
        const { message, error: entryError } = validateConversationMessage(entry);
        if (entryError) {
          console.warn(`[Invoice] Dropping invalid conversation entry: ${entryError}`);
          return acc;
        }
        acc.push(message);
        return acc;
      }, [])
    : [];

  return {
    invoice: {
      invoiceNumber: typeof raw.invoiceNumber === 'string' ? raw.invoiceNumber : null,
      amount: {
        value: amountValue,
        currency: typeof raw.amount.currency === 'string' ? raw.amount.currency : null,
      },
      dueDate: parseDate(raw.dueDate),
      issuer: normalizePerson(raw.issuer),
      status,
      conversation,
      sourceUrl: sourceUrl || null,
      sourceType: raw.sourceType,
      threadId: typeof raw.threadId === 'string' ? raw.threadId : null,
      messageId: typeof raw.messageId === 'string' ? raw.messageId : undefined,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    },
    error: null,
  };
}

/**
 * Computes what Invoice.status SHOULD be, given the invoice's amount/due
 * date and the Payments currently linked to it. Deliberately NOT stored as
 * a running `amountPaid` field on Invoice — the linked Payments are the
 * single source of truth for how much has been paid; this function derives
 * status from them on demand, the same "derive, don't duplicate" principle
 * applied to not storing a payments[] array on Invoice. See decisions.md.
 *
 * Payments in a different currency than the invoice are excluded from the
 * paid total (logged, not silently summed as if equal) — never conflate
 * amounts across currencies.
 *
 * Precedence when multiple conditions are true (e.g. partially paid AND
 * past due): PAID > PARTIALLY_PAID > OVERDUE > UNPAID — see decisions.md
 * for why partial payment is treated as more informative than "overdue"
 * once ANY money has moved. This is a judgment call, not a spec
 * requirement — flag if you want OVERDUE to win instead.
 *
 * @param {object} params
 * @param {{value:number, currency?:string}} params.invoiceAmount
 * @param {Date|null} params.dueDate
 * @param {Array<{amount:{value:number,currency?:string}}>} params.linkedPayments
 * @returns {string} one of INVOICE_STATUSES
 */
function determineInvoiceStatus({ invoiceAmount, dueDate, linkedPayments }) {
  const payments = Array.isArray(linkedPayments) ? linkedPayments : [];

  let totalPaid = 0;
  for (const payment of payments) {
    const value = payment?.amount?.value;
    if (typeof value !== 'number' || Number.isNaN(value)) continue;

    const paymentCurrency = payment.amount.currency;
    const invoiceCurrency = invoiceAmount?.currency;
    if (paymentCurrency && invoiceCurrency && paymentCurrency !== invoiceCurrency) {
      console.warn(
        `[Invoice] Excluding payment with mismatched currency (${paymentCurrency} vs invoice's ${invoiceCurrency}) from paid total.`
      );
      continue;
    }

    totalPaid += value;
  }

  const invoiceValue = typeof invoiceAmount?.value === 'number' ? invoiceAmount.value : null;

  if (invoiceValue != null && totalPaid >= invoiceValue && totalPaid > 0) {
    return 'PAID';
  }
  if (totalPaid > 0) {
    return 'PARTIALLY_PAID';
  }
  if (dueDate && new Date() > new Date(dueDate)) {
    return 'OVERDUE';
  }
  return 'UNPAID';
}

module.exports = mongoose.model('Invoice', InvoiceSchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.INVOICE_STATUSES = INVOICE_STATUSES;
module.exports.CONVERSATION_DIRECTIONS = CONVERSATION_DIRECTIONS;
module.exports.validateExtractedInvoice = validateExtractedInvoice;
module.exports.validateConversationMessage = validateConversationMessage;
module.exports.determineInvoiceStatus = determineInvoiceStatus;
