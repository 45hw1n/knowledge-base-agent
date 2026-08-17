const LOGICAL_OPERATORS = Object.freeze({
    AND: 'AND',
    OR: 'OR'
});

const SORT_ORDERS = Object.freeze({
    ASC: 'ASC',
    DESC: 'DESC'
});

const CONDITION_OPERATORS = Object.freeze({
    IS: 'is',
    IS_NOT: 'isNot',
    IN: 'in',
    NOT_IN: 'notIn',
    CONTAINS: 'contains',
    STARTS_WITH: 'startsWith',
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte',
    BETWEEN: 'between',
    EXISTS: 'exists'
});

const DEFAULT_LIST_OPTIONS = Object.freeze({
    page: 1,
    pageSize: 25,
    maxPageSize: 100,
    maxConditionDepth: 8,
    maxPredicates: 50
});

module.exports = {
    LOGICAL_OPERATORS,
    SORT_ORDERS,
    CONDITION_OPERATORS,
    DEFAULT_LIST_OPTIONS
};

