const whatsappApiClient = require('../clients/whatsappApiClient');

/**
 * Builds and sends Milestone 1 ack replies for inbound text messages.
 * HTTP lives in WhatsAppApiClient — this service owns reply content + outbound logging.
 */

/**
 * Build the fixed Milestone 1 echo reply.
 * @param {string} originalMessage
 * @returns {string}
 */
function buildAckReply(originalMessage) {
  return [
    'Received the message by Fynverse',
    '',
    'Content:',
    originalMessage ?? '',
  ].join('\n');
}

/**
 * Reply to an inbound WhatsApp text message.
 *
 * @param {{ phoneNumber: string, text: string|null, messageId?: string }} inboundMessage
 * @returns {Promise<object>} Graph API response data
 */
async function replyToInboundMessage(inboundMessage) {
  const phoneNumber = inboundMessage?.phoneNumber;
  const messageId = inboundMessage?.messageId;
  const replyBody = buildAckReply(inboundMessage?.text ?? '');

  console.info(
    `[WhatsApp] Reply requested messageId=${messageId ?? 'n/a'} to=${phoneNumber}`
  );

  try {
    const response = await whatsappApiClient.sendTextMessage(phoneNumber, replyBody);

    console.info(
      `[WhatsApp] Reply succeeded messageId=${messageId ?? 'n/a'} to=${phoneNumber}`
    );

    return response;
  } catch (error) {
    console.error(
      `[WhatsApp] Reply failed messageId=${messageId ?? 'n/a'} to=${phoneNumber}:`,
      error.message
    );
    throw error;
  }
}

module.exports = {
  buildAckReply,
  replyToInboundMessage,
};
