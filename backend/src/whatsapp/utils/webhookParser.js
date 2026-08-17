/**
 * Transforms Meta WhatsApp Cloud API webhook payloads into clean internal objects.
 * The rest of the codebase must never traverse Meta payloads directly.
 */

/**
 * Extract media id for media message types (kept for Phase 2+).
 * @param {object} message
 * @returns {string|null}
 */
function extractMediaId(message) {
  if (!message || !message.type) return null;

  const mediaContainer = message[message.type];
  if (mediaContainer && typeof mediaContainer === 'object' && mediaContainer.id) {
    return mediaContainer.id;
  }

  return null;
}

/**
 * Extract text body when present.
 * @param {object} message
 * @returns {string|null}
 */
function extractText(message) {
  if (!message) return null;

  if (message.type === 'text' && message.text?.body) {
    return message.text.body;
  }

  return null;
}

/**
 * Normalize a single Meta inbound text message + change context.
 * Non-text messages return null (Milestone 1 ignores them).
 *
 * @param {object} message - Meta messages[] entry
 * @param {object} value - Meta changes[].value
 * @param {object} rawPayload - full webhook body for persistence
 * @returns {object|null}
 */
function normalizeMessage(message, value, rawPayload) {
  if (!message?.id || !message?.from) {
    return null;
  }

  // Milestone 1: inbound text only
  if (message.type !== 'text') {
    return null;
  }

  const timestampSeconds = Number(message.timestamp);
  const receivedAt = Number.isFinite(timestampSeconds)
    ? new Date(timestampSeconds * 1000)
    : new Date();

  return {
    messageId: message.id,
    phoneNumber: message.from,
    timestamp: receivedAt,
    messageType: 'text',
    text: extractText(message),
    mediaId: null,
    contacts: value?.contacts || null,
    rawPayload: rawPayload ?? null,
    metadata: {
      displayPhoneNumber: value?.metadata?.display_phone_number || null,
      phoneNumberId: value?.metadata?.phone_number_id || null,
      messagingProduct: value?.messaging_product || null,
      profileName: value?.contacts?.[0]?.profile?.name || null,
      rawType: message.type || null,
    },
  };
}

/**
 * Parse a Meta webhook body into zero or more normalized inbound text messages.
 * Status updates, delivery receipts, non-text messages, and unsupported shapes
 * yield an empty array (or are omitted from the result).
 *
 * @param {object} payload - req.body from Meta
 * @returns {Array<object>}
 */
function parseWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  // Meta status-only webhooks still use object=whatsapp_business_account
  if (payload.object && payload.object !== 'whatsapp_business_account') {
    return [];
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const normalized = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      if (!value || typeof value !== 'object') continue;

      // Ignore delivery / read / status updates — no customer messages
      if (!Array.isArray(value.messages) || value.messages.length === 0) {
        continue;
      }

      for (const message of value.messages) {
        if (message?.type && message.type !== 'text') {
          console.info(
            `[WhatsApp] Ignoring non-text inbound type=${message.type} messageId=${message.id ?? 'n/a'}`
          );
          continue;
        }

        const parsed = normalizeMessage(message, value, payload);
        if (parsed) {
          normalized.push(parsed);
        }
      }
    }
  }

  return normalized;
}

module.exports = {
  parseWebhookPayload,
  normalizeMessage,
  extractText,
  extractMediaId,
};
