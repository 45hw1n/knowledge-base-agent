jest.mock('../gmailService', () => ({
  fetchMessage: jest.fn(),
  listMessages: jest.fn(),
}));

jest.mock('../../models/AppStatus', () => ({
  findOne: jest.fn(),
}));

// Used by conversationService.js's thread-reconciliation check, which now
// runs on every processEmail() call before classification.
jest.mock('../../models/Invoice', () => ({ findOne: jest.fn() }));
jest.mock('../../models/Ticket', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../models/User', () => ({ findById: jest.fn() }));

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
const AppStatus = require('../../models/AppStatus');
const Invoice = require('../../models/Invoice');
const Ticket = require('../../models/Ticket');
const { extractEmailSnapshot } = require('../../utils/helpers');
const { processEmails } = require('../emailProcessorService');
const { processEmail, syncRecentEmails } = require('../syncEmailsService');

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
    // No existing Invoice/Ticket on this thread by default — the
    // reconciliation check falls through to the normal classify/save path.
    Invoice.findOne.mockResolvedValue(null);
    Ticket.findOne.mockResolvedValue(null);
  });

  it('persists an eligible email with the classifier candidates attached, returning its saved emailId', async () => {
    const subject = 'Invoice #1234 due';
    const from = 'billing@vendor.com';
    const bodyText = 'Amount due: $500.00. Please pay by the due date.';

    gmailService.fetchMessage.mockResolvedValue(
      buildGmailMessage({ id: 'msg-invoice-1', threadId: 'thread-1', subject, from })
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-1' });

    const result = await processEmail('user-1', 'msg-invoice-1');

    // autoProcess triggering is now the sync-loop caller's job (batched
    // across the whole call — see syncRecentEmails tests below), not
    // processEmail's — so no UserPreferences/processEmails calls here.
    expect(result).toEqual({ status: 'processed', messageId: 'msg-invoice-1', emailId: 'saved-email-id' });
    expect(EmailToProcess).toHaveBeenCalledTimes(1);
    expect(UserPreferences.findOne).not.toHaveBeenCalled();
    expect(processEmails).not.toHaveBeenCalled();

    const [savedDoc] = EmailToProcess.mock.calls[0];
    expect(savedDoc.messageId).toBe('msg-invoice-1');
    expect(savedDoc.classification.candidates.length).toBeGreaterThan(0);
    expect(savedDoc.classification.candidates[0].type).toBe('INVOICE');
    expect(savedDoc.classification.candidates[0].score).toBeGreaterThan(0);
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

  it('appends a reply to an existing Ticket\'s conversation[] instead of classifying it as a new entity — even with zero classifier signal', async () => {
    const User = require('../../models/User');
    User.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ email: 'me@mycompany.com' }) }) });

    const subject = 'Re: Unable to connect to VPN';
    const from = 'customer@example.com';
    // Deliberately no problem/request language — this reply would match no
    // classifier rule on its own, yet must still be captured because it's
    // on a thread Cortex already has a Ticket for.
    const bodyText = 'Thanks, it is working now.';

    gmailService.fetchMessage.mockResolvedValue(
      buildGmailMessage({ id: 'msg-reply-1', threadId: 'thread-vpn', subject, from })
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-vpn' });

    const existingTicket = { _id: 'ticket-1' };
    Ticket.findOne.mockResolvedValue(existingTicket);
    Ticket.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await processEmail('user-1', 'msg-reply-1');

    expect(result).toEqual({
      status: 'appended_to_conversation', messageId: 'msg-reply-1', entityType: 'TICKET', entityId: 'ticket-1',
    });
    expect(Ticket.updateOne).toHaveBeenCalledWith(
      { _id: 'ticket-1', 'conversation.messageId': { $ne: 'msg-reply-1' } },
      { $push: { conversation: expect.objectContaining({ content: bodyText, direction: 'RECEIVED' }) } }
    );
    // Never reaches classification/persistence — it was already handled.
    expect(EmailToProcess).not.toHaveBeenCalled();
    expect(processEmails).not.toHaveBeenCalled();
  });
});

describe('syncRecentEmails — autoProcess batching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppStatus.findOne.mockResolvedValue(null);
    Invoice.findOne.mockResolvedValue(null);
    Ticket.findOne.mockResolvedValue(null);
  });

  it('batches every eligible email from one sync call into a single processEmails() call, not one per email', async () => {
    const subject = 'Invoice due';
    const from = 'billing@vendor.com';
    const bodyText = 'Amount due: $500.00. Please pay by the due date.';

    gmailService.listMessages.mockResolvedValue([
      { id: 'msg-invoice-1' },
      { id: 'msg-invoice-2' },
    ]);
    gmailService.fetchMessage.mockImplementation((_userId, messageId) =>
      Promise.resolve(buildGmailMessage({ id: messageId, threadId: 'thread-1', subject, from }))
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-1' });
    UserPreferences.findOne.mockResolvedValue({ autoProcess: true });

    await syncRecentEmails('user-1');

    expect(EmailToProcess).toHaveBeenCalledTimes(2);
    // One coordinated call for the whole batch, not two racing ones.
    expect(processEmails).toHaveBeenCalledTimes(1);
    expect(processEmails).toHaveBeenCalledWith({
      ids: ['saved-email-id', 'saved-email-id'],
      userId: 'user-1',
    });
  });

  it('does not call processEmails when autoProcess is disabled', async () => {
    const subject = 'Invoice due';
    const from = 'billing@vendor.com';
    const bodyText = 'Amount due: $500.00. Please pay by the due date.';

    gmailService.listMessages.mockResolvedValue([{ id: 'msg-invoice-1' }]);
    gmailService.fetchMessage.mockResolvedValue(
      buildGmailMessage({ id: 'msg-invoice-1', threadId: 'thread-1', subject, from })
    );
    mockSnapshot({ subject, from, bodyText, threadId: 'thread-1' });
    UserPreferences.findOne.mockResolvedValue({ autoProcess: false });

    await syncRecentEmails('user-1');

    expect(processEmails).not.toHaveBeenCalled();
  });
});
