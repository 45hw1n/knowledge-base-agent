const mongoose = require('mongoose');

/**
 * Event is a first-class typed entity — a calendar/scheduling event
 * extracted from an email and/or its attachments. It is NOT an audit/history
 * record (no "created"/"updated" lifecycle events here) and does NOT carry
 * a business `status` — unlike Ticket/Invoice, a scheduling event has no
 * comparable lifecycle concept.
 *
 * Referenced from Entity via `entityId` (Entity.type === 'EVENT') — Event
 * itself does not store any back-reference to Entity/entityType; that
 * association is owned entirely by Entity. See decisions.md.
 */

const SOURCE_TYPES = ['EMAIL', 'DOCUMENT'];

// A participant reference — deliberately permissive: either field alone is
// enough (e.g. an invite that only lists a name, or only an email address).
const PersonSchema = new mongoose.Schema(
  {
    name: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
  },
  { _id: false }
);

// A reference to a separately-extracted Document entity — NOT the
// attachment's contents. Document ownership of storage/processing/metadata
// lives entirely on the (not yet implemented) Document entity; Event only
// points at it.
const AttachmentRefSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true },
    filename: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const EventSchema = new mongoose.Schema(
  {
    // Not part of the illustrative public-facing shape in the spec (which
    // omits it — a client already knows who it's asking as), but required
    // for tenant isolation, matching every other model in this app
    // (User/Entity/EmailThread/etc). See decisions.md.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },

    startTime: {
      type: Date,
      required: true,
    },
    // Not invented when unavailable — left null rather than defaulted to
    // e.g. startTime + 1 hour.
    endTime: {
      type: Date,
      default: null,
    },
    // Preserves the source's stated timezone (e.g. "Asia/Kolkata") for
    // display context. Never guessed when not explicitly present in the
    // source — startTime/endTime are stored as absolute instants regardless.
    timezone: {
      type: String,
      default: null,
      trim: true,
    },

    location: {
      type: String,
      default: null,
      trim: true,
    },
    // The event's own URL (Google Meet / Zoom / Teams / registration page) —
    // distinct from sourceUrl (where the Event was extracted FROM). Named
    // generically because it is not necessarily a "meeting" URL. See
    // decisions.md for the url vs sourceUrl distinction.
    url: {
      type: String,
      default: null,
      trim: true,
    },

    attendees: {
      type: [PersonSchema],
      default: [],
    },
    // Not assumed to be the email sender — only populated when the source
    // gives actual evidence of who organized it (an extraction-quality
    // concern for the AI layer, not something this schema enforces).
    organizer: {
      type: PersonSchema,
      default: null,
    },

    attachments: {
      type: [AttachmentRefSchema],
      default: [],
    },

    // Application-generated navigation URL back to the original source
    // (e.g. the Gmail message) — same provenance principle as Entity.source.url.
    // Required: an Event must always be traceable to where it came from.
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

    // Flexible bucket for event-specific extras that don't warrant a core
    // field (e.g. a recurrence rule seen in one unusual email). Deliberately
    // NOT a place to smuggle in fields that should be promoted to the core
    // schema instead.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: 'events' }
);

EventSchema.index({ userId: 1 });
EventSchema.index({ userId: 1, startTime: 1 });

/**
 * Validates and normalizes a raw LLM-extracted candidate into the Event
 * shape. Mirrors the existing extraction post-processing convention (see
 * ai/features/extractEntities/postProcessor.js): never throws, returns
 * `{ event: null, error }` on malformed input rather than persisting a
 * partial/invalid document. Pure and standalone — NOT wired into the
 * (generic, being-superseded) orchestrator yet. See decisions.md.
 *
 * @param {object} raw
 * @returns {{ event: object|null, error: string|null }}
 */
function validateExtractedEvent(raw) {
  if (!raw || typeof raw !== 'object') {
    return { event: null, error: 'Extracted event must be an object' };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    return { event: null, error: 'Extracted event is missing a required "title"' };
  }

  const startTime = raw.startTime ? new Date(raw.startTime) : null;
  if (!startTime || Number.isNaN(startTime.getTime())) {
    return { event: null, error: 'Extracted event is missing a valid required "startTime"' };
  }

  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (!sourceUrl) {
    return { event: null, error: 'Extracted event is missing a required "sourceUrl"' };
  }

  if (!SOURCE_TYPES.includes(raw.sourceType)) {
    return { event: null, error: `Extracted event has an invalid "sourceType": ${raw.sourceType}` };
  }

  let endTime = null;
  if (raw.endTime) {
    const parsed = new Date(raw.endTime);
    if (!Number.isNaN(parsed.getTime())) endTime = parsed;
  }

  const normalizePerson = (person) => {
    if (!person || typeof person !== 'object') return null;
    const name = typeof person.name === 'string' ? person.name.trim() : null;
    const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : null;
    if (!name && !email) return null;
    return { name: name || null, email: email || null };
  };

  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees.map(normalizePerson).filter(Boolean)
    : [];

  const organizer = normalizePerson(raw.organizer);

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .filter((a) => a && typeof a.documentId === 'string' && typeof a.filename === 'string')
        .map((a) => ({ documentId: a.documentId, filename: a.filename }))
    : [];

  return {
    event: {
      title,
      description: typeof raw.description === 'string' ? raw.description : null,
      startTime,
      endTime,
      timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
      location: typeof raw.location === 'string' ? raw.location : null,
      url: typeof raw.url === 'string' ? raw.url : null,
      attendees,
      organizer,
      attachments,
      sourceUrl,
      sourceType: raw.sourceType,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    },
    error: null,
  };
}

module.exports = mongoose.model('Event', EventSchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.validateExtractedEvent = validateExtractedEvent;
