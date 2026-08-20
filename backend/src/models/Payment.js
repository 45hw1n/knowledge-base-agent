const mongoose = require('mongoose');
const PersonSchema = require('./schemas/PersonSchema');
const MoneySchema = require('./schemas/MoneySchema');

/**
 * Payment represents the actual MOVEMENT/settlement of money — distinct
 * from Invoice, which represents an obligation/request for payment. A
 * Payment can optionally reference the Invoice it settles (`invoiceId`),
 * but this link is never assumed — see reconciliation notes in
 * paymentReconciliationService.js and decisions.md.
 *
 * No business `status` field: unlike Invoice, there's no described
 * lifecycle for a Payment itself in this phase's scope — a Payment either
 * was extracted (it exists) or wasn't. The "did payment succeed" signal
 * lives on Invoice.status, not here.
 */

const SOURCE_TYPES = ['EMAIL', 'DOCUMENT'];

// How an invoiceId link was established — used to decide whether unlinking
// needs a confirmation step. THREAD_CONTEXT (the payment's source message
// is literally part of the invoice's own conversation) is treated as
// higher-confidence than RECONCILED (matched via amount/payee/etc across a
// different thread — e.g. a bank email), but neither is ever made
// permanently un-reversible — see decisions.md for why a hard "cannot
// unlink" rule was deliberately rejected in favor of a soft confirmation.
const LINK_METHODS = ['THREAD_CONTEXT', 'RECONCILED', 'MANUAL'];

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: MoneySchema,
      required: true,
    },
    // When the money actually moved — required: a Payment represents a
    // settlement that already happened, so this should always be
    // extractable (falling back to the source email's received date when
    // no more precise date is stated is an extraction-layer concern, not a
    // schema one — see decisions.md).
    paidAt: {
      type: Date,
      required: true,
    },

    // Not always identifiable with confidence (e.g. a bank notification
    // about "your account" without naming the account holder) — optional.
    payer: {
      type: PersonSchema,
      default: null,
    },
    payee: {
      type: PersonSchema,
      default: null,
    },

    // Optional by design — a payment may arrive without enough evidence to
    // identify the related invoice. Only ever set through the
    // reconciliation service's confidence-gated matching, never guessed
    // from amount alone. See decisions.md.
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    // Required exactly when invoiceId is set — a linkMethod with no link,
    // or a link with no recorded method, are both inconsistent states.
    linkMethod: {
      type: String,
      enum: LINK_METHODS,
      default: null,
      required: function () {
        return this.invoiceId != null;
      },
      validate: {
        validator: function (value) {
          return !(this.invoiceId == null && value != null);
        },
        message: 'linkMethod must not be set when invoiceId is not set',
      },
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
    // Same plain-string-for-direct-matching rationale as Invoice.threadId.
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
  { timestamps: true, collection: 'payments' }
);

PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ userId: 1, invoiceId: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ userId: 1, threadId: 1 });
PaymentSchema.index({ 'metadata.transactionRef': 1 }, { sparse: true });
// Same retry-safety reasoning as Invoice's messageId index — see there.
PaymentSchema.index({ userId: 1, messageId: 1 }, { unique: true, sparse: true });

/**
 * Validates and normalizes a raw LLM-extracted candidate into the Payment
 * shape. Mirrors Invoice.js/Event.js/Document.js's validateExtracted*
 * convention: never throws, returns `{ payment: null, error }` on malformed
 * input. `invoiceId` is intentionally NOT set here — linking a Payment to
 * an Invoice is exclusively the reconciliation service's job, gated on
 * sufficient evidence, never a blind pass-through of whatever the LLM
 * guessed. Standalone — NOT wired into the (generic, being-superseded)
 * orchestrator. See decisions.md.
 *
 * @param {object} raw
 * @returns {{ payment: object|null, error: string|null }}
 */
function validateExtractedPayment(raw) {
  if (!raw || typeof raw !== 'object') {
    return { payment: null, error: 'Extracted payment must be an object' };
  }

  const amountValue = raw.amount && typeof raw.amount === 'object' ? raw.amount.value : undefined;
  if (typeof amountValue !== 'number' || Number.isNaN(amountValue)) {
    return { payment: null, error: 'Extracted payment is missing a required numeric "amount.value"' };
  }

  const paidAt = raw.paidAt ? new Date(raw.paidAt) : null;
  if (!paidAt || Number.isNaN(paidAt.getTime())) {
    return { payment: null, error: 'Extracted payment is missing a valid required "paidAt"' };
  }

  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (!sourceUrl) {
    return { payment: null, error: 'Extracted payment is missing a required "sourceUrl"' };
  }

  if (!SOURCE_TYPES.includes(raw.sourceType)) {
    return { payment: null, error: `Extracted payment has an invalid "sourceType": ${raw.sourceType}` };
  }

  if (raw.sourceType === 'EMAIL' && !raw.messageId) {
    return { payment: null, error: 'Extracted payment with sourceType EMAIL is missing a required "messageId"' };
  }

  const normalizePerson = (person) => {
    if (!person || typeof person !== 'object') return null;
    const name = typeof person.name === 'string' ? person.name.trim() : null;
    const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : null;
    if (!name && !email) return null;
    return { name: name || null, email: email || null };
  };

  return {
    payment: {
      amount: {
        value: amountValue,
        currency: typeof raw.amount.currency === 'string' ? raw.amount.currency : null,
      },
      paidAt,
      payer: normalizePerson(raw.payer),
      payee: normalizePerson(raw.payee),
      invoiceId: null,
      sourceUrl,
      sourceType: raw.sourceType,
      threadId: typeof raw.threadId === 'string' ? raw.threadId : null,
      messageId: typeof raw.messageId === 'string' ? raw.messageId : null,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    },
    error: null,
  };
}

/**
 * Whether unlinking this payment from its invoice should require an
 * explicit "are you sure?" confirmation before proceeding — true only for
 * THREAD_CONTEXT links (the payment came from inside the invoice's own
 * conversation, the highest-confidence link method). Deliberately not a
 * hard block: even strong-looking evidence can occasionally be wrong, and
 * removing the ability to correct a mistake was rejected — see
 * decisions.md.
 *
 * @param {{ linkMethod?: string|null }} payment
 * @returns {boolean}
 */
function requiresUnlinkConfirmation(payment) {
  return payment?.linkMethod === 'THREAD_CONTEXT';
}

module.exports = mongoose.model('Payment', PaymentSchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.LINK_METHODS = LINK_METHODS;
module.exports.validateExtractedPayment = validateExtractedPayment;
module.exports.requiresUnlinkConfirmation = requiresUnlinkConfirmation;
