const { z } = require('zod');
const { DEFAULT_LIST_OPTIONS, LOGICAL_OPERATORS } = require('./types');
const {
    ListValidationError,
    UnsupportedFieldError,
    UnsupportedOperatorError,
    ConditionDepthExceededError
} = require('./errors');
const { normalizeListRequest } = require('./normalizer');

const sortSchema = z.object({
    attribute: z.string().min(1),
    order: z.enum(['ASC', 'DESC']).optional()
});

const conditionSchema = z.lazy(() =>
    z.object({
        operator: z.string().optional(),
        attribute: z.string().optional(),
        value: z.any().optional(),
        operands: z.array(conditionSchema).optional()
    }).strict()
);

const listRequestSchema = z.object({
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    sort: z.array(sortSchema).optional(),
    conditions: conditionSchema.nullish()
}).strict();

/** Uppercase sort order before Zod so clients may send ASC/DESC case-insensitively. */
function coerceListRequestShape(request) {
    if (!request || typeof request !== 'object') return request;
    const next = { ...request };
    if (Array.isArray(next.sort)) {
        next.sort = next.sort.map((entry) => {
            if (!entry || typeof entry !== 'object') return entry;
            const order =
                typeof entry.order === 'string' ? entry.order.trim().toUpperCase() : entry.order;
            return { ...entry, order };
        });
    }
    return next;
}

function isLogicalNode(node) {
    return (
        node &&
        typeof node === 'object' &&
        typeof node.operator === 'string' &&
        [LOGICAL_OPERATORS.AND, LOGICAL_OPERATORS.OR].includes(node.operator.toUpperCase())
    );
}

function validateConditionNode(node, config, state, depth = 1) {
    if (!node || typeof node !== 'object') {
        throw new ListValidationError('Invalid condition node.');
    }

    if (depth > state.maxDepth) {
        throw new ConditionDepthExceededError(state.maxDepth);
    }

    if (isLogicalNode(node)) {
        if (!Array.isArray(node.operands) || node.operands.length === 0) {
            throw new ListValidationError('Logical condition requires non-empty operands.');
        }
        for (const operand of node.operands) {
            validateConditionNode(operand, config, state, depth + 1);
        }
        return;
    }

    const attribute = typeof node.attribute === 'string' ? node.attribute.trim() : '';
    const operator = typeof node.operator === 'string' ? node.operator.trim() : '';

    if (!attribute) {
        throw new ListValidationError('Predicate condition is missing "attribute".');
    }
    if (!operator) {
        throw new ListValidationError('Predicate condition is missing "operator".');
    }

    const fieldDef = config.fields[attribute];
    if (!fieldDef || !fieldDef.filterable) {
        throw new UnsupportedFieldError(attribute);
    }

    if (!fieldDef.operators.includes(operator)) {
        throw new UnsupportedOperatorError(attribute, operator);
    }

    state.predicateCount += 1;
    if (state.predicateCount > state.maxPredicates) {
        throw new ListValidationError(
            `Predicate limit exceeded. Maximum predicates allowed: ${state.maxPredicates}.`
        );
    }
}

function validateSort(sort = [], config) {
    for (const rule of sort) {
        const fieldDef = config.fields[rule.attribute];
        if (!fieldDef || !fieldDef.sortable) {
            throw new UnsupportedFieldError(rule.attribute);
        }
    }
}

function validateListRequest(request, config) {
    const parsed = listRequestSchema.safeParse(coerceListRequestShape(request || {}));
    if (!parsed.success) {
        throw new ListValidationError('Invalid list request payload.', {
            issues: parsed.error.issues
        });
    }

    const normalized = normalizeListRequest(parsed.data, config);

    validateSort(normalized.sort, config);

    if (normalized.conditions) {
        const state = {
            maxDepth: config.maxConditionDepth || DEFAULT_LIST_OPTIONS.maxConditionDepth,
            maxPredicates: config.maxPredicates || DEFAULT_LIST_OPTIONS.maxPredicates,
            predicateCount: 0
        };
        validateConditionNode(normalized.conditions, config, state, 1);
    }

    return normalized;
}

module.exports = {
    validateListRequest
};

