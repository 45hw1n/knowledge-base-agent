const EmailThread = require('../models/EmailThread');

/**
 * Strips reply/forward prefixes and normalizes whitespace/case so that
 * "Unable to login", "Re: Unable to login", "RE: Unable to login", and
 * "Fwd: Re: Unable to login" are recognized as related.
 *
 * This is a small, standalone utility only — NOT wired into thread lookup
 * yet. Gmail always supplies a stable `threadId`, which is preferred and is
 * the only mechanism `findOrCreateThread` currently uses; subject-based
 * matching is a fallback for providers/situations without one, deliberately
 * deferred until that's actually needed (see decisions.md).
 */
function normalizeSubjectForThreading(subject) {
  if (!subject) return '';

  let normalized = String(subject).trim();
  const prefixPattern = /^(re|fwd|fw)\s*:\s*/i;

  // Strip repeated/nested prefixes: "Fwd: Re: Re: Unable to login" → "Unable to login"
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, '').trim();
  }

  return normalized.toLowerCase();
}

function dedupeParticipants(participants) {
  const seen = new Set();
  const result = [];

  for (const participant of participants || []) {
    const email = participant?.email ? String(participant.email).trim().toLowerCase() : null;
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.push({ email, name: participant.name || null });
  }

  return result;
}

/**
 * Finds the EmailThread for a given provider conversation, creating it if
 * it doesn't exist yet, and idempotently records this message/these
 * participants on it.
 *
 * Safe to call repeatedly with the same providerMessageId (e.g. duplicate
 * webhook delivery) — messageIds/participants are deduplicated via
 * $addToSet, and a concurrent duplicate insert (the unique index catching a
 * race between two parallel calls) is retried as an update rather than
 * surfaced as an error.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.provider='GMAIL']
 * @param {string} params.providerThreadId - Gmail's threadId
 * @param {string} [params.providerMessageId] - Gmail's message id for the email being added
 * @param {string} [params.subject] - only used when creating a new thread
 * @param {Array<{email: string, name?: string}>} [params.participants]
 * @returns {Promise<import('mongoose').Document>} the EmailThread document
 */
async function findOrCreateThread({
  userId,
  provider = 'GMAIL',
  providerThreadId,
  providerMessageId,
  subject,
  participants = [],
}) {
  if (!userId) {
    throw new Error('userId is required to find or create an EmailThread');
  }
  if (!providerThreadId) {
    throw new Error('providerThreadId is required to find or create an EmailThread');
  }

  const addToSet = {};
  if (providerMessageId) addToSet.messageIds = providerMessageId;

  const dedupedParticipants = dedupeParticipants(participants);
  if (dedupedParticipants.length) addToSet.participants = { $each: dedupedParticipants };

  const update = {
    $setOnInsert: { userId, provider, providerThreadId, subject: subject || '' },
    ...(Object.keys(addToSet).length ? { $addToSet: addToSet } : {}),
  };

  const filter = { userId, provider, providerThreadId };

  try {
    return await EmailThread.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    // Two concurrent calls raced to create the same thread (e.g. the same
    // webhook delivered twice at almost the same instant) — the unique
    // index rejected the second insert. The document now exists; apply
    // this call's updates on top of it instead of failing.
    if (error?.code === 11000) {
      return EmailThread.findOneAndUpdate(filter, update, { new: true });
    }
    throw error;
  }
}

module.exports = { findOrCreateThread, normalizeSubjectForThreading };
