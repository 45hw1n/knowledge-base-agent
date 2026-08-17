const NOT_DELETED_FILTER = { isDeleted: { $ne: true } };

const ACTIVE_TRANSACTION_FILTER = NOT_DELETED_FILTER;

function activeTransactionMatch(extra = {}) {
    return { ...extra, ...NOT_DELETED_FILTER };
}

module.exports = {
    ACTIVE_TRANSACTION_FILTER,
    NOT_DELETED_FILTER,
    activeTransactionMatch
};
