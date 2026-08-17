const { LOGICAL_OPERATORS } = require('./types');

function isLogicalCondition(input) {
    return (
        input &&
        typeof input === 'object' &&
        typeof input.operator === 'string' &&
        [LOGICAL_OPERATORS.AND, LOGICAL_OPERATORS.OR].includes(input.operator.toUpperCase()) &&
        Array.isArray(input.operands)
    );
}

function buildConditionAst(condition) {
    if (!condition) return null;

    if (isLogicalCondition(condition)) {
        const operator = condition.operator.toUpperCase();
        const operands = condition.operands
            .map((operand) => buildConditionAst(operand))
            .filter(Boolean);

        if (!operands.length) return null;
        if (operands.length === 1) return operands[0];

        return {
            kind: 'logical',
            operator,
            operands
        };
    }

    return {
        kind: 'predicate',
        field: condition.attribute,
        operator: condition.operator,
        value: condition.value
    };
}

module.exports = {
    buildConditionAst
};

