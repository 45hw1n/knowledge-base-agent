class ListFrameworkError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'ListFrameworkError';
        this.code = code;
        this.details = details;
    }
}

class ListValidationError extends ListFrameworkError {
    constructor(message, details = {}) {
        super('LIST_VALIDATION_ERROR', message, details);
        this.name = 'ListValidationError';
    }
}

class UnsupportedFieldError extends ListValidationError {
    constructor(field) {
        super(`Unsupported field: ${field}`, { field });
        this.code = 'UNSUPPORTED_FIELD';
    }
}

class UnsupportedOperatorError extends ListValidationError {
    constructor(field, operator) {
        super(`Unsupported operator "${operator}" for field "${field}"`, {
            field,
            operator
        });
        this.code = 'UNSUPPORTED_OPERATOR';
    }
}

class ConditionDepthExceededError extends ListValidationError {
    constructor(maxDepth) {
        super(`Maximum condition depth exceeded. Maximum allowed depth is ${maxDepth}.`, {
            maxDepth
        });
        this.code = 'CONDITION_DEPTH_EXCEEDED';
    }
}

class ListExecutionError extends ListFrameworkError {
    constructor(message, details = {}) {
        super('LIST_EXECUTION_ERROR', message, details);
        this.name = 'ListExecutionError';
    }
}

module.exports = {
    ListFrameworkError,
    ListValidationError,
    UnsupportedFieldError,
    UnsupportedOperatorError,
    ConditionDepthExceededError,
    ListExecutionError
};

