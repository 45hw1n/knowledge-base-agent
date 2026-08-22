const Entity = require('../../../models/Entity');

// Shared cap on how many rows a single chat data-source read can return —
// keeps the response-generation prompt (which receives this data verbatim)
// bounded, and keeps a keyword-less "list everything" query cheap.
const MAX_RESULTS = 50;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Joins a batch of typed-child docs (Ticket/Invoice/Payment/Event/Document)
 * to their Entity registry rows, and returns the shape chat "sources" need:
 * `entityId` is ALWAYS `Entity._id`, never the typed child's own `_id` — the
 * frontend's EntityDetailSheet is keyed on the former exclusively. A typed
 * child with no matching Entity row (shouldn't happen in practice) is
 * skipped rather than fabricating an id.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId
 * @param {string} params.type - one of Entity.ENTITY_TYPES
 * @param {Array<object>} params.docs - lean typed-child documents
 * @param {(doc: object) => object} params.mapFields - extra domain fields to merge in
 * @returns {Promise<Array<object>>}
 */
async function attachEntityMetadata({ userId, type, docs, mapFields }) {
  if (!docs.length) return [];

  const childIds = docs.map((doc) => doc._id);
  const entities = await Entity.find({ userId, type, entityId: { $in: childIds } }).lean();
  const entityByChildId = new Map(entities.map((entity) => [String(entity.entityId), entity]));

  const results = [];
  for (const doc of docs) {
    const entity = entityByChildId.get(String(doc._id));
    if (!entity) continue;
    results.push({
      entityId: entity._id,
      displayId: entity.displayId,
      title: entity.title,
      type,
      ...mapFields(doc),
    });
  }
  return results;
}

module.exports = { MAX_RESULTS, escapeRegExp, attachEntityMetadata };
