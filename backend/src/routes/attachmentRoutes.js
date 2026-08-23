const express = require('express');
const router = express.Router();

const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const Document = require('../models/Document');
const gmailService = require('../services/gmailService');
const storageService = require('../services/storage/storageService');

/**
 * Live proxy for a conversation-message attachment's bytes — never stored
 * anywhere by Cortex (no R2/S3/disk copy). Gmail exposes no public URL for
 * an attachment; the only way to get it is the authenticated
 * `messages.attachments.get` API call, so this route makes that call on
 * demand, on every request, using the requesting user's own OAuth token.
 *
 * Ownership check is against the durable typed-child record's
 * conversation[] (Invoice/Ticket), not the TTL'd EmailToProcess record —
 * conversation attachment metadata was copied onto the typed child at
 * creation time specifically so it survives EmailToProcess's 30-day expiry
 * (see decisions.md's Entity "durable source of truth" precedent).
 */
async function findOwnedAttachmentMeta({ userId, messageId, attachmentId }) {
  for (const Model of [Invoice, Ticket]) {
    const doc = await Model.findOne(
      { userId, messageId, 'conversation.attachments.attachmentId': attachmentId },
      { conversation: 1 }
    ).lean();
    if (!doc) continue;

    for (const entry of doc.conversation || []) {
      const match = (entry.attachments || []).find((a) => a.attachmentId === attachmentId);
      if (match) return match;
    }
  }
  return null;
}

router.get('/gmail/:messageId/:attachmentId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { messageId, attachmentId } = req.params;

  try {
    const attachmentMeta = await findOwnedAttachmentMeta({ userId: req.user._id, messageId, attachmentId });
    if (!attachmentMeta) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const buffer = await gmailService.fetchAttachment(req.user._id.toString(), messageId, attachmentId);

    res.setHeader('Content-Type', attachmentMeta.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachmentMeta.fileName || 'attachment')}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error(
      `[attachmentRoutes] Failed to fetch attachment messageId=${messageId} attachmentId=${attachmentId}:`,
      error.message
    );
    return res.status(502).json({ error: 'Failed to fetch attachment from Gmail' });
  }
});

/**
 * Ownership check for a manually-uploaded (R2-stored) attachment — its
 * `attachmentId` is actually the R2 storage key (see
 * manualIngestionOrchestrator/storageKey.js), never a Gmail attachmentId.
 * Searches everywhere a manual attachment ref can actually live: Ticket/
 * Invoice's `conversation[].attachments` (seeded at manual-creation time,
 * see persist<Type>FromManualEntry) and Document's top-level `attachments`
 * (the only type with a genuine raw-file field — Event.attachments
 * references a Document entity, not a file, and Ticket/Invoice/Payment
 * have no top-level attachments field). See decisions.md.
 */
async function findOwnedManualAttachmentMeta({ userId, storageKey }) {
  for (const Model of [Invoice, Ticket]) {
    const doc = await Model.findOne(
      { userId, 'conversation.attachments.attachmentId': storageKey },
      { conversation: 1 }
    ).lean();
    if (!doc) continue;

    for (const entry of doc.conversation || []) {
      const match = (entry.attachments || []).find((a) => a.attachmentId === storageKey);
      if (match) return match;
    }
  }

  const document = await Document.findOne(
    { userId, 'attachments.attachmentId': storageKey },
    { attachments: 1 }
  ).lean();
  if (document) {
    const match = (document.attachments || []).find((a) => a.attachmentId === storageKey);
    if (match) return match;
  }

  return null;
}

// Signed-URL redirect for a manually-uploaded attachment stored in R2 — the
// storage key is passed as a query param (not a path segment) since it
// contains slashes (`users/{userId}/manual-ingestion/{creationId}/...`).
router.get('/manual', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { key } = req.query;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: '"key" query parameter is required' });
  }

  try {
    const attachmentMeta = await findOwnedManualAttachmentMeta({ userId: req.user._id, storageKey: key });
    if (!attachmentMeta) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const signedUrl = await storageService.getSignedDownloadUrl({ storageKey: key });
    return res.redirect(signedUrl);
  } catch (error) {
    console.error(`[attachmentRoutes] Failed to fetch manual attachment key=${key}:`, error.message);
    return res.status(502).json({ error: 'Failed to fetch attachment from storage' });
  }
});

module.exports = router;
