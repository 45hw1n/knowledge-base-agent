const config = require('../../config');
const { parseWebhookPayload } = require('../utils/webhookParser');
const whatsappMessageRepository = require('../repositories/whatsappMessageRepository');
const whatsappReplyService = require('./whatsappReplyService');

/**
 * Milestone 1 WhatsApp webhook pipeline:
 * parse → ignore non-text → dedupe → persist (RECEIVED / INBOUND) → reply.
 *
 * Later milestones can plug an orchestrator after persist without changing
 * the parser, repository, or API client.
 */

/**
 * Process one normalized inbound text message.
 * @param {object} normalizedMessage
 */
async function processNormalizedMessage(normalizedMessage) {
  const result = await whatsappMessageRepository.saveMessage(normalizedMessage);

  if (result.duplicate) {
    console.info(
      `[WhatsApp] Duplicate message ignored messageId=${normalizedMessage.messageId}`
    );
    return;
  }

  console.info(
    `[WhatsApp] Message persisted messageId=${normalizedMessage.messageId} from=${normalizedMessage.phoneNumber} status=RECEIVED direction=INBOUND`
  );

  try {
    await whatsappReplyService.replyToInboundMessage(normalizedMessage);
  } catch (error) {
    // Persist succeeded; reply failure must not crash webhook processing
    console.error(
      `[WhatsApp] Reply pipeline error messageId=${normalizedMessage.messageId}:`,
      error.message
    );
  }
}

/**
 * Handle a Meta webhook POST body after HTTP 200 has already been sent.
 * Never throws to the caller — all errors are logged.
 *
 * @param {object} payload - req.body
 */
async function handleIncomingWebhook(payload) {
  try {
    console.info('[WhatsApp] Webhook received');

    if (!payload || typeof payload !== 'object') {
      console.warn('[WhatsApp] Malformed webhook payload — empty or non-object');
      return;
    }

    const messages = parseWebhookPayload(payload);

    if (messages.length === 0) {
      console.info('[WhatsApp] No inbound text messages in webhook (ignored)');
      return;
    }

    for (const message of messages) {
      try {
        await processNormalizedMessage(message);
      } catch (error) {
        console.error(
          `[WhatsApp] Failed processing messageId=${message?.messageId}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Unhandled webhook processing error:', error.message);
  }
}

/**
 * Meta webhook verification (GET).
 * @param {string|undefined} mode
 * @param {string|undefined} token
 * @param {string|undefined} challenge
 * @returns {{ ok: boolean, challenge?: string, status: number }}
 */
function verifyWebhook(mode, token, challenge) {
  const verifyToken = config.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return { ok: true, challenge: String(challenge ?? ''), status: 200 };
  }

  console.warn('[WhatsApp] Webhook verification failed');
  return { ok: false, status: 403 };
}

module.exports = {
  handleIncomingWebhook,
  processNormalizedMessage,
  verifyWebhook,
};
