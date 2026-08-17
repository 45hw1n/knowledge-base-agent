const { ListValidationError, UnsupportedFieldError, UnsupportedOperatorError } = require('./errors');

class MongoConditionTranslator {
    constructor({ fields, operatorRegistry }) {
        this.fields = fields || {};
        this.operatorRegistry = operatorRegistry || {};
    }

    translate(ast) {
        if (!ast) return {};
        if (ast.kind === 'logical') {
            const translatedOperands = ast.operands
                .map((node) => this.translate(node))
                .filter((node) => node && Object.keys(node).length > 0);

            if (!translatedOperands.length) return {};
            if (translatedOperands.length === 1) return translatedOperands[0];

            if (ast.operator === 'AND') {
                return { $and: translatedOperands };
            }
            if (ast.operator === 'OR') {
                return { $or: translatedOperands };
            }

            throw new ListValidationError(`Unsupported logical operator "${ast.operator}".`);
        }

        const fieldDef = this.fields[ast.field];
        if (!fieldDef) {
            throw new UnsupportedFieldError(ast.field);
        }

        const operatorDef = this.operatorRegistry[ast.operator];
        if (!operatorDef) {
            throw new UnsupportedOperatorError(ast.field, ast.operator);
        }

        operatorDef.validateValue(ast.value, fieldDef);
        const value = typeof operatorDef.normalizeValue === 'function'
            ? operatorDef.normalizeValue(ast.value, fieldDef)
            : ast.value;

        return operatorDef.toMongoPredicate({
            field: fieldDef,
            dbPath: fieldDef.dbPath,
            value
        });
    }
}

module.exports = {
    MongoConditionTranslator
};

