jest.mock('../../../../models/Entity', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../../../services/displayIdService', () => ({ generateDisplayId: jest.fn() }));
jest.mock('../../../../services/sourceUrlService', () => ({ buildSourceUrl: jest.fn() }));
jest.mock('../../../../services/threadService', () => ({ findOrCreateThread: jest.fn() }));
jest.mock('../../../../utils/emailEncryption', () => ({ decryptClearText: jest.fn() }));

const mongoose = require('mongoose');
const Entity = require('../../../../models/Entity');
const User = require('../../../../models/User');
const { generateDisplayId } = require('../../../../services/displayIdService');
const { buildSourceUrl } = require('../../../../services/sourceUrlService');
const { findOrCreateThread } = require('../../../../services/threadService');
const { decryptClearText } = require('../../../../utils/emailEncryption');
const { createEntityForTypedChild, buildInitialConversationMessage } = require('../entityRepository');

function leanQuery(result) {
  return { select: () => ({ lean: () => Promise.resolve(result) }) };
}

describe('entityRepository — createEntityForTypedChild', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const entityId = new mongoose.Types.ObjectId();
  const emailDoc = { _id: new mongoose.Types.ObjectId(), messageId: 'msg-1', threadId: 'thread-1' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing Entity row without any writes if one already points at this entityId', async () => {
    const existing = { _id: 'entity-doc-1', entityId };
    Entity.findOne.mockResolvedValue(existing);

    const result = await createEntityForTypedChild({ userId, type: 'INVOICE', title: 'Invoice 1', entityId, emailDoc });

    expect(result).toBe(existing);
    expect(buildSourceUrl).not.toHaveBeenCalled();
    expect(findOrCreateThread).not.toHaveBeenCalled();
    expect(generateDisplayId).not.toHaveBeenCalled();
    expect(Entity.create).not.toHaveBeenCalled();
  });

  it('builds source/thread/displayId and creates the Entity row when none exists yet', async () => {
    Entity.findOne.mockResolvedValue(null);
    buildSourceUrl.mockReturnValue('https://mail.google.com/mail/u/0/#all/msg-1');
    findOrCreateThread.mockResolvedValue({ _id: 'thread-doc-1' });
    generateDisplayId.mockResolvedValue('INV-001');
    Entity.create.mockResolvedValue({ _id: 'entity-doc-1' });

    const result = await createEntityForTypedChild({
      userId, type: 'INVOICE', title: 'Invoice 1', entityId, emailDoc, aiModel: 'mock', confidence: 0.8,
    });

    expect(buildSourceUrl).toHaveBeenCalledWith({ provider: 'GMAIL', messageId: 'msg-1' });
    expect(findOrCreateThread).toHaveBeenCalledWith({
      userId, provider: 'GMAIL', providerThreadId: 'thread-1', providerMessageId: 'msg-1',
    });
    expect(generateDisplayId).toHaveBeenCalledWith({ userId, type: 'INVOICE' });

    const [createArg] = Entity.create.mock.calls[0];
    expect(createArg).toMatchObject({
      userId, type: 'INVOICE', displayId: 'INV-001', title: 'Invoice 1', entityId,
      source: {
        type: 'EMAIL', provider: 'GMAIL', url: 'https://mail.google.com/mail/u/0/#all/msg-1',
        emailId: emailDoc._id, threadId: 'thread-doc-1',
      },
      extraction: { status: 'SUCCESS', model: 'mock', confidence: 0.8 },
    });
    expect(result).toEqual({ _id: 'entity-doc-1' });
  });

  it('fetches and returns the winning row on a duplicate-key race instead of erroring', async () => {
    Entity.findOne.mockResolvedValueOnce(null); // initial check finds nothing
    buildSourceUrl.mockReturnValue('https://mail.google.com/mail/u/0/#all/msg-1');
    findOrCreateThread.mockResolvedValue({ _id: 'thread-doc-1' });
    generateDisplayId.mockResolvedValue('INV-001');

    const dupError = new Error('duplicate key');
    dupError.code = 11000;
    Entity.create.mockRejectedValue(dupError);

    const winner = { _id: 'entity-doc-winner', entityId };
    Entity.findOne.mockResolvedValueOnce(winner); // post-race fetch

    const result = await createEntityForTypedChild({ userId, type: 'INVOICE', title: 'Invoice 1', entityId, emailDoc });

    expect(result).toBe(winner);
  });
});

describe('entityRepository — buildInitialConversationMessage', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue(leanQuery({ email: 'me@mycompany.com' }));
  });

  it('marks a message RECEIVED when the From header does not match the account owner', async () => {
    const emailDoc = {
      messageId: 'msg-1', date: 'Mon, 01 Jan 2024 00:00:00 GMT',
      from: { encrypted: 'from' }, encryptedCleanText: { encrypted: 'body' }, attachments: [],
    };
    decryptClearText.mockImplementation((v) => (v.encrypted === 'from' ? 'Vendor Inc <billing@vendor.com>' : 'Please pay the attached invoice.'));

    const message = await buildInitialConversationMessage({ userId, emailDoc });

    expect(message.direction).toBe('RECEIVED');
    expect(message.sender).toEqual({ name: 'Vendor Inc', email: 'billing@vendor.com' });
    expect(message.content).toBe('Please pay the attached invoice.');
  });

  it('marks a message SENT when the From header matches the account owner\'s own email', async () => {
    const emailDoc = {
      messageId: 'msg-2', date: 'Mon, 01 Jan 2024 00:00:00 GMT',
      from: { encrypted: 'from' }, encryptedCleanText: { encrypted: 'body' }, attachments: [],
    };
    decryptClearText.mockImplementation((v) => (v.encrypted === 'from' ? 'Me <me@mycompany.com>' : 'Following up on this.'));

    const message = await buildInitialConversationMessage({ userId, emailDoc });

    expect(message.direction).toBe('SENT');
  });

  it('carries mimeType/size through from EmailToProcess.attachments (filename -> fileName)', async () => {
    const emailDoc = {
      messageId: 'msg-3', date: 'Mon, 01 Jan 2024 00:00:00 GMT',
      from: { encrypted: 'from' }, encryptedCleanText: { encrypted: 'body' },
      attachments: [{ attachmentId: 'a1', filename: 'invoice.pdf', mimeType: 'application/pdf', size: 4096 }],
    };
    decryptClearText.mockImplementation((v) => (v.encrypted === 'from' ? 'billing@vendor.com' : 'See attached.'));

    const message = await buildInitialConversationMessage({ userId, emailDoc });

    expect(message.attachments).toEqual([
      { attachmentId: 'a1', fileName: 'invoice.pdf', mimeType: 'application/pdf', size: 4096 },
    ]);
  });

  it('returns null when there is no usable content to record (e.g. an empty/undecryptable body)', async () => {
    const emailDoc = {
      messageId: 'msg-4', date: 'Mon, 01 Jan 2024 00:00:00 GMT',
      from: { encrypted: 'from' }, encryptedCleanText: { encrypted: 'body' }, attachments: [],
    };
    decryptClearText.mockReturnValue('');

    const message = await buildInitialConversationMessage({ userId, emailDoc });

    expect(message).toBeNull();
  });
});
