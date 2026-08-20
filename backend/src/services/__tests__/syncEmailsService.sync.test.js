jest.mock('../gmailService', () => ({
  listMessages: jest.fn(),
  fetchMessage: jest.fn(),
}));

jest.mock('../../models/EmailToProcess', () => {
  const mockCtor = jest.fn().mockImplementation(function (doc) {
    Object.assign(this, doc);
    this._id = 'saved-email-id';
    this.save = jest.fn().mockResolvedValue(undefined);
  });
  mockCtor.exists = jest.fn().mockResolvedValue(false);
  return mockCtor;
});

jest.mock('../../models/AppStatus', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/UserPreferences', () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../controllers/updateAppStatusController', () => ({
  updateAppStatus: jest.fn().mockResolvedValue(undefined),
  updateAppStatusInternal: jest.fn().mockResolvedValue({}),
}));

jest.mock('../emailProcessorService', () => ({
  processEmails: jest.fn().mockResolvedValue({ queuedCount: 0 }),
}));

const gmailService = require('../gmailService');
const EmailToProcess = require('../../models/EmailToProcess');
const AppStatus = require('../../models/AppStatus');
const { updateAppStatus, updateAppStatusInternal } = require('../../controllers/updateAppStatusController');
const { MAX_SYNC_FAILURES } = require('../../utils/Constants');
const syncEmailsService = require('../syncEmailsService');

// processEmail() itself does a full Gmail fetch + classify + persist round
// trip; that's covered by syncEmailsService.test.js. Here we only care about
// the sync-loop's failure isolation and cursor-advancement policy, so we
// stub processEmail's dependency chain at the gmailService.fetchMessage
// boundary and drive success/failure per messageId directly.
jest.mock('../../utils/helpers', () => ({
  extractEmailSnapshot: jest.fn().mockResolvedValue({
    metadata: { subject: 'Invoice #1234 due', from: 'billing@vendor.com' },
    encryptedCleanText: { encrypted: 'Amount due: $500.00. Please pay by the due date.' },
    cleanText: 'Amount due: $500.00. Please pay by the due date.',
    bodyHash: 'hash',
    snippet: 'Amount due: $500.00. Please pay by the due date.',
    threadId: 'thread-1',
  }),
}));

jest.mock('../../utils/emailEncryption', () => ({
  encryptClearText: jest.fn((v) => (v ? { encrypted: v } : null)),
}));

function gmailMessage(id) {
  return {
    id,
    threadId: 'thread-1',
    payload: {
      headers: [
        { name: 'Subject', value: 'Invoice #1' },
        { name: 'From', value: 'billing@vendor.com' },
        { name: 'Date', value: 'Mon, 01 Jan 2024 00:00:00 GMT' },
      ],
    },
  };
}

describe('syncEmailsService — failure isolation & cursor advancement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppStatus.findOne.mockResolvedValue({ emailLastSyncedAt: null, syncFailures: new Map() });
    EmailToProcess.exists.mockResolvedValue(false);
  });

  describe('syncRecentEmails', () => {
    it('advances emailLastSyncedAt when every message succeeds', async () => {
      gmailService.listMessages.mockResolvedValue([{ id: 'ok-1' }]);
      gmailService.fetchMessage.mockResolvedValue(gmailMessage('ok-1'));

      const result = await syncEmailsService.syncRecentEmails('user-1');

      expect(result.processedCount).toBe(1);
      expect(updateAppStatus).toHaveBeenCalledWith('user-1', expect.objectContaining({ emailLastSyncedAt: expect.any(Date) }));
    });

    it('processes the remaining messages and withholds emailLastSyncedAt when one message fails', async () => {
      gmailService.listMessages.mockResolvedValue([{ id: 'bad-1' }, { id: 'ok-1' }]);
      gmailService.fetchMessage.mockImplementation((userId, id) => {
        if (id === 'bad-1') return Promise.reject(new Error('boom'));
        return Promise.resolve(gmailMessage(id));
      });

      const result = await syncEmailsService.syncRecentEmails('user-1');

      // The failure on bad-1 must not abort processing of ok-1 (no per-message
      // try/catch previously meant one bad message aborted the whole batch).
      expect(result.processedCount).toBe(1);
      expect(updateAppStatus).not.toHaveBeenCalled();
      expect(updateAppStatusInternal).toHaveBeenCalledWith('user-1', {
        $inc: { 'syncFailures.bad-1': 1 },
      });
    });

    it('skips a message already confirmed poison and still advances the cursor', async () => {
      AppStatus.findOne.mockResolvedValue({
        emailLastSyncedAt: null,
        syncFailures: new Map([['poison-1', MAX_SYNC_FAILURES]]),
      });
      gmailService.listMessages.mockResolvedValue([{ id: 'poison-1' }]);

      const result = await syncEmailsService.syncRecentEmails('user-1');

      expect(gmailService.fetchMessage).not.toHaveBeenCalled();
      expect(result.processedCount).toBe(0);
      expect(updateAppStatus).toHaveBeenCalled();
    });
  });

  describe('syncEmailsByLookback', () => {
    const sinceDate = new Date('2024-01-01T00:00:00Z');

    it('advances emailLastSyncedAt when every message succeeds', async () => {
      gmailService.listMessages.mockResolvedValue([{ id: 'ok-1' }]);
      gmailService.fetchMessage.mockResolvedValue(gmailMessage('ok-1'));

      const result = await syncEmailsService.syncEmailsByLookback('user-1', sinceDate);

      expect(result.processedCount).toBe(1);
      expect(updateAppStatus).toHaveBeenCalledWith('user-1', expect.objectContaining({ emailLastSyncedAt: expect.any(Date) }));
    });

    it('does not permanently lose a transiently-failing message by advancing the cursor past it', async () => {
      gmailService.listMessages.mockResolvedValue([{ id: 'bad-1' }, { id: 'ok-1' }]);
      gmailService.fetchMessage.mockImplementation((userId, id) => {
        if (id === 'bad-1') return Promise.reject(new Error('boom'));
        return Promise.resolve(gmailMessage(id));
      });

      const result = await syncEmailsService.syncEmailsByLookback('user-1', sinceDate);

      expect(result.processedCount).toBe(1);
      expect(updateAppStatus).not.toHaveBeenCalled();
      expect(updateAppStatusInternal).toHaveBeenCalledWith('user-1', {
        $inc: { 'syncFailures.bad-1': 1 },
      });
    });
  });
});
