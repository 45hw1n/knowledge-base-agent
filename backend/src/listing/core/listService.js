const { validateListRequest } = require('./validation');
const { buildConditionAst } = require('./ast');
const { createDefaultOperatorRegistry } = require('./operatorRegistry');
const { MongoConditionTranslator } = require('./translator');
const { buildAggregationPipeline } = require('./pipelineBuilder');
const { executeAggregation } = require('./executor');
const { buildListResponse } = require('./responseBuilder');

function createListService(config, hooks = {}) {
    const operatorRegistry = createDefaultOperatorRegistry();

    return {
        async list(request, runtimeContext = {}) {
            if (hooks.preValidate) {
                await hooks.preValidate(request, runtimeContext);
            }

            const listInfo = validateListRequest(request, config);

            if (hooks.postValidate) {
                await hooks.postValidate(listInfo, runtimeContext);
            }

            const ast = buildConditionAst(listInfo.conditions);

            if (hooks.preTranslate) {
                await hooks.preTranslate(ast, runtimeContext);
            }

            const translator = new MongoConditionTranslator({
                fields: config.fields,
                operatorRegistry
            });
            const translatedMatch = translator.translate(ast);

            if (hooks.postTranslate) {
                await hooks.postTranslate(translatedMatch, runtimeContext);
            }

            const tenantMatch = typeof config.tenantMatchFactory === 'function'
                ? config.tenantMatchFactory(runtimeContext)
                : {};
            const baseStages = typeof config.basePipelineFactory === 'function'
                ? config.basePipelineFactory(runtimeContext)
                : [];

            const pipeline = buildAggregationPipeline({
                baseStages,
                tenantMatch,
                translatedMatch,
                listInfo,
                config
            });

            if (hooks.preExecute) {
                await hooks.preExecute(pipeline, runtimeContext);
            }

            const { result, durationMs } = await executeAggregation(config.model, pipeline, {
                allowDiskUse: Boolean(config.allowDiskUse)
            });

            if (hooks.postExecute) {
                await hooks.postExecute(result, runtimeContext);
            }

            return buildListResponse({
                aggregationResult: result,
                listInfo,
                executionTime: durationMs
            });
        }
    };
}

module.exports = {
    createListService
};

