const Counter = require('../models/Counter');
const { ENTITY_TYPE_PREFIXES } = require('../models/Entity');

// Minimum digit width — "001", "002", ... "999", then "1000" (never
// truncated, only ever padded up to at least this width).
const PAD_WIDTH = 3;

/**
 * Atomically generates the next human-friendly displayId for a new Entity,
 * e.g. "TKT-001". Sequences are scoped per (userId, type) — each user has
 * their own "TKT-001, TKT-002, ..." series per entity type, not a single
 * counter shared across all users (which would make the numbers
 * meaningless to any one user and leak cross-user volume information).
 *
 * Unlike every other validateExtracted-style or determine-style function
 * in this codebase, this one is NOT a pure function — generating a truly
 * unique
 * sequential number inherently requires a coordinated database write
 * (`$inc` on a Counter document), which is exactly what makes it safe
 * under concurrent calls: MongoDB serializes `$inc` on the same document,
 * so two simultaneous calls for the same user+type can never receive the
 * same number.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.type - one of Entity.ENTITY_TYPES
 * @returns {Promise<string>} e.g. "TKT-001"
 */
async function generateDisplayId({ userId, type }) {
  const prefix = ENTITY_TYPE_PREFIXES[type];
  if (!prefix) {
    throw new Error(`No displayId prefix configured for entity type: ${type}`);
  }
  if (!userId) {
    throw new Error('userId is required to generate a displayId');
  }

  const counterKey = `${userId}:${type}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  return `${prefix}-${String(counter.seq).padStart(PAD_WIDTH, '0')}`;
}

module.exports = { generateDisplayId, PAD_WIDTH };
