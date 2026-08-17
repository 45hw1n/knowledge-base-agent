const mongoose = require('mongoose');

const ValueSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        immutable: true,
    },
    value: {
        type: String,
        required: true,
        immutable: true,
    },
    label: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    nestedTo: {
        type: {
            valueId: {
                type: String,
                required: false, // Enforced via validation hook for subCategory
            }
        },
        _id: false,
        default: null,
    },
}, { _id: false });

const FieldSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
    },
    name: {
        type: String,
        required: true,
        immutable: true,
    },
    label: {
        type: String,
        required: true,
    },
    isCustom: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    nestedTo: {
        type: {
            field: { type: String, required: false }, // "category"
            id: { type: String, required: false },    // "1"
            value: { type: String, required: false }, // Legacy/Internal use
        },
        _id: false,
        default: null,
    },
    values: [ValueSchema],
    notes: {
        type: String,
        required: false,
    },
}, {
    timestamps: true,
});

// Rules validation
FieldSchema.pre('save', async function () {
    // 1. System fields (isCustom = false) cannot be deactivated
    if (this.isModified('isActive') && this.isActive === false && this.isCustom === false) {
        throw new Error('System fields cannot be deactivated');
    }

    // 2. No circular nesting
    if (this.nestedTo && this.nestedTo.id === this.id) {
        throw new Error('A field cannot be nested to itself');
    }

    // 3. Normalize subCategory rules (Part 1, Item 4)
    // Enforce value-level nesting ONLY for subCategory
    // Value-level nesting is enforced to ensure that every subcategory value 
    // is correctly mapped to a parent category value for analytics and filtering.
    // Duplication (storing value/label in nestedTo) is forbidden to maintain a single source of truth.
    if (this.name === 'subCategory' || this.name === 'subcategory') {
        if (this.values && this.values.length > 0) {
            const hasInvalidValue = this.values.some(v => !v.nestedTo || !v.nestedTo.valueId);
            if (hasInvalidValue) {
                throw new Error('Every value in subCategory must have a nestedTo.valueId referencing a category');
            }
        }
    }
});

// Prevent hard deletes
FieldSchema.pre('remove', async function () {
    throw new Error('Hard deletes are not allowed. Use isActive = false for soft delete.');
});

// Also prevent deleteOne
FieldSchema.pre('deleteOne', { document: true, query: false }, async function () {
    throw new Error('Hard deletes are not allowed. Use isActive = false for soft delete.');
});

const Field = mongoose.model('Field', FieldSchema);

module.exports = Field;
