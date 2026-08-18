const mongoose = require('mongoose');

/**
 * Reusable {name?, email?} sub-schema — a person or organization reference
 * where either field alone is sufficient (e.g. an invite that only lists a
 * name, or only an email address). Shared across Event (issuer, organizer,
 * attendees), Document (issuer), Invoice (issuer), and Payment (payer,
 * payee). Do NOT create per-entity copies of this schema — see
 * models/schemas/AttachmentSchema.js for the existing precedent of this
 * pattern in this codebase.
 */
const PersonSchema = new mongoose.Schema(
  {
    name: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
  },
  { _id: false }
);

module.exports = PersonSchema;
