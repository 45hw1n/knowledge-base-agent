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
  },
  { _id: false }
);

module.exports = AttachmentRefSchema;
