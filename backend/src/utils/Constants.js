/**
 * Maximum number of times a single Gmail messageId will be retried
 * during history sync before it is classified as a "poison email" and
 * permanently skipped. Prevents a single broken email from blocking
 * historyId advancement indefinitely.
 */
const MAX_SYNC_FAILURES = 3;

/**
 * Google OAuth scope registry
 * Keys are human-readable identifiers stored on the User document.
 * Values contain the actual Google scope URL.
 */
const GOOGLE_SCOPES = {
    PROFILE:        { value: 'https://www.googleapis.com/auth/userinfo.profile' },
    EMAIL:          { value: 'https://www.googleapis.com/auth/userinfo.email' },
    OPENID:         { value: 'openid' },
    GMAIL_READONLY: { value: 'https://www.googleapis.com/auth/gmail.readonly' },
};

// Reverse lookup: URL → key (e.g., 'https://...profile' → 'PROFILE')
const SCOPE_URL_TO_KEY = Object.fromEntries(
    Object.entries(GOOGLE_SCOPES).map(([key, { value }]) => [value, key])
);

/**
 * Scopes requested during primary login.
 * Minimal set: identity + Gmail read-only.
 */
const LOGIN_SCOPES = [
    'openid',
    'profile',
    'email',
    GOOGLE_SCOPES.GMAIL_READONLY.value,
];

module.exports = {
    MAX_SYNC_FAILURES,
    GOOGLE_SCOPES,
    SCOPE_URL_TO_KEY,
    LOGIN_SCOPES,
};
