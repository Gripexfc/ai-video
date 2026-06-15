const { setupCrudSubRouter } = require('./crud');
const { setupPromptsSubRouter } = require('./prompts');
const { setupBatchSubRouter } = require('./batch');
const { setupGenerationSubRouter } = require('./generation');

/**
 * Main storyboard router — mounts sub-routers and exports the combined handler map.
 * Compatible with the original routes(db, log) call signature.
 */
function setupStoryboardRouter(db, log) {
  const crud = setupCrudSubRouter(db, log);
  const prompts = setupPromptsSubRouter(db, log);
  const batch = setupBatchSubRouter(db, log);
  const generation = setupGenerationSubRouter(db, log);

  return {
    // CRUD
    create: crud.create,
    insertBefore: crud.insertBefore,
    getOne: crud.getOne,
    update: crud.update,
    delete: crud.delete,

    // Prompts / polish
    framePrompt: prompts.framePrompt,
    framePromptsGet: prompts.framePromptsGet,
    polishPrompt: prompts.polishPrompt,
    generateUniversalSegmentPrompt: prompts.generateUniversalSegmentPrompt,
    generateUniversalSegmentStream: prompts.generateUniversalSegmentStream,
    polishUniversalSegmentStream: prompts.polishUniversalSegmentStream,
    polishClassicVideoPromptStream: prompts.polishClassicVideoPromptStream,

    // Batch
    batchInferParams: batch.batchInferParams,
    upscale: batch.upscale,

    // Generation
    episodeStoryboardsGenerate: generation.episodeStoryboardsGenerate,
    episodeStoryboardsGet: generation.episodeStoryboardsGet,
  };
}

module.exports = setupStoryboardRouter;
