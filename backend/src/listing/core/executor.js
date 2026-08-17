const { ListExecutionError } = require('./errors');

async function executeAggregation(model, pipeline, options = {}) {
    const start = Date.now();
    try {
        let aggregateQuery = model.aggregate(pipeline);
        if (options.allowDiskUse) {
            aggregateQuery = aggregateQuery.allowDiskUse(true);
        }

        const result = await aggregateQuery.exec();
        const durationMs = Date.now() - start;
        return { result, durationMs };
    } catch (error) {
        throw new ListExecutionError('Failed to execute aggregation pipeline.', {
            message: error.message
        });
    }
}

module.exports = {
    executeAggregation
};

