const mongoose = require('mongoose');

/**
 * Recursively converts a lean Mongoose document (or plain object/array) into
 * GraphQL-safe values: ObjectId -> string, Date -> ISO string. Used for the
 * typed entity detail types (Invoice/Payment/Ticket/Event/Document), which
 * each carry several ObjectId/Date fields nested at varying depths —
 * avoids hand-writing a near-identical field-by-field mapper per type.
 */
function serializeForGraphQL(value) {
    if (value == null) return value;

    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeForGraphQL);
    }

    if (typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = serializeForGraphQL(val);
        }
        return result;
    }

    return value;
}

module.exports = { serializeForGraphQL };
