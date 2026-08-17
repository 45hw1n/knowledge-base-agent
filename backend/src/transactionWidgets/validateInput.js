const { WIDGET_TYPES } = require('./builders');

/**
 * @param {unknown} input
 */
function validateInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Input is required');
    }

    const { conditions, widgets } = input;

    if (!conditions || typeof conditions !== 'object') {
        throw new Error('conditions is required');
    }

    if (!Array.isArray(widgets) || widgets.length === 0) {
        throw new Error('widgets must be a non-empty array');
    }

    for (const widget of widgets) {
        if (!widget || typeof widget !== 'object') {
            throw new Error('Each widget must be an object');
        }

        if (!widget.type || typeof widget.type !== 'string') {
            throw new Error('Each widget must have a type');
        }

        if (!WIDGET_TYPES.includes(widget.type)) {
            throw new Error(`Unknown widget type: ${widget.type}`);
        }

        if (widget.config != null) {
            if (typeof widget.config !== 'object' || Array.isArray(widget.config)) {
                throw new Error(`config for ${widget.type} must be an object`);
            }

            if (
                widget.type === 'TOP_MERCHANTS' &&
                widget.config.limit != null &&
                (!Number.isFinite(widget.config.limit) || widget.config.limit <= 0)
            ) {
                throw new Error('TOP_MERCHANTS config.limit must be a positive number');
            }
        }
    }
}

module.exports = { validateInput };
