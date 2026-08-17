const { throwError } = require('../attachmentValidation');
const reviewAttachmentHandler = require('./reviewAttachmentHandler');
const transactionAttachmentHandler = require('./transactionAttachmentHandler');

/**
 * Registry of entity-specific attachment handlers, keyed by the
 * AttachmentEntityType GraphQL enum. REVIEW supports CRUD; TRANSACTION
 * currently supports read access only. Future entity types fail clearly
 * until their handlers are implemented.
 */

function notImplementedHandler(entityType) {
    const fail = () => throwError(
        'NOT_IMPLEMENTED',
        `Attachments are not yet supported for entityType: ${entityType}`
    );

    return {
        maxAttachments: 0,
        supportsDirectDelete: false,
        assertOwnership: fail,
        storagePathSegment: fail,
        getAttachmentCount: fail,
        appendAttachment: fail,
        getAttachment: fail,
        removeAttachment: fail
    };
}

const entityHandlers = {
    REVIEW: reviewAttachmentHandler,
    TRANSACTION: transactionAttachmentHandler,
    RECURRING_PAYMENT: notImplementedHandler('RECURRING_PAYMENT'),
    PROFILE: notImplementedHandler('PROFILE'),
    WORKSPACE: notImplementedHandler('WORKSPACE')
};

function getEntityHandler(entityType) {
    const handler = entityHandlers[entityType];
    if (!handler) {
        throwError('VALIDATION_ERROR', `Unknown entityType: ${entityType}`);
    }
    return handler;
}

module.exports = { getEntityHandler };
