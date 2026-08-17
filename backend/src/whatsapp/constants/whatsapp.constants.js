/**
 * WhatsApp Cloud API constants and status enums.
 */

const WHATSAPP_MESSAGE_STATUS = Object.freeze({
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
});

const WHATSAPP_MESSAGE_DIRECTION = Object.freeze({
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
});

/** Milestone 1 only persists and replies to inbound text. */
const MILESTONE_1_MESSAGE_TYPES = Object.freeze(['text']);

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

module.exports = {
  WHATSAPP_MESSAGE_STATUS,
  WHATSAPP_MESSAGE_DIRECTION,
  MILESTONE_1_MESSAGE_TYPES,
  GRAPH_API_VERSION,
  GRAPH_API_BASE_URL,
};
