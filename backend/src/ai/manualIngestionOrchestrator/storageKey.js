/**
 * Storage key scheme for files uploaded through the manual "Create
 * Knowledge" flow. Deliberately NOT `attachmentOwnership.js`'s
 * `buildStorageKey`/`AttachmentOwnerType` — that scheme is scoped to an
 * already-existing owner entity (REVIEW/TRANSACTION today), and at upload
 * time here there is no entity yet (it's created only once AI processing
 * completes). Scoped under the `ManualIngestionItem`'s own id instead,
 * which exists from the moment the mutation creates it.
 */
function buildManualIngestionStorageKey({ userId, creationId, attachmentId, extension }) {
  if (!userId || !creationId || !attachmentId || !extension) {
    throw new Error('userId, creationId, attachmentId and extension are required');
  }
  return `users/${userId}/manual-ingestion/${creationId}/${attachmentId}.${extension}`;
}

module.exports = { buildManualIngestionStorageKey };
