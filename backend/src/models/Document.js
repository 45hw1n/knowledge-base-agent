const mongoose = require('mongoose');
const PersonSchema = require('./schemas/PersonSchema');
const AttachmentRefSchema = require('./schemas/AttachmentRefSchema');

/**
 * Document is a first-class typed entity — the structured BUSINESS meaning
 * of a contract/NDA/policy/compliance/certificate/etc, not the physical
 * file it was extracted from. The physical file (e.g. "Acme_NDA_2026.pdf")
 * is a source artifact, referenced through `attachments`, never embedded.
 *
 * Like Event, it carries no business `status` and no back-reference to
 * `Entity` (`entityType`/`entityId`) — that association is owned entirely
 * by `Entity` (`Entity.type === 'DOCUMENT'`, `Entity.entityId = document._id`).
 * See decisions.md.
 */

const DOCUMENT_TYPES = [
  'CONTRACT',
  'NDA',
  'TERMS_AND_CONDITIONS',
  'PRIVACY_POLICY',
  'COMPLIANCE',
  'CERTIFICATE',
  'LICENSE',
  'AGREEMENT',
  'POLICY',
  'OTHER',
];

const SOURCE_TYPES = ['EMAIL', 'DOCUMENT'];

// The AI-generation target for `summary` — a prompt-engineering instruction
// for the (not-yet-built) Document-specific extraction prompt, not a hard
// schema constraint. See decisions.md for why this isn't enforced as a
// rejection rule: a genuinely short source document producing a shorter,
// accurate summary should never be forced to pad itself to hit a word count.
const SUMMARY_WORD_TARGET = { min: 300, max: 500 };

// `role` is intentionally a free-form string, not an enum — unlike `type`/
// `sourceType`. The spec lists a suggested vocabulary (CUSTOMER, VENDOR,
// PARTNER, ISSUER, RECIPIENT, LICENSOR, LICENSEE, OTHER) but explicitly asks
// for it to "remain flexible" across very different document types, and to
// never force a role the source doesn't clearly support. See decisions.md.
const PartySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      enum: DOCUMENT_TYPES,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    // Substantially shorter than `summary` — a one-line description, not
    // the AI-generated deep-dive.
    description: {
      type: String,
      default: null,
    },
    // The AI-generated deep summary (target 300-500 words — see
    // SUMMARY_WORD_TARGET). Required: this is the whole point of extracting
    // a Document — letting the user understand it without reading the source.
    summary: {
      type: String,
      required: true,
    },

    documentNumber: {
      type: String,
      default: null,
      trim: true,
    },

    issuer: {
      type: PersonSchema,
      default: null,
    },
    parties: {
      type: [PartySchema],
      default: [],
    },

    // Never inferred — only populated when explicitly present in the source.
    effectiveDate: {
      type: Date,
      default: null,
    },
    // Not every document type has one (e.g. many Terms & Conditions don't).
    expiryDate: {
      type: Date,
      default: null,
    },

    attachments: {
      type: [AttachmentRefSchema],
      default: [],
    },

    // Application-generated navigation URL back to the original source
    // (e.g. the Gmail message) — same provenance principle as Entity.source.url
    // and Event.sourceUrl. Required only when sourceType is EMAIL — a
    // manually-created document has no durable original document to link
    // back to. See sourceUrlService.js's MANUAL case and decisions.md.
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
    // Gmail's raw thread id — see Event.js for the same field and the
    // rationale (plain string, not an ObjectId ref, for direct equality
    // matching during reconciliation). Optional.
    threadId: {
      type: String,
      default: null,
    },
    // Required whenever sourceType is EMAIL — see Event.js. No
    // `default: null` — a truly-omitted messageId (non-EMAIL source) must
    // stay genuinely absent, or the unique+sparse index below collides
    // across every non-EMAIL document for the same user. See decisions.md.
    messageId: {
      type: String,
      required: function () {
        return this.sourceType === 'EMAIL';
      },
    },

    // Flexible bucket for document-specific extras that don't warrant a
    // core field. Not a place to smuggle in fields that should be
    // promoted to the core schema instead.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: 'documents' }
);

DocumentSchema.index({ userId: 1 });
DocumentSchema.index({ userId: 1, type: 1 });
DocumentSchema.index({ userId: 1, createdAt: -1 });
// Same retry-safety reasoning as Invoice's messageId index — see there. A
// partial index, not sparse — see Invoice.js/Ticket.js for why a compound
// sparse index doesn't actually skip non-EMAIL (messageId-absent) records.
DocumentSchema.index(
  { userId: 1, messageId: 1 },
  { unique: true, partialFilterExpression: { messageId: { $type: 'string' } } }
);

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validates and normalizes a raw LLM-extracted candidate into the Document
 * shape. Mirrors the existing extraction post-processing convention (see
 * ai/features/extractEntities/postProcessor.js, and Event.js's
 * validateExtractedEvent): never throws, returns `{ document: null, error }`
 * on malformed input. A summary far outside the 300-500 word target is
 * logged as a warning, NOT rejected — see SUMMARY_WORD_TARGET above for why
 * this isn't a hard constraint.
 *
 * Standalone and pure — NOT wired into the (generic, being-superseded)
 * orchestrator yet. See decisions.md.
 *
 * @param {object} raw
 * @returns {{ document: object|null, error: string|null }}
 */
function validateExtractedDocument(raw) {
  if (!raw || typeof raw !== 'object') {
    return { document: null, error: 'Extracted document must be an object' };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    return { document: null, error: 'Extracted document is missing a required "title"' };
  }

  if (!DOCUMENT_TYPES.includes(raw.type)) {
    return { document: null, error: `Extracted document has an invalid "type": ${raw.type}` };
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!summary) {
    return { document: null, error: 'Extracted document is missing a required "summary"' };
  }

  if (!SOURCE_TYPES.includes(raw.sourceType)) {
    return { document: null, error: `Extracted document has an invalid "sourceType": ${raw.sourceType}` };
  }

  // Required only for EMAIL — a manual entry has no durable original
  // document to link back to (see sourceUrlService.js's MANUAL case).
  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (raw.sourceType === 'EMAIL' && !sourceUrl) {
    return { document: null, error: 'Extracted document with sourceType EMAIL is missing a required "sourceUrl"' };
  }

  if (raw.sourceType === 'EMAIL' && !raw.messageId) {
    return { document: null, error: 'Extracted document with sourceType EMAIL is missing a required "messageId"' };
  }

  const wordCount = countWords(summary);
  if (wordCount < SUMMARY_WORD_TARGET.min * 0.3 || wordCount > SUMMARY_WORD_TARGET.max * 2) {
    console.warn(
      `[Document] Extracted summary is ${wordCount} words, well outside the ${SUMMARY_WORD_TARGET.min}-${SUMMARY_WORD_TARGET.max} target — accepting anyway (never reject for length alone).`
    );
  }

  const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeIssuer = (issuer) => {
    if (!issuer || typeof issuer !== 'object') return null;
    const name = typeof issuer.name === 'string' ? issuer.name.trim() : null;
    const email = typeof issuer.email === 'string' ? issuer.email.trim().toLowerCase() : null;
    if (!name && !email) return null;
    return { name: name || null, email: email || null };
  };

  const parties = Array.isArray(raw.parties)
    ? raw.parties
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          role: typeof p.role === 'string' && p.role.trim() ? p.role.trim() : null,
        }))
    : [];

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .filter((a) => a && typeof a.attachmentId === 'string' && typeof a.fileName === 'string')
        .map((a) => ({
          attachmentId: a.attachmentId,
          fileName: a.fileName,
          // Optional — preserved when the caller has them (e.g. the manual
          // "Create Knowledge" flow always does) so a consumer can pick the
          // right icon/preview without a second round-trip. Schema default
          // is null, so omitting them stays valid for existing callers.
          mimeType: typeof a.mimeType === 'string' ? a.mimeType : null,
          size: typeof a.size === 'number' ? a.size : null,
        }))
    : [];

  return {
    document: {
      type: raw.type,
      title,
      description: typeof raw.description === 'string' ? raw.description : null,
      summary,
      documentNumber: typeof raw.documentNumber === 'string' ? raw.documentNumber : null,
      issuer: normalizeIssuer(raw.issuer),
      parties,
      effectiveDate: parseDate(raw.effectiveDate),
      expiryDate: parseDate(raw.expiryDate),
      attachments,
      sourceUrl: sourceUrl || null,
      sourceType: raw.sourceType,
      threadId: typeof raw.threadId === 'string' ? raw.threadId : null,
      messageId: typeof raw.messageId === 'string' ? raw.messageId : undefined,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    },
    error: null,
  };
}

module.exports = mongoose.model('Document', DocumentSchema);
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.SUMMARY_WORD_TARGET = SUMMARY_WORD_TARGET;
module.exports.validateExtractedDocument = validateExtractedDocument;
