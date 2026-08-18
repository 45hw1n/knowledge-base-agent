const TRANSACTION_REGEX = {
    // Matches: ₹1,234 | ₹1234.00 | INR 500 | INR500
    amount: /₹\s?\d{1,3}(,\d{3})*(\.\d{2})?|\bINR\s?\d+/i,

    // Matches: debited | spent | paid | withdrawn | charged | deducted | transferred
    debitVerbs: /\b(debited|spent|paid|withdrawn|charged|deducted|transferred)\b/i,

    // Matches: transaction words + debit/credit card variations
    transactionWords: /\b(transaction|txn|upi|pos|imps|neft|rtgs|card|debit[\s-]?card|credit[\s-]?card)\b/i,

    // Matches financial-looking senders
    financialSender: /\b(bank|upi|pay|payments?|card|credit|debit|alert|statement|euron|ashwin)\b/i,

    // Matches masked card numbers like: xx1234 | ****1234 | x1234
    cardSuffix: /\b(x{1,4}|\*{1,4})\d{2,4}\b/i
};


const NEGATIVE_REGEX = /\b(reminder|due|survey|feedback|newsletter|authenticate|authentication|verify|verification|statement|offer|rewards|points|subscription|queue|activated|recommendations)\b/i;

const STORE_TRANSACTION_MAIL_THRESHOLD = 50;

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
    TRANSACTION_REGEX,
    NEGATIVE_REGEX,
    STORE_TRANSACTION_MAIL_THRESHOLD,
    MAX_SYNC_FAILURES,
    GOOGLE_SCOPES,
    SCOPE_URL_TO_KEY,
    LOGIN_SCOPES,
};