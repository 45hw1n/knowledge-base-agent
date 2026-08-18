const mongoose = require('mongoose');

/**
 * Generic atomic sequence counter — not specific to Entity displayIds,
 * reusable for any future need for a per-key incrementing number. Keyed by
 * an arbitrary string `_id` (e.g. "<userId>:<entityType>" for Entity
 * displayId sequences — see services/displayIdService.js).
 *
 * Atomicity comes from MongoDB serializing concurrent `$inc` operations on
 * the same document — two simultaneous callers can never receive the same
 * `seq` value, no separate locking/retry needed (contrast with
 * EmailThread's findOrCreateThread, which needs a duplicate-key retry
 * because it's creating a new document under a race; incrementing an
 * existing counter has no equivalent race to handle).
 */
const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Counter', CounterSchema);
