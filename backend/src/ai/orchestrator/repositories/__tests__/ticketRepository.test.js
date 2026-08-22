jest.mock('../../../../models/Ticket', () => {
  const mockCtor = jest.fn();
  mockCtor.findOne = jest.fn();
  mockCtor.create = jest.fn();
  mockCtor.validateExtractedTicket = jest.fn();
  return mockCtor;
});
jest.mock('../../../../services/sourceUrlService', () => ({ buildSourceUrl: jest.fn() }));
jest.mock('../entityRepository', () => ({
  createEntityForTypedChild: jest.fn(),
  buildInitialConversationMessage: jest.fn(),
}));

const mongoose = require('mongoose');
const Ticket = require('../../../../models/Ticket');
const { buildSourceUrl } = require('../../../../services/sourceUrlService');
const { createEntityForTypedChild, buildInitialConversationMessage } = require('../entityRepository');
const { persistTicket } = require('../ticketRepository');

describe('ticketRepository', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const emailDoc = { _id: new mongoose.Types.ObjectId(), messageId: 'msg-1', threadId: 'thread-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    buildSourceUrl.mockReturnValue('https://mail.google.com/mail/u/0/#all/msg-1');
    createEntityForTypedChild.mockResolvedValue({ _id: 'entity-1' });
    buildInitialConversationMessage.mockResolvedValue(null);
  });

  describe('persistTicket', () => {
    it('returns the existing Ticket + ensures its Entity row exists, without re-validating or re-creating', async () => {
      const existing = { _id: 'ticket-1', title: 'Unable to login' };
      Ticket.findOne.mockResolvedValue(existing);

      const result = await persistTicket({ userId, emailDoc, extracted: { title: 'Something else' } });

      expect(Ticket.create).not.toHaveBeenCalled();
      expect(Ticket.validateExtractedTicket).not.toHaveBeenCalled();
      expect(buildInitialConversationMessage).not.toHaveBeenCalled();
      expect(createEntityForTypedChild).toHaveBeenCalledWith(expect.objectContaining({
        userId, type: 'TICKET', entityId: 'ticket-1',
      }));
      expect(result).toEqual({ ticket: existing, entity: { _id: 'entity-1' }, error: null });
    });

    it('propagates a validation error without creating anything', async () => {
      Ticket.findOne.mockResolvedValue(null);
      Ticket.validateExtractedTicket.mockReturnValue({ ticket: null, error: 'Extracted ticket is missing a required "title"' });

      const result = await persistTicket({ userId, emailDoc, extracted: {} });

      expect(Ticket.create).not.toHaveBeenCalled();
      expect(createEntityForTypedChild).not.toHaveBeenCalled();
      expect(result.error).toMatch(/title/);
    });

    it('defaults conversation to [] when buildInitialConversationMessage finds nothing usable', async () => {
      Ticket.findOne.mockResolvedValue(null);
      Ticket.validateExtractedTicket.mockImplementation((raw) => ({ ticket: raw, error: null }));
      Ticket.create.mockResolvedValue({ _id: 'ticket-new', title: 'Unable to login' });

      await persistTicket({ userId, emailDoc, extracted: { title: 'Unable to login' } });

      const [rawPassedToValidate] = Ticket.validateExtractedTicket.mock.calls[0];
      expect(rawPassedToValidate.conversation).toEqual([]);
    });

    it('seeds conversation[] with the triggering email when buildInitialConversationMessage finds one', async () => {
      Ticket.findOne.mockResolvedValue(null);
      Ticket.validateExtractedTicket.mockImplementation((raw) => ({ ticket: raw, error: null }));
      Ticket.create.mockResolvedValue({ _id: 'ticket-new', title: 'Unable to login' });
      const seededMessage = {
        messageId: 'msg-1', direction: 'RECEIVED', content: 'Unable to login, see attached.', timestamp: new Date(), attachments: [], sender: { name: 'Customer', email: 'customer@example.com' },
      };
      buildInitialConversationMessage.mockResolvedValue(seededMessage);

      await persistTicket({ userId, emailDoc, extracted: { title: 'Unable to login' } });

      expect(buildInitialConversationMessage).toHaveBeenCalledWith({ userId, emailDoc });
      const [rawPassedToValidate] = Ticket.validateExtractedTicket.mock.calls[0];
      expect(rawPassedToValidate.conversation).toEqual([seededMessage]);
    });

    it('fetches the existing Ticket on a duplicate-key race instead of erroring', async () => {
      Ticket.findOne.mockResolvedValueOnce(null);
      Ticket.validateExtractedTicket.mockReturnValue({ ticket: { title: 'Unable to login' }, error: null });

      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      Ticket.create.mockRejectedValue(dupError);

      const winner = { _id: 'ticket-winner', title: 'Unable to login' };
      Ticket.findOne.mockResolvedValueOnce(winner);

      const result = await persistTicket({ userId, emailDoc, extracted: { title: 'Unable to login' } });

      expect(result.ticket).toBe(winner);
    });
  });
});
