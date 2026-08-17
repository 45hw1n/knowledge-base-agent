const { SORT_ORDERS } = require('./types');

function buildSortStage(sort, fields) {
    const sortDoc = {};
    for (const entry of sort) {
        const fieldDef = fields[entry.attribute];
        if (!fieldDef) continue;
        sortDoc[fieldDef.dbPath] = entry.order === SORT_ORDERS.DESC ? -1 : 1;
    }

    // Deterministic ordering for stable offset pagination.
    if (!Object.prototype.hasOwnProperty.call(sortDoc, '_id')) {
        sortDoc._id = 1;
    }

    return { $sort: sortDoc };
}

function buildFacetPagination({ page, pageSize, sortStage, projectStage }) {
    const skip = (page - 1) * pageSize;
    const dataStages = [sortStage, { $skip: skip }, { $limit: pageSize }];

    if (projectStage) {
        dataStages.push({ $project: projectStage });
    }

    return {
        $facet: {
            data: dataStages,
            totalCount: [{ $count: 'total' }]
        }
    };
}

function buildAggregationPipeline({
    baseStages = [],
    tenantMatch = null,
    translatedMatch = null,
    listInfo,
    config
}) {
    const pipeline = [...baseStages];

    if (tenantMatch && Object.keys(tenantMatch).length > 0) {
        pipeline.push({ $match: tenantMatch });
    }

    if (translatedMatch && Object.keys(translatedMatch).length > 0) {
        pipeline.push({ $match: translatedMatch });
    }

    const sortStage = buildSortStage(listInfo.sort, config.fields);
    pipeline.push(
        buildFacetPagination({
            page: listInfo.page,
            pageSize: listInfo.pageSize,
            sortStage,
            projectStage: config.projectStage || null
        })
    );

    return pipeline;
}

module.exports = {
    buildAggregationPipeline,
    buildSortStage
};

