const Entity = require('../../../models/Entity');

/**
 * Persists extracted entity candidates. Each candidate is attributed to the
 * email body unless it can be traced to a specific attachment (a future
 * enhancement could ask the model to tag which section an entity came from;
 * for now every entity from a given extraction run shares the same source).
 */
async function persistEntities({ userId, sourceEmailId, sourceType, rawTextSnippet, entities }) {
    if (!entities.length) return [];

    const docs = entities.map((entity) => ({
        userId,
        entityType: entity.entityType,
        data: entity.data,
        sourceType,
        sourceEmailId,
        sourceAttachmentId: entity.sourceAttachmentId || null,
        rawTextSnippet: rawTextSnippet ? rawTextSnippet.slice(0, 500) : null,
        confidence: entity.confidence,
        status: 'EXTRACTED',
        extractedAt: new Date()
    }));

    return Entity.insertMany(docs);
}

module.exports = { persistEntities };
