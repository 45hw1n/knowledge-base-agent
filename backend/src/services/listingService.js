const { createListService } = require('../listing/core');
const { entitiesListConfig } = require('../listing/configs/entities.listConfig');
const { mapListError } = require('./mapListingErrors');

const entityListService = createListService(entitiesListConfig);

function normalizeEntityDocument(entity) {
    if (!entity) return entity;
    return {
        id: entity._id.toString(),
        entityType: entity.entityType,
        data: entity.data,
        sourceType: entity.sourceType,
        sourceEmailId: entity.sourceEmailId ? entity.sourceEmailId.toString() : null,
        sourceAttachmentId: entity.sourceAttachmentId || null,
        rawTextSnippet: entity.rawTextSnippet || null,
        confidence: entity.confidence ?? null,
        status: entity.status,
        extractedAt: entity.extractedAt?.toISOString?.() || null,
        createdAt: entity.createdAt?.toISOString?.() || null,
        updatedAt: entity.updatedAt?.toISOString?.() || null
    };
}

async function listEntities(request, runtimeContext) {
    const response = await entityListService.list(request, runtimeContext);
    return {
        ...response,
        data: response.data.map(normalizeEntityDocument)
    };
}

module.exports = {
    listEntities,
    mapListError
};
