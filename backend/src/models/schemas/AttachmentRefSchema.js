const mongoose = require('mongoose');

/**
 * Reusable reference to a PHYSICAL attachment (a raw file that came with a
 * source email) — reuses this project's existing "attachmentId"/"fileName"
 * naming convention (see services/attachments/attachmentService.js,
 * models/schemas/AttachmentSchema.js) rather than introducing fileId/filename.
 *
 * Deliberately not a Mongoose `ref`: there is no single working
 * "Attachment" collection today (the entity-handler registry backing it is
 * currently all NOT_IMPLEMENTED stubs) — resolving this reference is an
 * application concern, same pattern as Entity.entityId.
 *
 * NOTE: this is a different concept from Event.attachments[].documentId,
 * which references a business Document ENTITY, not a physical file. Do not
 * merge the two — see decisions.md.
 */
const AttachmentRefSchema = new mongoose.Schema(
  {
    attachmentId: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    // Optional — already captured at ingestion time
    // (syncEmailsService.js#extractAttachmentRefs) but previously dropped
    // wherever a raw attachment ref was mapped down to this shape. Lets a
    // consumer (e.g. a conversation attachment badge) pick the right
    // icon/preview and set a correct Content-Type on download without a
    // second round-trip. Nullable so existing records stay valid.
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
  },
  { _id: false }
);

module.exports = AttachmentRefSchema;
