const express = require('express');
const router = express.Router();

const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const gmailService = require('../services/gmailService');

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

module.exports = router;
