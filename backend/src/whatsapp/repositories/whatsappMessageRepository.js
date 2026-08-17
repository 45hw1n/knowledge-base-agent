const WhatsappMessage = require('../models/whatsappMessage.model');
const {
  WHATSAPP_MESSAGE_STATUS,
  WHATSAPP_MESSAGE_DIRECTION,
} = require('../constants/whatsapp.constants');

/**
 * Persist a normalized inbound WhatsApp message.
 * Idempotent on Meta messageId — duplicates are ignored.
 *
 * @param {object} normalizedMessage - output of webhookParser (+ rawPayload)
 * @returns {Promise<{ saved: boolean, document: object|null, duplicate: boolean }>}
 */
async function saveMessage(normalizedMessage) {
  if (!normalizedMessage?.messageId) {
    throw new Error('Cannot save WhatsappMessage without messageId');
  }

  const existing = await WhatsappMessage.findOne({
    messageId: normalizedMessage.messageId,
  }).lean();

  if (existing) {
    return { saved: false, document: existing, duplicate: true };
  }

  try {
    const document = await WhatsappMessage.create({
      messageId: normalizedMessage.messageId,
      phoneNumber: normalizedMessage.phoneNumber,
      messageType: normalizedMessage.messageType,
      text: normalizedMessage.text ?? null,
      timestamp: normalizedMessage.timestamp || new Date(),
      rawPayload: normalizedMessage.rawPayload ?? null,
      direction: WHATSAPP_MESSAGE_DIRECTION.INBOUND,
      status: WHATSAPP_MESSAGE_STATUS.RECEIVED,
      mediaId: normalizedMessage.mediaId ?? null,
      contacts: normalizedMessage.contacts ?? null,
      metadata: normalizedMessage.metadata ?? null,
      processedAt: null,
    });

    return { saved: true, document, duplicate: false };
  } catch (error) {
    // Race: concurrent webhook retry hit unique index
    if (error?.code === 11000) {
      const document = await WhatsappMessage.findOne({
        messageId: normalizedMessage.messageId,
      }).lean();
      return { saved: false, document, duplicate: true };
    }
    throw error;
  }
}

/**
 * @param {string} messageId
 * @returns {Promise<object|null>}
 */
async function findByMessageId(messageId) {
  return WhatsappMessage.findOne({ messageId }).lean();
}

module.exports = {
  saveMessage,
  findByMessageId,
};
