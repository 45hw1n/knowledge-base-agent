jest.mock('../../models/EmailToProcess', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../../ai/orchestrator', () => ({
  extractAndPersistEntity: jest.fn(),
}));

// processEmails() owns the AppStatus emailProcessingInProgress lock itself
// now (moved here from the GraphQL resolver) — mocked so these tests never
// touch real Mongo. Resolves truthy so the lock-acquire call always
// succeeds; these tests are about the EmailToProcess locking/status
// behavior, not the AppStatus lock itself.
jest.mock('../../controllers/updateAppStatusController', () => ({
  updateAppStatusInternal: jest.fn().mockResolvedValue({}),
}));

const mongoose = require('mongoose');
const EmailToProcess = require('../../models/EmailToProcess');
const { extractAndPersistEntity } = require('../../ai/orchestrator');
const { processEmails, reclaimStaleProcessing } = require('../emailProcessorService');

function leanQuery(result) {
  return { sort: () => ({ limit: () => ({ lean: () => Promise.resolve(result) }) }) };
}

describe('emailProcessorService — idempotency & crash recovery', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    EmailToProcess.updateMany.mockResolvedValue({ modifiedCount: 0 });
    EmailToProcess.find.mockReturnValue(leanQuery([]));
  });

  describe('reclaimStaleProcessing', () => {
    it('resets only PROCESSING records older than the stale timeout back to RETRY_PENDING', async () => {
      EmailToProcess.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const reclaimed = await reclaimStaleProcessing(userId);

      expect(EmailToProcess.updateMany).toHaveBeenCalledTimes(1);
      const [filter, update] = EmailToProcess.updateMany.mock.calls[0];
      expect(filter.accountUserId).toBe(userId);
      expect(filter.status).toBe('PROCESSING');
      expect(filter.processingStartedAt.$lt).toBeInstanceOf(Date);
      expect(update.$set.status).toBe('RETRY_PENDING');
      expect(update.$unset).toHaveProperty('processingStartedAt');
      expect(reclaimed).toBe(2);
    });
  });

  describe('processEmails', () => {
    it('reclaims stale PROCESSING records before querying, so a crash-orphaned email is retried', async () => {
      await processEmails({ userId, status: 'DETECTED' });

      expect(EmailToProcess.updateMany).toHaveBeenCalledTimes(1);
      const callOrder = EmailToProcess.updateMany.mock.invocationCallOrder[0];
      const findCallOrder = EmailToProcess.find.mock.invocationCallOrder[0];
      expect(callOrder).toBeLessThan(findCallOrder);
    });

    it('requires userId to prevent an unscoped cross-tenant query', async () => {
      await expect(processEmails({})).rejects.toThrow('userId is required');
    });

    it('locks a record atomically, stamping processingStartedAt, and clears it on success', async () => {
      const emailId = new mongoose.Types.ObjectId();
      EmailToProcess.find.mockReturnValue(leanQuery([{ _id: emailId, messageId: 'm1' }]));
      EmailToProcess.findOneAndUpdate.mockResolvedValue({ _id: emailId, messageId: 'm1' });
      EmailToProcess.updateOne.mockResolvedValue({});
      extractAndPersistEntity.mockResolvedValue({ entityCreated: true, entityId: 'entity-1', type: 'INVOICE', error: null });

      const result = await processEmails({ userId, status: 'DETECTED' });

      expect(result.queuedCount).toBe(1);

      const [lockFilter, lockUpdate] = EmailToProcess.findOneAndUpdate.mock.calls[0];
      expect(lockFilter._id).toBe(emailId);
      expect(lockFilter.status.$in).toContain('RETRY_PENDING');
      expect(lockUpdate.$set.status).toBe('PROCESSING');
      expect(lockUpdate.$set.processingStartedAt).toBeInstanceOf(Date);

      const [successFilter, successUpdate] = EmailToProcess.updateOne.mock.calls[0];
      expect(successFilter.status).toBe('PROCESSING');
      expect(successUpdate.$set.status).toBe('LLM_PROCESSED');
      expect(successUpdate.$unset).toHaveProperty('processingStartedAt');
    });

    it('never re-locks a record another worker already holds in PROCESSING', async () => {
      const emailId = new mongoose.Types.ObjectId();
      EmailToProcess.find.mockReturnValue(leanQuery([{ _id: emailId, messageId: 'm1' }]));
      // findOneAndUpdate returns null because the record's status no longer
      // matches allowedStatuses (another worker already locked it) — this is
      // the exact race two concurrent processEmails() calls, or a duplicate
      // webhook-triggered auto-process, must resolve safely.
      EmailToProcess.findOneAndUpdate.mockResolvedValue(null);
      EmailToProcess.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ status: 'PROCESSING' }) }) });

      const result = await processEmails({ userId, status: 'DETECTED' });

      expect(result.queuedCount).toBe(0);
      expect(extractAndPersistEntity).not.toHaveBeenCalled();
      expect(EmailToProcess.updateOne).not.toHaveBeenCalled();
    });

    it('clears processingStartedAt and marks LLM_ERROR on extraction failure, leaving the record retryable', async () => {
      const emailId = new mongoose.Types.ObjectId();
      EmailToProcess.find.mockReturnValue(leanQuery([{ _id: emailId, messageId: 'm1' }]));
      EmailToProcess.findOneAndUpdate.mockResolvedValue({ _id: emailId, messageId: 'm1' });
      EmailToProcess.updateOne.mockResolvedValue({});
      extractAndPersistEntity.mockResolvedValue({ entityCreated: false, entityId: null, type: 'INVOICE', error: 'transient AI failure' });

      const result = await processEmails({ userId, status: 'DETECTED' });

      expect(result.queuedCount).toBe(0);
      const [, failureUpdate] = EmailToProcess.updateOne.mock.calls[0];
      expect(failureUpdate.$set.status).toBe('LLM_ERROR');
      expect(failureUpdate.$unset).toHaveProperty('processingStartedAt');
    });
  });
});
