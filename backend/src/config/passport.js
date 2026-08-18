const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const config = require('./index');
const { SCOPE_URL_TO_KEY } = require('../utils/Constants');

const getCallbackURL = () => {
  if (process.env.NODE_ENV === "local") {
    return `${process.env.BACKEND_BASE_URL}/auth/google/callback`;
  }
  return '/auth/google/callback';
};

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: getCallbackURL(),
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, params, profile, done) => {
        try {
          const { encryptToken } = require('../utils/encryption');

          const encryptedAccessToken = await encryptToken(String(accessToken));

          const encryptedRefreshToken = refreshToken
            ? await encryptToken(String(refreshToken))
            : undefined;

          // Extract granted scopes from the token response
          const grantedScopes = params.scope ? params.scope.split(' ') : [];

          console.log('[Passport] Granted scopes:', grantedScopes);

          const provider = 'GOOGLE';
          const providerUserId = profile.id;

          let user = await User.findOne({ provider, providerUserId });

          if (user) {
            const previousScopes = new Set(user.grantedScopes || []);
            const mergedScopes = [...new Set([...previousScopes, ...grantedScopes])];
            const newScopes = grantedScopes.filter(s => !previousScopes.has(s));

            if (newScopes.length > 0) {
              console.log('[Passport] New scopes granted:', newScopes);
            }

            user.displayName = profile.displayName;
            user.firstName = profile.name?.givenName;
            user.lastName = profile.name?.familyName;
            user.image = profile.photos?.[0]?.value;
            user.email = profile.emails?.[0]?.value;

            if (encryptedRefreshToken) {
              user.refreshToken = encryptedRefreshToken;
            }

            user.accessToken = encryptedAccessToken;
            user.tokenExpiry = new Date(Date.now() + 3600 * 1000);
            user.grantedScopes = mergedScopes;
            user.gmailAuthRevoked = false;

            await user.save();
          } else {
            if (!encryptedRefreshToken) {
              const email = profile.emails?.[0]?.value;
              if (req.session && email) {
                req.session.oauthLoginHint = email;
              }
              const err = new Error('New user requires consent to obtain refresh token');
              err.code = 'MISSING_REFRESH_TOKEN';
              return done(err, null);
            }

            user = await User.create({
              provider,
              providerUserId,
              displayName: profile.displayName,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              image: profile.photos?.[0]?.value,
              email: profile.emails?.[0]?.value,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiry: new Date(Date.now() + 3600 * 1000),
              grantedScopes,
            });
          }

          // ─── Capture historyId BEFORE setupWatch() advances it ────────────────
          // setupWatch() overwrites user.historyId with the current live value.
          // We must save the old value here so we can sync the gap later.
          const preWatchHistoryId = user.historyId || null;

          // ─── Renew Gmail watch (always, regardless of onboarding state) ───────
          try {
            const gmailService = require('../services/gmailService');
            await gmailService.setupWatch(user._id.toString());
          } catch (err) {
            console.error('Gmail watch setup failed:', err.message);
          }

          // ─── Fire-and-forget recovery sync ─────────────────────────────────────
          triggerLoginSync(user._id.toString(), preWatchHistoryId)
            .catch(err => console.error('[LoginSync] Unhandled error:', err.message));

          // ─── Update lastLoggedInAt ───────────────────────────────────────────
          try {
            console.log('[LOGIN SUCCESS]', user._id);
            console.log('[AppStatus] Updating lastLoggedInAt for:', user._id);
            const { updateAppStatus } = require('../controllers/updateAppStatusController');
            await updateAppStatus(user._id, { lastLoggedInAt: new Date() });
          } catch (err) {
            console.error('[Passport] Failed to update lastLoggedInAt:', err.message);
          }

          return done(null, user);
        } catch (err) {
          console.error('Login failed:', err);
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    // 🔑 INTERNAL identity only
    done(null, user._id.toString());
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

/**
 * Trigger a fire-and-forget email recovery sync at login.
 *
 * Called after setupWatch() so the watch is always renewed first.
 * Uses the same AppStatus.emailSyncStatus lock the webhook uses,
 * so a concurrent webhook delivery will simply skip — no duplicates.
 *
 * Sync decision tree:
 *   preWatchHistoryId exists  → syncHistorySince()  (fast, incremental)
 *     └─ throws              → fallback: syncEmailsByLookback()
 *   no historyId, has date   → syncEmailsByLookback() (date-window search)
 *   neither                  → skip (first-time user, webhook will bootstrap)
 *
 * @param {string}      userId            - MongoDB ObjectId string
 * @param {string|null} preWatchHistoryId - historyId captured BEFORE setupWatch()
 */
async function triggerLoginSync(userId, preWatchHistoryId) {
  const TAG = `[LoginSync] user=${userId}`;

  try {
    const { updateAppStatusInternal } = require('../controllers/updateAppStatusController');
    const UserPreferences = require('../models/UserPreferences');
    const { syncHistorySince, syncEmailsByLookback } = require('../services/syncEmailsService');

    // ── Acquire the same distributed lock the webhook uses ──────────────────
    // The 5-minute stale-lock timeout matches the webhook's implementation.
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);

    // Step 1 — Expire a stale lock if one exists (crash recovery).
    await updateAppStatusInternal(
      userId,
      {
        $set:   { emailSyncStatus: 'IDLE' },
        $unset: { syncStartedAt: '' }
      },
      {
        emailSyncStatus: 'SYNC_IN_PROGRESS',
        syncStartedAt: { $lt: lockTimeout }
      }
    );

    // Step 2 — Clean acquisition (only matches IDLE — no $or ambiguity).
    const lock = await updateAppStatusInternal(
      userId,
      { $set: { emailSyncStatus: 'SYNC_IN_PROGRESS', syncStartedAt: new Date() } },
      { emailSyncStatus: 'IDLE' }
    );

    if (!lock) {
      // Webhook already holds the lock — it is recovering the same emails.
      console.log(`${TAG} Sync already in progress (webhook racing) — skipping login sync.`);
      return;
    }

    console.log(`${TAG} Lock acquired. preWatchHistoryId=${preWatchHistoryId}`);

    try {
      if (preWatchHistoryId) {
        // ── Primary path: fast incremental sync via Gmail History API ──────
        try {
          console.log(`${TAG} Running syncHistorySince from historyId=${preWatchHistoryId}`);
          const result = await syncHistorySince(userId, preWatchHistoryId);
          console.log(`${TAG} syncHistorySince done — processed ${result.processedCount} emails.`);
        } catch (historyErr) {
          // historyId may be expired (Gmail keeps history for ~30 days).
          // Fall back to date-window search.
          console.warn(`${TAG} syncHistorySince failed: ${historyErr.message}. Attempting lookback fallback.`);
          const prefs = await UserPreferences.findOne({ userId });
          if (prefs?.emailSyncStartDate) {
            console.log(`${TAG} Fallback: syncEmailsByLookback since ${prefs.emailSyncStartDate.toISOString()}`);
            const result = await syncEmailsByLookback(userId, prefs.emailSyncStartDate);
            console.log(`${TAG} Fallback done — processed ${result.processedCount} emails.`);
          } else {
            console.warn(`${TAG} No fallback date available — skipping sync.`);
          }
        }

      } else {
        // ── No historyId: try date-window lookback ──────────────────────────
        const prefs = await UserPreferences.findOne({ userId });
        if (prefs?.emailSyncStartDate) {
          console.log(`${TAG} No historyId — running syncEmailsByLookback since ${prefs.emailSyncStartDate.toISOString()}`);
          const result = await syncEmailsByLookback(userId, prefs.emailSyncStartDate);
          console.log(`${TAG} syncEmailsByLookback done — processed ${result.processedCount} emails.`);
        } else {
          // First-time user: no history, no start date.
          // The Pub/Sub webhook will bootstrap historyId on first event.
          console.log(`${TAG} No historyId and no emailSyncStartDate — skipping (first-time user).`);
        }
      }

    } finally {
      // ── Release lock unconditionally (even if sync threw) ──────────────
      await updateAppStatusInternal(
        userId,
        {
          $set: { emailSyncStatus: 'IDLE' },
          $unset: { syncStartedAt: '' }
        },
        { emailSyncStatus: 'SYNC_IN_PROGRESS' }
      );
      console.log(`${TAG} Lock released.`);
    }

  } catch (err) {
    // Outer catch: covers lock acquisition errors and other unexpected failures.
    console.error(`${TAG} Failed:`, err.message);

    // Best-effort lock release so future syncs are not permanently blocked.
    try {
      const { updateAppStatusInternal } = require('../controllers/updateAppStatusController');
      await updateAppStatusInternal(
        userId,
        {
          $set: { emailSyncStatus: 'IDLE' },
          $unset: { syncStartedAt: '' }
        },
        { emailSyncStatus: 'SYNC_IN_PROGRESS' }
      );
    } catch (_) { /* best-effort only */ }
  }
}
