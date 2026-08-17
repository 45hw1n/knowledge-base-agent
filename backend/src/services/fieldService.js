const Field = require('../models/Field');

/**
 * Retrieves metadata for all fields.
 * Returns an object keyed by field id.
 * Excludes field values.
 * Includes inactive fields.
 */
const getFieldsMeta = async () => {
    const fields = await Field.find({}, {
        id: 1,
        name: 1,
        label: 1,
        isActive: 1,
        isCustom: 1,
        nestedTo: 1,
        _id: 0
    }).lean();

    const meta = {};
    fields.forEach(field => {
        meta[field.id] = {
            name: field.name,
            label: field.label,
            isActive: field.isActive,
            isCustom: field.isCustom,
            nestedTo: field.nestedTo ? { id: field.nestedTo.id } : null
        };
    });

    return meta;
};

module.exports = {
    getFieldsMeta,
};
