jest.mock('../../controllers/updateAppStatusController', () => ({
  updateAppStatusInternal: jest.fn().mockResolvedValue({}),
}));

const { updateAppStatusInternal } = require('../../controllers/updateAppStatusController');
const { MAX_SYNC_FAILURES } = require('../../utils/Constants');
const {
  incrementSyncFailures,
  getRetryableFailures,
  reconcileSyncFailures,
} = require('../syncFailureTracker');

describe('syncFailureTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('incrementSyncFailures', () => {
    it('does nothing for an empty/undefined failure list', async () => {
      await incrementSyncFailures('user-1', []);
      await incrementSyncFailures('user-1', undefined);
      expect(updateAppStatusInternal).not.toHaveBeenCalled();
    });

    it('atomically increments a counter per failed messageId', async () => {
      await incrementSyncFailures('user-1', ['msg-a', 'msg-b']);
      expect(updateAppStatusInternal).toHaveBeenCalledWith('user-1', {
        $inc: { 'syncFailures.msg-a': 1, 'syncFailures.msg-b': 1 },
      });
    });
  });

  describe('getRetryableFailures', () => {
    it('treats a message with no prior failures as retryable', () => {
      expect(getRetryableFailures(['msg-a'], {})).toEqual(['msg-a']);
    });

    it('excludes a message whose post-increment count reaches MAX_SYNC_FAILURES', () => {
      const priors = { 'msg-a': MAX_SYNC_FAILURES - 1 };
      expect(getRetryableFailures(['msg-a'], priors)).toEqual([]);
    });

    it('supports a Mongoose Map as well as a plain object', () => {
      const map = new Map([['msg-a', MAX_SYNC_FAILURES - 1]]);
      expect(getRetryableFailures(['msg-a'], map)).toEqual([]);
    });

    it('returns an empty array for an empty failure list', () => {
      expect(getRetryableFailures([], {})).toEqual([]);
      expect(getRetryableFailures(undefined, {})).toEqual([]);
    });
  });

  describe('reconcileSyncFailures', () => {
    it('advances immediately when there are no failures', async () => {
      const onAdvance = jest.fn().mockResolvedValue(undefined);

      const result = await reconcileSyncFailures({
        userId: 'user-1',
        failedMessageIds: [],
        priorSyncFailures: {},
        onAdvance,
        context: '[test]',
      });

      expect(onAdvance).toHaveBeenCalledTimes(1);
      expect(updateAppStatusInternal).not.toHaveBeenCalled();
      expect(result).toEqual({ advanced: true, retryableCount: 0, poisonCount: 0 });
    });

    it('does NOT advance while at least one failure is still retryable', async () => {
      const onAdvance = jest.fn().mockResolvedValue(undefined);

      const result = await reconcileSyncFailures({
        userId: 'user-1',
        failedMessageIds: ['msg-a'],
        priorSyncFailures: {},
        onAdvance,
        context: '[test]',
      });

      expect(updateAppStatusInternal).toHaveBeenCalledWith('user-1', {
        $inc: { 'syncFailures.msg-a': 1 },
      });
      expect(onAdvance).not.toHaveBeenCalled();
      expect(result.advanced).toBe(false);
      expect(result.retryableCount).toBe(1);
    });

    it('advances anyway once every failure is poison, to avoid blocking the pipeline forever', async () => {
      const onAdvance = jest.fn().mockResolvedValue(undefined);
      const priors = { 'msg-a': MAX_SYNC_FAILURES - 1 };

      const result = await reconcileSyncFailures({
        userId: 'user-1',
        failedMessageIds: ['msg-a'],
        priorSyncFailures: priors,
        onAdvance,
        context: '[test]',
      });

      expect(onAdvance).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ advanced: true, retryableCount: 0, poisonCount: 1 });
    });
  });
});
