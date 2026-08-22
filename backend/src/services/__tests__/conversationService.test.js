jest.mock('../../models/Invoice', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../models/Ticket', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../models/User', () => ({ findById: jest.fn() }));

function leanQuery(result) {
  return { select: () => ({ lean: () => Promise.resolve(result) }) };
}

const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const Ticket = require('../../models/Ticket');
const User = require('../../models/User');
const {
  buildConversationMessage,
  findExistingConversationEntity,
  appendConversationMessage,
} = require('../conversationService');

describe('conversationService', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildConversationMessage', () => {
    it('marks RECEIVED when the From header does not match the account owner', async () => {
      User.findById.mockReturnValue(leanQuery({ email: 'me@mycompany.com' }));

      const { message, error } = await buildConversationMessage({
        userId,
        messageId: 'msg-1',
        fromHeader: 'Customer <customer@example.com>',
        bodyText: 'Thanks, resolved now.',
        date: 'Mon, 01 Jan 2024 00:00:00 GMT',
        attachments: [],
      });

      expect(error).toBeNull();
      expect(message.direction).toBe('RECEIVED');
      expect(message.sender).toEqual({ name: 'Customer', email: 'customer@example.com' });
    });

    it('marks SENT when the From header matches the account owner', async () => {
      User.findById.mockReturnValue(leanQuery({ email: 'me@mycompany.com' }));

      const { message } = await buildConversationMessage({
        userId,
        messageId: 'msg-2',
        fromHeader: 'Me <me@mycompany.com>',
        bodyText: 'Following up.',
        date: 'Mon, 01 Jan 2024 00:00:00 GMT',
        attachments: [],
      });

      expect(message.direction).toBe('SENT');
    });

    it('maps filename -> fileName and preserves mimeType/size', async () => {
      User.findById.mockReturnValue(leanQuery({ email: 'me@mycompany.com' }));

      const { message } = await buildConversationMessage({
        userId,
        messageId: 'msg-3',
        fromHeader: 'customer@example.com',
        bodyText: 'See attached.',
        date: 'Mon, 01 Jan 2024 00:00:00 GMT',
        attachments: [{ attachmentId: 'a1', filename: 'screenshot.png', mimeType: 'image/png', size: 512 }],
      });

      expect(message.attachments).toEqual([
        { attachmentId: 'a1', fileName: 'screenshot.png', mimeType: 'image/png', size: 512 },
      ]);
    });

    it('returns an error instead of throwing when there is no usable content', async () => {
      User.findById.mockReturnValue(leanQuery({ email: 'me@mycompany.com' }));

      const { message, error } = await buildConversationMessage({
        userId,
        messageId: 'msg-4',
        fromHeader: 'customer@example.com',
        bodyText: '',
        date: 'Mon, 01 Jan 2024 00:00:00 GMT',
        attachments: [],
      });

      expect(message).toBeNull();
      expect(error).toMatch(/content/);
    });
  });

  describe('findExistingConversationEntity', () => {
    it('returns null when threadId is missing', async () => {
      const result = await findExistingConversationEntity({ userId, threadId: null });
      expect(result).toBeNull();
      expect(Invoice.findOne).not.toHaveBeenCalled();
      expect(Ticket.findOne).not.toHaveBeenCalled();
    });

    it('checks Invoice before Ticket, and returns the Invoice match without querying Ticket', async () => {
      const invoiceDoc = { _id: 'invoice-1' };
      Invoice.findOne.mockResolvedValue(invoiceDoc);

      const result = await findExistingConversationEntity({ userId, threadId: 'thread-1' });

      expect(result).toEqual({ type: 'INVOICE', doc: invoiceDoc });
      expect(Ticket.findOne).not.toHaveBeenCalled();
    });

    it('falls back to Ticket when no Invoice matches', async () => {
      Invoice.findOne.mockResolvedValue(null);
      const ticketDoc = { _id: 'ticket-1' };
      Ticket.findOne.mockResolvedValue(ticketDoc);

      const result = await findExistingConversationEntity({ userId, threadId: 'thread-1' });

      expect(result).toEqual({ type: 'TICKET', doc: ticketDoc });
    });

    it('returns null when neither Invoice nor Ticket matches', async () => {
      Invoice.findOne.mockResolvedValue(null);
      Ticket.findOne.mockResolvedValue(null);

      const result = await findExistingConversationEntity({ userId, threadId: 'thread-1' });

      expect(result).toBeNull();
    });
  });

  describe('appendConversationMessage', () => {
    it('pushes the message and reports true when the update actually modified a document', async () => {
      Ticket.updateOne.mockResolvedValue({ modifiedCount: 1 });
      const message = { messageId: 'msg-5', direction: 'RECEIVED', content: 'x', timestamp: new Date(), attachments: [], sender: null };

      const appended = await appendConversationMessage({ type: 'TICKET', doc: { _id: 'ticket-1' }, message });

      expect(appended).toBe(true);
      expect(Ticket.updateOne).toHaveBeenCalledWith(
        { _id: 'ticket-1', 'conversation.messageId': { $ne: 'msg-5' } },
        { $push: { conversation: message } }
      );
    });

    it('reports false (no-op) when a message with this messageId is already present', async () => {
      Ticket.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const message = { messageId: 'msg-5', direction: 'RECEIVED', content: 'x', timestamp: new Date(), attachments: [], sender: null };

      const appended = await appendConversationMessage({ type: 'TICKET', doc: { _id: 'ticket-1' }, message });

      expect(appended).toBe(false);
    });

    it('targets Invoice.updateOne when type is INVOICE', async () => {
      Invoice.updateOne.mockResolvedValue({ modifiedCount: 1 });
      const message = { messageId: 'msg-6', direction: 'SENT', content: 'x', timestamp: new Date(), attachments: [], sender: null };

      await appendConversationMessage({ type: 'INVOICE', doc: { _id: 'invoice-1' }, message });

      expect(Invoice.updateOne).toHaveBeenCalled();
      expect(Ticket.updateOne).not.toHaveBeenCalled();
    });
  });
});
