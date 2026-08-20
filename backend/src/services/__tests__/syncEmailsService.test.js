jest.mock('../gmailService', () => ({
  fetchMessage: jest.fn(),
}));

jest.mock('../../models/EmailToProcess', () => {
  return jest.fn().mockImplementation(function (doc) {
    Object.assign(this, doc);
    this._id = 'saved-email-id';
    this.save = jest.fn().mockResolvedValue(undefined);
  });
});

jest.mock('../../models/UserPreferences', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../utils/emailEncryption', () => ({
  encryptClearText: jest.fn((value) => (value ? { encrypted: value } : null)),
}));

// extractEmailSnapshot itself isn't under test here (see decisions.md —
// it's currently untestable under this project's plain Jest config, since
// it dynamically `import()`s the ESM-only `email-reply-parser` package and
// Jest isn't configured with --experimental-vm-modules/a babel transform
// for that). These tests only cover what processEmail does with its
// output, so a fixed, realistic return value stands in for it.
jest.mock('../../utils/helpers', () => ({
  extractEmailSnapshot: jest.fn(),
}));

jest.mock('../../controllers/updateAppStatusController', () => ({
  updateAppStatus: jest.fn(),
}));

jest.mock('../emailProcessorService', () => ({
  processEmails: jest.fn().mockResolvedValue({ queuedCount: 1 }),
}));

const gmailService = require('../gmailService');
const EmailToProcess = require('../../models/EmailToProcess');
const UserPreferences = require('../../models/UserPreferences');
const { extractEmailSnapshot } = require('../../utils/helpers');
const { processEmails } = require('../emailProcessorService');
const { processEmail } = require('../syncEmailsService');

function buildGmailMessage({ id, threadId, subject, from }) {
  return {
    id,
    threadId,
    snippet: '',
    payload: {
      headers: [
        { name: 'Subject', value: subject },
        { name: 'From', value: from },
        { name: 'Date', value: 'Mon, 01 Jan 2024 00:00:00 GMT' },
      ],
    },
  };
}

function mockSnapshot({ subject, from, bodyText, threadId }) {
  extractEmailSnapshot.mockResolvedValue({
    metadata: { subject, from },
    encryptedCleanText: { encrypted: bodyText },
    cleanText: bodyText,
    bodyHash: 'hash',
    snippet: bodyText.slice(0, 100),
    threadId,
  });
}

describe('processEmail — classifier ingestion gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists an eligible email with the classifier candidates attached, and triggers autoProcess', async () => {
    const subject = 'Invoice #1234 due';
    const from = 'billing@vendor.com';
    const bodyText = 'Amount due: $500.00. Please pay by the due date.';

    gmailService.fetchMessage.mockResolvedValue(
      buildGmailMessage({ id: 'msg-invoice-1', threadId: 'thread-1', subject, from })
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-1' });
    UserPreferences.findOne.mockResolvedValue({ autoProcess: true });

    const result = await processEmail('user-1', 'msg-invoice-1');

    expect(result).toEqual({ status: 'processed', messageId: 'msg-invoice-1' });
    expect(EmailToProcess).toHaveBeenCalledTimes(1);

    const [savedDoc] = EmailToProcess.mock.calls[0];
    expect(savedDoc.messageId).toBe('msg-invoice-1');
    expect(savedDoc.classification.candidates.length).toBeGreaterThan(0);
    expect(savedDoc.classification.candidates[0].type).toBe('INVOICE');
    expect(savedDoc.classification.candidates[0].score).toBeGreaterThan(0);

    expect(processEmails).toHaveBeenCalledWith({ ids: ['saved-email-id'], userId: 'user-1' });
  });

  it('discards an email that matches no classifier rule set, without persisting or auto-processing it', async () => {
    const subject = 'Weekly team newsletter';
    const from = 'newsletter@company.com';
    const bodyText = "Hope you're having a great week! Check out our blog for updates.";

    gmailService.fetchMessage.mockResolvedValue(
      buildGmailMessage({ id: 'msg-newsletter-1', threadId: 'thread-2', subject, from })
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-2' });

    const result = await processEmail('user-1', 'msg-newsletter-1');

    expect(result).toEqual({ status: 'discarded', messageId: 'msg-newsletter-1' });
    expect(EmailToProcess).not.toHaveBeenCalled();
    expect(UserPreferences.findOne).not.toHaveBeenCalled();
    expect(processEmails).not.toHaveBeenCalled();
  });
});
