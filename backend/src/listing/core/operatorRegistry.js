const { ListValidationError } = require('./errors');

function ensureArray(value, operatorName) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new ListValidationError(`Operator "${operatorName}" expects a non-empty array value.`);
    }
}

function ensureValuePresent(value, operatorName) {
    if (value === undefined) {
        throw new ListValidationError(`Operator "${operatorName}" requires a value.`);
    }
}

function ensureBoolean(value, operatorName) {
    if (typeof value !== 'boolean') {
        throw new ListValidationError(`Operator "${operatorName}" expects a boolean value.`);
    }
}

function ensureString(value, operatorName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ListValidationError(`Operator "${operatorName}" expects a non-empty string value.`);
    }
}

function defaultNormalize(value, field) {
    if (typeof field.normalizeValue === 'function') {
        return field.normalizeValue(value);
    }
    return value;
}

function createDefaultOperatorRegistry() {
    return {
        is: {
            validateValue(value) {
                ensureValuePresent(value, 'is');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $eq: value } };
            }
        },
        isNot: {
            validateValue(value) {
                ensureValuePresent(value, 'isNot');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $ne: value } };
            }
        },
        in: {
            validateValue(value) {
                ensureArray(value, 'in');
            },
            normalizeValue(value, field) {
                return value.map((entry) => defaultNormalize(entry, field));
            },
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $in: value } };
            }
        },
        notIn: {
            validateValue(value) {
                ensureArray(value, 'notIn');
            },
            normalizeValue(value, field) {
                return value.map((entry) => defaultNormalize(entry, field));
            },
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $nin: value } };
            }
        },
        contains: {
            validateValue(value) {
                ensureString(value, 'contains');
                if (value.length > 100) {
                    throw new ListValidationError('Operator "contains" supports max length 100.');
                }
            },
            normalizeValue(value) {
                return value.trim();
            },
            toMongoPredicate({ dbPath, value }) {
                const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { [dbPath]: { $regex: escaped, $options: 'i' } };
            }
        },
        startsWith: {
            validateValue(value) {
                ensureString(value, 'startsWith');
            },
            normalizeValue(value) {
                return value.trim();
            },
            toMongoPredicate({ dbPath, value }) {
                const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { [dbPath]: { $regex: `^${escaped}`, $options: 'i' } };
            }
        },
        gt: {
            validateValue(value) {
                ensureValuePresent(value, 'gt');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $gt: value } };
            }
        },
        gte: {
            validateValue(value) {
                ensureValuePresent(value, 'gte');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $gte: value } };
            }
        },
        lt: {
            validateValue(value) {
                ensureValuePresent(value, 'lt');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $lt: value } };
            }
        },
        lte: {
            validateValue(value) {
                ensureValuePresent(value, 'lte');
            },
            normalizeValue: defaultNormalize,
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $lte: value } };
            }
        },
        between: {
            validateValue(value) {
                ensureArray(value, 'between');
                if (value.length !== 2) {
                    throw new ListValidationError('Operator "between" expects exactly two values.');
                }
            },
            normalizeValue(value, field) {
                return value.map((entry) => defaultNormalize(entry, field));
            },
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $gte: value[0], $lte: value[1] } };
            }
        },
        exists: {
            validateValue(value) {
                ensureBoolean(value, 'exists');
            },
            toMongoPredicate({ dbPath, value }) {
                return { [dbPath]: { $exists: value } };
            }
        }
    };
}

module.exports = {
    createDefaultOperatorRegistry
};

