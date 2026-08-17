const config = require('../config');

const { OAuth2Client } = require('google-auth-library');
const authClient = new OAuth2Client();

/**
 * Verify that the request is from Google Pub/Sub using OIDC
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} - True if valid
 */
async function verifyPubSubMessage(req) {
  if (!req.body || !req.body.message) {
    console.log('[WebhookAuth] Missing message field');
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[WebhookAuth] Missing Authorization header');
    return false;
  }

  const token = authHeader.split(' ')[1];

  try {
    const ticket = await authClient.verifyIdToken({
      idToken: token,
      audience: process.env.PUBSUB_AUDIENCE,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      console.log('[WebhookAuth] Missing token payload');
      return false;
    }

    const validIssuers = [
      'accounts.google.com',
      'https://accounts.google.com'
    ];

    if (!validIssuers.includes(payload.iss)) {
      console.log(`[WebhookAuth] Invalid issuer: ${payload.iss}`);
      return false;
    }

    if (!payload.email_verified) {
      console.log('[WebhookAuth] Email not verified');
      return false;
    }

    if (payload.email !== process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL) {
      console.log(`[WebhookAuth] Unauthorized email: ${payload.email}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WebhookAuth] Token verification failed:', error.message);
    return false;
  }
}

/**
 * Decode the Pub/Sub message
 * @param {Object} message - Pub/Sub message object
 * @returns {Object} - Decoded message data
 */
function decodeMessage(message) {
  if (!message.data) {
    return {};
  }

  try {
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding Pub/Sub message:', error);
    return {};
  }
}

/**
 * Process a Gmail notification
 * @param {Object} data - Decoded notification data
 * @returns {Object} - Processing info
 */
async function processNotification(data) {
  // Gmail notification contains emailAddress and historyId
  const { emailAddress, historyId } = data;

  console.log('Gmail notification received:', { emailAddress, historyId });

  return {
    emailAddress,
    historyId,
  };
}

module.exports = {
  verifyPubSubMessage,
  decodeMessage,
  processNotification,
};
