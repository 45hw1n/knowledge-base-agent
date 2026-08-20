jest.mock('../../services/syncEmailsService', () => ({
  syncEmailsByLookback: jest.fn(),
  syncHistorySince: jest.fn(),
}));

jest.mock('../../services/gmailService', () => ({
  setupWatch: jest.fn(),
}));

jest.mock('../../models/AppStatus', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/UserPreferences', () => ({
  findOne: jest.fn(),
}));

const syncEmailsService = require('../../services/syncEmailsService');
const gmailService = require('../../services/gmailService');
const AppStatus = require('../../models/AppStatus');
const UserPreferences = require('../../models/UserPreferences');
const { recoverFromExpiredHistoryId } = require('../webhookController');

// This is the recovery path taken when a webhook's incremental sync
// (syncHistorySince) throws — almost always because Gmail's history API
// rejects an expired/too-old startHistoryId. Without this fallback, a
// mailbox in that state would silently stop ingesting new email forever,
// since nothing else re-triggers a sync until the user happens to log in
// again (config/passport.js#triggerLoginSync has the equivalent fallback
// for the login path already).
describe('webhookController — expired historyId recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-establishes a fresh historyId via setupWatch and backfills from emailLastSyncedAt', async () => {
    const lastSynced = new Date('2024-03-01T00:00:00Z');
    AppStatus.findOne.mockReturnValue({ lean: () => Promise.resolve({ emailLastSyncedAt: lastSynced }) });
    UserPreferences.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    gmailService.setupWatch.mockResolvedValue({ historyId: 'fresh-history-id' });
    syncEmailsService.syncEmailsByLookback.mockResolvedValue({ processedCount: 3 });

    const result = await recoverFromExpiredHistoryId('user-1', 'Test User');

    expect(gmailService.setupWatch).toHaveBeenCalledWith('user-1');
    expect(syncEmailsService.syncEmailsByLookback).toHaveBeenCalledWith('user-1', lastSynced);
    expect(result).toBe('fresh-history-id');
  });

  it('falls back to emailSyncStartDate when AppStatus has no emailLastSyncedAt yet', async () => {
    const startDate = new Date('2024-02-01T00:00:00Z');
    AppStatus.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    UserPreferences.findOne.mockReturnValue({ lean: () => Promise.resolve({ emailSyncStartDate: startDate }) });
    gmailService.setupWatch.mockResolvedValue({ historyId: 'fresh-history-id' });
    syncEmailsService.syncEmailsByLookback.mockResolvedValue({ processedCount: 0 });

    await recoverFromExpiredHistoryId('user-1', 'Test User');

    expect(syncEmailsService.syncEmailsByLookback).toHaveBeenCalledWith('user-1', startDate);
  });

  it('falls back to a 24h lookback window when neither AppStatus nor preferences have a date', async () => {
    AppStatus.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    UserPreferences.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    gmailService.setupWatch.mockResolvedValue({ historyId: 'fresh-history-id' });
    syncEmailsService.syncEmailsByLookback.mockResolvedValue({ processedCount: 0 });

    await recoverFromExpiredHistoryId('user-1', 'Test User');

    const [, sinceDateArg] = syncEmailsService.syncEmailsByLookback.mock.calls[0];
    expect(sinceDateArg).toBeInstanceOf(Date);
    expect(Date.now() - sinceDateArg.getTime()).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });
});
