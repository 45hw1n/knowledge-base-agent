const webhookService = require('../services/webhookService');

/**
 * GET /webhooks/whatsapp — Meta webhook verification challenge.
 */
function verifyWebhook(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = webhookService.verifyWebhook(mode, token, challenge);

    if (result.ok) {
      return res.status(200).send(result.challenge);
    }

    return res.sendStatus(403);
  } catch (error) {
    console.error('[WhatsApp] Verification handler error:', error.message);
    return res.sendStatus(403);
  }
}

/**
 * POST /webhooks/whatsapp — receive inbound events.
 * Controller only: receive → ack → hand off to WebhookService
 * (parse → persist → reply).
 */
function receiveWebhook(req, res) {
  try {
    const payload = req.body;

    if (payload == null || typeof payload !== 'object') {
      console.warn('[WhatsApp] POST webhook missing body — acknowledging anyway');
      return res.sendStatus(200);
    }

    // Acknowledge immediately so Meta does not retry
    res.sendStatus(200);

    webhookService.handleIncomingWebhook(payload).catch((error) => {
      console.error(
        '[WhatsApp] Unhandled error in webhook background processing:',
        error.message
      );
    });
  } catch (error) {
    console.error('[WhatsApp] receiveWebhook handler error:', error.message);
    // Meta retries on non-2xx — prefer 200 even on unexpected handler errors
    if (!res.headersSent) {
      return res.sendStatus(200);
    }
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook,
};
