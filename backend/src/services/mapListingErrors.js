const { ListFrameworkError } = require('../listing/core');

function mapListError(error) {
    if (!(error instanceof ListFrameworkError)) {
        return {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected list execution failure'
        };
    }

    const codeMapping = {
        LIST_VALIDATION_ERROR: 'BAD_USER_INPUT',
        UNSUPPORTED_FIELD: 'BAD_USER_INPUT',
        UNSUPPORTED_OPERATOR: 'BAD_USER_INPUT',
        CONDITION_DEPTH_EXCEEDED: 'BAD_USER_INPUT',
        LIST_EXECUTION_ERROR: 'INTERNAL_SERVER_ERROR'
    };

    return {
        code: codeMapping[error.code] || 'INTERNAL_SERVER_ERROR',
        message: error.message
    };
}

module.exports = {
    mapListError
};
