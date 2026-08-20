const { createListService } = require('../listing/core');
const { entitiesListConfig } = require('../listing/configs/entities.listConfig');
const { mapListError } = require('./mapListingErrors');

const entityListService = createListService(entitiesListConfig);

function normalizeEntityDocument(entity) {
    if (!entity) return entity;
    return {
        id: entity._id.toString(),
        userId: entity.userId.toString(),
        type: entity.type,
        displayId: entity.displayId,
        title: entity.title,
        source: {
            type: entity.source.type,
            provider: entity.source.provider,
            url: entity.source.url,
            emailId: entity.source.emailId ? entity.source.emailId.toString() : null,
            threadId: entity.source.threadId ? entity.source.threadId.toString() : null
        },
        entityId: entity.entityId.toString(),
        extraction: {
            status: entity.extraction.status,
            model: entity.extraction.model ?? null,
            confidence: entity.extraction.confidence ?? null,
            extractedAt: entity.extraction.extractedAt?.toISOString?.() || null
        },
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
    mapListError,
    normalizeEntityDocument
};
