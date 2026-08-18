const { google } = require('googleapis');
const User = require('../models/User');
const { decryptToken, encryptToken } = require('../utils/encryption');
const config = require('../config');

const gmail = google.gmail('v1');

/**
 * Per-user in-process refresh lock.
 * Maps userId (string) → Promise<void>
 * Prevents multiple parallel callers from each firing a separate
 * refreshAccessToken() call simultaneously, which would cause the
 * last DB write to silently overwrite a newer rotated refreshToken.
 *
 * @type {Map<string, Promise<void>>}
 */
const _refreshLocks = new Map();

/**
 * Get authenticated Gmail client for a user.
 * Automatically refreshes the access token when expired and persists
 * both the new accessToken AND any new refreshToken Google returns.
 *
 * @param {string} userId - MongoDB user ID
 * @returns {{ client: OAuth2Client, user: UserDocument }}
 */
async function getAuthenticatedClient(userId) {
  const user = await User.findById(userId).select('+accessToken +refreshToken');
  if (!user) {
    throw new Error('User not found');
  }

  const accessToken = await decryptToken(user.accessToken);
  const refreshToken = user.refreshToken
    ? await decryptToken(user.refreshToken)
    : null;

  if (!accessToken) {
    throw new Error('Failed to decrypt access token');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken && { refresh_token: refreshToken }),
  });

  if (user.tokenExpiry && new Date() > user.tokenExpiry) {
    if (!refreshToken) {
      throw new Error('Access token expired and no refresh token available');
    }

    // ── Concurrency guard ────────────────────────────────────────────────────
    // If another in-flight call for this user is already refreshing, wait for
    // it to finish (DB is already updated), then re-fetch the user and proceed.
    if (_refreshLocks.has(userId)) {
      console.log(`[gmailService] Waiting for in-progress refresh (userId=${userId})`);
      await _refreshLocks.get(userId);

      // Re-read the now-updated tokens from DB and apply them to our client.
      const freshUser = await User.findById(userId).select('+accessToken +refreshToken');
      const freshAccess = await decryptToken(freshUser.accessToken);
      const freshRefresh = freshUser.refreshToken
        ? await decryptToken(freshUser.refreshToken)
        : null;

      // ── Re-check expiry after waiting.
      // If the concurrent refresh FAILED the tokens in DB are still stale.
      // Log a clear warning but do NOT throw — the downstream Gmail API call
      // will fail with a 401 which is already handled by callers.
      if (freshUser.tokenExpiry && new Date() > freshUser.tokenExpiry) {
        console.warn(
          `[gmailService] Token still expired after waiting for concurrent refresh ` +
          `(userId=${userId}). The preceding refresh likely failed. ` +
          `Downstream API call may return 401.`
        );
      }

      oauth2Client.setCredentials({
        access_token: freshAccess,
        ...(freshRefresh && { refresh_token: freshRefresh }),
      });

      return { client: oauth2Client, user: freshUser };
    }

    // ── Perform the refresh, holding the lock for the duration ───────────────
    let resolveLock;
    const lockPromise = new Promise(resolve => { resolveLock = resolve; });
    _refreshLocks.set(userId, lockPromise);

    try {
      console.log(`[gmailService] Refreshing access token (userId=${userId})`);
      const { credentials } = await oauth2Client.refreshAccessToken();

      // 1. Always update the access token.
      user.accessToken = await encryptToken(credentials.access_token);

      // 2. Update tokenExpiry (credentials.expiry_date is epoch ms).
      user.tokenExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      // 3. Persist new refreshToken ONLY when Google actually returns one.
      //    Google rotates refresh tokens on force-approval flows; if we
      //    skip this step the old token becomes invalid and all future
      //    refreshes will fail permanently.
      if (credentials.refresh_token) {
        console.log(`[gmailService] Google returned a new refresh token — persisting (userId=${userId})`);
        user.refreshToken = await encryptToken(credentials.refresh_token);
      }

      await user.save();

      // Keep the in-memory OAuth client credential in sync.
      oauth2Client.setCredentials(credentials);

      console.log(`[gmailService] Token refresh complete (userId=${userId})`);
    } catch (error) {
      console.error(`[gmailService] Error refreshing token (userId=${userId}):`, error.message);

      // Surface a clear, actionable error rather than bubbling raw OAuth noise.
      if (error.message?.includes('invalid_grant')) {
        // Mark the user so the renewal job and webhook handler stop retrying.
        // Cleared when the user re-authenticates via OAuth.
        await User.updateOne({ _id: userId }, { gmailAuthRevoked: true, gmailWatchExpiry: null });
        console.warn(`[gmailService] Marked gmailAuthRevoked=true for userId=${userId}`);
        throw new Error(
          'Refresh token is invalid or has been revoked. ' +
          'The user must re-authenticate to restore Gmail access.'
        );
      }

      throw new Error('Failed to refresh access token');
    } finally {
      // Always release the lock so waiting callers and future requests
      // are not permanently blocked.
      _refreshLocks.delete(userId);
      resolveLock();
    }
  }

  return { client: oauth2Client, user };
}


/**
 * Set up Gmail watch on user's inbox
 * @param {string} userId - MongoDB user ID
 * @returns {Object} - Watch response with historyId and expiration
 */
async function setupWatch(userId) {
  try {
    const { client, user } = await getAuthenticatedClient(userId);

    const response = await gmail.users.watch({
      userId: 'me',
      auth: client,
      requestBody: {
        topicName: `projects/${config.PUBSUB_PROJECT_ID}/topics/${config.PUBSUB_TOPIC_NAME}`,
        labelIds: ['INBOX', 'UNREAD'],
        labelFilterAction: 'include'
      },
    });

    const newHistoryId = response.data.historyId;

    if (newHistoryId) {
      const currentHistoryId = user.historyId ? BigInt(user.historyId) : BigInt(0);
      const incomingHistoryId = BigInt(newHistoryId);

      if (incomingHistoryId > currentHistoryId) {
        user.historyId = newHistoryId;
      }
    }

    user.gmailWatchExpiry = new Date(parseInt(response.data.expiration));
    await user.save();

    console.log(`Gmail watch set up for user ${userId}, expires at ${user.gmailWatchExpiry}`);

    return response.data;
  } catch (error) {
    console.error('Error setting up Gmail watch:', error.message);
    throw error;
  }
}

/**
 * Fetch a specific email message
 * @param {string} userId - MongoDB user ID
 * @param {string} messageId - Gmail message ID
 * @returns {Object} - Email message data
 */
async function fetchMessage(userId, messageId) {
  try {
    const { client } = await getAuthenticatedClient(userId);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      auth: client,
      format: 'full',
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching message:', error.message);
    throw error;
  }
}

/**
 * Stop Gmail watch
 * @param {string} userId - MongoDB user ID
 */
async function stopWatch(userId) {
  try {
    const { client, user } = await getAuthenticatedClient(userId);

    await gmail.users.stop({
      userId: 'me',
      auth: client,
    });

    // Clear watch details from user
    user.historyId = null;
    user.gmailWatchExpiry = null;
    await user.save();

    console.log(`Gmail watch stopped for user ${userId}`);
  } catch (error) {
    console.error('Error stopping Gmail watch:', error.message);
    throw error;
  }
}

/**
 * List messages based on query
 * @param {string} userId - MongoDB user ID
 * @param {string} query - Gmail search query
 * @returns {Array} - Array of message IDs
 */
async function listMessages(userId, query) {
  try {
    const { client } = await getAuthenticatedClient(userId);

    let allMessages = [];
    let nextPageToken = null;

    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        auth: client,
        q: query,
        maxResults: 100, // Gmail max page size
        pageToken: nextPageToken || undefined,
      });

      const messages = response.data.messages || [];
      allMessages = allMessages.concat(messages);

      nextPageToken = response.data.nextPageToken;

    } while (nextPageToken);

    return allMessages;

  } catch (error) {
    console.error('Error listing messages:', error.message);
    throw error;
  }
}

/**
 * List history changes since startHistoryId
 * @param {string} userId - MongoDB user ID
 * @param {string} startHistoryId - Starting history ID
 * @param {string} pageToken - Optional page token for pagination
 * @returns {Object} - History data
 */
async function listHistory(userId, startHistoryId, pageToken = null) {
  try {
    const { client } = await getAuthenticatedClient(userId);

    const response = await gmail.users.history.list({
      userId: 'me',
      auth: client,
      startHistoryId,
      historyTypes: ['messageAdded'],
      maxResults: 100,
      pageToken: pageToken || undefined
    });

    return response.data;
  } catch (error) {
    console.error('Error listing history:', error.message);
    throw error;
  }
}

/**
 * Check if a user has the required OAuth scopes
 * @param {string} userId - MongoDB user ID
 * @param {string[]} requiredScopeKeys - Array of scope keys (e.g., ['SPREADSHEETS'])
 * @returns {Object} - { hasScopes: boolean, missingScopes: string[] }
 */
async function hasRequiredScopes(userId, requiredScopeKeys) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const missingScopes = requiredScopeKeys.filter(key => !user.isGoogleServiceEnabled(key));

  return {
    hasScopes: missingScopes.length === 0,
    missingScopes
  };
}

module.exports = {
  setupWatch,
  fetchMessage,
  stopWatch,
  listMessages,
  listHistory,
  getAuthenticatedClient,
  hasRequiredScopes,
};
