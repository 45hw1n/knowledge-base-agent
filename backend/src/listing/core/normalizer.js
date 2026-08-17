const { SORT_ORDERS, DEFAULT_LIST_OPTIONS } = require('./types');

const OPERATOR_CANONICAL_MAP = {
    is: 'is',
    isnot: 'isNot',
    in: 'in',
    notin: 'notIn',
    contains: 'contains',
    startswith: 'startsWith',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    between: 'between',
    exists: 'exists'
};

function normalizePredicateOperator(operator) {
    const normalized = String(operator || '').trim().toLowerCase();
    return OPERATOR_CANONICAL_MAP[normalized] || normalized;
}

function normalizeSort(sortInput = [], config) {
    const normalized = [];
    const seenAttributes = new Set();
    const fields = config.fields || {};

    for (const sort of sortInput) {
        if (!sort || typeof sort !== 'object') continue;
        const attribute = typeof sort.attribute === 'string' ? sort.attribute.trim() : '';
        if (!attribute || seenAttributes.has(attribute)) continue;

        const fieldDef = fields[attribute];
        if (!fieldDef || !fieldDef.sortable) continue;

        const order =
            String(sort.order || SORT_ORDERS.ASC).toUpperCase() === SORT_ORDERS.DESC
                ? SORT_ORDERS.DESC
                : SORT_ORDERS.ASC;

        seenAttributes.add(attribute);
        normalized.push({ attribute, order });
    }

    if (!normalized.length) {
        return (config.defaultSort || []).map((sort) => ({
            attribute: sort.attribute,
            order: String(sort.order || SORT_ORDERS.ASC).toUpperCase() === SORT_ORDERS.DESC
                ? SORT_ORDERS.DESC
                : SORT_ORDERS.ASC
        }));
    }

    return normalized;
}

function normalizeConditions(conditions) {
    if (!conditions || typeof conditions !== 'object') return null;

    const operator = typeof conditions.operator === 'string'
        ? conditions.operator.trim()
        : '';
    const isLogical = ['AND', 'OR'].includes(operator.toUpperCase()) && Array.isArray(conditions.operands);

    if (isLogical) {
        const operands = conditions.operands
            .map((operand) => normalizeConditions(operand))
            .filter(Boolean);
        if (!operands.length) return null;
        return {
            operator: operator.toUpperCase(),
            operands
        };
    }

    const normalizedPredicate = {
        attribute: typeof conditions.attribute === 'string' ? conditions.attribute.trim() : '',
        operator: normalizePredicateOperator(operator),
        value: conditions.value
    };

    return normalizedPredicate;
}

function normalizeListRequest(request = {}, config) {
    const page = Number.isInteger(request.page) && request.page > 0
        ? request.page
        : DEFAULT_LIST_OPTIONS.page;

    const maxPageSize = config.maxPageSize || DEFAULT_LIST_OPTIONS.maxPageSize;
    const defaultPageSize = config.defaultPageSize || DEFAULT_LIST_OPTIONS.pageSize;
    const rawPageSize =
        Number.isInteger(request.pageSize) && request.pageSize > 0
            ? request.pageSize
            : defaultPageSize;
    const pageSize = Math.min(rawPageSize, maxPageSize);

    return {
        page,
        pageSize,
        sort: normalizeSort(request.sort, config),
        conditions: normalizeConditions(request.conditions)
    };
}

module.exports = {
    normalizeListRequest,
    normalizeSort,
    normalizeConditions
};

