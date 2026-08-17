const axios = require('axios');
const config = require('../../config');
const { GRAPH_API_BASE_URL } = require('../constants/whatsapp.constants');

/**
 * Dedicated Meta WhatsApp Cloud API HTTP client.
 * Controllers and domain services must not call Graph API directly.
 */

function getCredentials() {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'WhatsApp API requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN'
    );
  }

  return { phoneNumberId, accessToken };
}

/**
 * Extract a readable error message from a Meta Graph API failure.
 * @param {unknown} error
 * @returns {string}
 */
function formatMetaApiError(error) {
  const metaError = error?.response?.data?.error;
  if (metaError) {
    const parts = [
      metaError.message,
      metaError.code != null ? `code=${metaError.code}` : null,
      metaError.error_subcode != null ? `subcode=${metaError.error_subcode}` : null,
      metaError.fbtrace_id ? `fbtrace_id=${metaError.fbtrace_id}` : null,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  if (error?.message) return error.message;
  return 'Unknown WhatsApp API error';
}

/**
 * Send a plain text WhatsApp message via Cloud API.
 *
 * @param {string} phoneNumber - Recipient wa_id (digits only, e.g. "9198xxxxxxxx")
 * @param {string} message - Text body
 * @returns {Promise<object>} Graph API response data
 */
async function sendTextMessage(phoneNumber, message) {
  if (!phoneNumber) {
    throw new Error('phoneNumber is required to send a WhatsApp message');
  }

  if (!message || typeof message !== 'string') {
    throw new Error('message must be a non-empty string');
  }

  const { phoneNumberId, accessToken } = getCredentials();
  const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;
  const requestBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    type: 'text',
    text: {
      preview_url: false,
      body: message,
    },
  };

  console.info(
    `[WhatsAppApiClient] POST ${url} to=${phoneNumber} bodyLength=${message.length}`
  );

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.info(
      `[WhatsAppApiClient] Response status=${response.status} data=${JSON.stringify(response.data)}`
    );

    return response.data;
  } catch (error) {
    const details = formatMetaApiError(error);
    const status = error?.response?.status;
    console.error(
      `[WhatsAppApiClient] Request failed${status ? ` status=${status}` : ''}: ${details}`
    );
    const wrapped = new Error(`WhatsApp Cloud API error: ${details}`);
    wrapped.cause = error;
    wrapped.status = status;
    throw wrapped;
  }
}

module.exports = {
  sendTextMessage,
  formatMetaApiError,
};
