function buildPagination(total, page, pageSize) {
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    return {
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1 && totalPages > 0
    };
}

function buildListResponse({ aggregationResult, listInfo, executionTime }) {
    const facetResult = aggregationResult[0] || { data: [], totalCount: [] };
    const data = facetResult.data || [];
    const total = facetResult.totalCount?.[0]?.total || 0;

    return {
        data,
        listInfo,
        pagination: buildPagination(total, listInfo.page, listInfo.pageSize),
        meta: {
            executionTime,
            cached: false
        }
    };
}

module.exports = {
    buildListResponse
};

