const mongoose = require('mongoose');
const Ticket = require('../Ticket');
const { validateExtractedTicket } = require('../Ticket');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validTicket(overrides = {}) {
  return new Ticket({
    userId: objectId(),
    ticketNumber: 'TICKET-12345',
    title: 'Unable to login into Gmail',
    summary: "User can't access their Gmail account; troubleshooting in progress.",
    status: 'OPEN',
    urgency: 'HIGH',
    priority: 'MEDIUM',
    dueDate: new Date('2026-09-01T00:00:00Z'),
    assignee: { name: 'Support Agent', email: 'agent@example.com' },
    requester: { name: 'Jane Doe', email: 'jane@example.com' },
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    sourceType: 'EMAIL',
    threadId: 'thread_100',
    messageId: 'msg_001',
    ...overrides,
  });
}

describe('Ticket — valid creation', () => {
  it('validates a fully-populated Ticket with no errors', () => {
    expect(validTicket().validateSync()).toBeUndefined();
  });

  it('defaults status to OPEN', () => {
    const ticket = new Ticket({
      userId: objectId(),
      title: 'Something broke',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(ticket.status).toBe('OPEN');
  });

  it('createdOn is just the automatic createdAt timestamp — no separate field exists', () => {
    expect(Ticket.schema.path('createdOn')).toBeUndefined();
    expect(Ticket.schema.path('createdAt')).toBeDefined();
  });
});

describe('Ticket — status', () => {
  it.each(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'])('accepts %s', (status) => {
    expect(validTicket({ status }).validateSync()).toBeUndefined();
  });

  it('rejects an invalid status', () => {
    const error = validTicket({ status: 'ARCHIVED' }).validateSync();
    expect(error?.errors?.status).toBeDefined();
  });
});

describe('Ticket — urgency and priority are independent fields', () => {
  it.each(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])('accepts %s for urgency', (urgency) => {
    expect(validTicket({ urgency }).validateSync()).toBeUndefined();
  });

  it.each(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])('accepts %s for priority', (priority) => {
    expect(validTicket({ priority }).validateSync()).toBeUndefined();
  });

  it('allows urgency and priority to differ (e.g. low urgency, high priority)', () => {
    const ticket = validTicket({ urgency: 'LOW', priority: 'HIGH' });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.urgency).toBe('LOW');
    expect(ticket.priority).toBe('HIGH');
  });

  it('both are optional and never guessed when absent', () => {
    const ticket = validTicket({ urgency: undefined, priority: undefined });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.urgency).toBeNull();
    expect(ticket.priority).toBeNull();
  });

  it('rejects an invalid urgency/priority value', () => {
    expect(validTicket({ urgency: 'SUPER_URGENT' }).validateSync()?.errors?.urgency).toBeDefined();
    expect(validTicket({ priority: 'SUPER_URGENT' }).validateSync()?.errors?.priority).toBeDefined();
  });
});

describe('Ticket — required fields', () => {
  it('requires title', () => {
    const error = validTicket({ title: undefined }).validateSync();
    expect(error?.errors?.title).toBeDefined();
  });

  it('requires sourceUrl', () => {
    const error = validTicket({ sourceUrl: undefined }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });

  it('requires messageId when sourceType is EMAIL', () => {
    const error = validTicket({ messageId: undefined }).validateSync();
    expect(error?.errors?.messageId).toBeDefined();
  });
});

describe('Ticket — optional fields not invented when absent', () => {
  it('validates with only required fields', () => {
    const ticket = new Ticket({
      userId: objectId(),
      title: 'Something broke',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });

    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.ticketNumber).toBeNull();
    expect(ticket.summary).toBeNull();
    expect(ticket.dueDate).toBeNull();
    expect(ticket.assignee).toBeNull();
    expect(ticket.requester).toBeNull();
    expect(ticket.conversation).toEqual([]);
    expect(ticket.parentTicketId).toBeNull();
    expect(ticket.duplicateOfTicketId).toBeNull();
  });
});

describe('Ticket — assignee is manual/mock-selectable, never set by extraction', () => {
  it('the schema allows an assignee to be set directly (by a human/mock action)', () => {
    const ticket = validTicket({ assignee: { name: 'Support Agent', email: 'agent@example.com' } });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.assignee.email).toBe('agent@example.com');
  });

  it('validateExtractedTicket always forces assignee to null, regardless of what the AI output contains', () => {
    const { ticket } = validateExtractedTicket({
      title: 'Something broke',
      assignee: { name: 'Should Be Ignored', email: 'ignored@example.com' },
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(ticket.assignee).toBeNull();
  });
});

describe('Ticket — requester can be populated from extraction', () => {
  it('normalizes a requester with partial info', () => {
    const ticket = validTicket({ requester: { email: 'jane@example.com' } });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.requester.name).toBeNull();
    expect(ticket.requester.email).toBe('jane@example.com');
  });
});

describe('Ticket — conversation with attachments (shared schema)', () => {
  it('accepts a conversation message with attachments', () => {
    const ticket = validTicket({
      conversation: [
        {
          messageId: 'msg_001',
          direction: 'RECEIVED',
          content: 'Unable to login, see screenshot attached.',
          timestamp: new Date(),
          attachments: [{ attachmentId: 'att_1', fileName: 'screenshot.png' }],
        },
      ],
    });

    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.conversation[0].attachments[0].toObject()).toEqual({
      attachmentId: 'att_1',
      fileName: 'screenshot.png',
      mimeType: null,
      size: null,
    });
  });

  it('uses the exact same conversation-message shape as Invoice (shared schema)', () => {
    const Invoice = require('../Invoice');
    expect(Ticket.schema.path('conversation').schema).toBe(Invoice.schema.path('conversation').schema);
  });

  it('does not use a fromUser boolean', () => {
    const schema = Ticket.schema.path('conversation').schema;
    expect(schema.path('fromUser')).toBeUndefined();
    expect(schema.path('direction')).toBeDefined();
  });
});

describe('Ticket — parent/duplicate relationships', () => {
  it('accepts a parentTicketId reference', () => {
    const parentId = objectId();
    const ticket = validTicket({ parentTicketId: parentId });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.parentTicketId.toString()).toBe(parentId.toString());
  });

  it('accepts a duplicateOfTicketId reference', () => {
    const canonicalId = objectId();
    const ticket = validTicket({ duplicateOfTicketId: canonicalId });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.duplicateOfTicketId.toString()).toBe(canonicalId.toString());
  });

  it('has no childTicketIds/duplicateTicketIds array — relationships are queried, not duplicated', () => {
    expect(Ticket.schema.path('childTicketIds')).toBeUndefined();
    expect(Ticket.schema.path('duplicateTicketIds')).toBeUndefined();
  });

  it('validateExtractedTicket always forces parentTicketId/duplicateOfTicketId to null', () => {
    const { ticket } = validateExtractedTicket({
      title: 'Something broke',
      parentTicketId: 'should_be_ignored',
      duplicateOfTicketId: 'should_be_ignored',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(ticket.parentTicketId).toBeNull();
    expect(ticket.duplicateOfTicketId).toBeNull();
  });
});

describe('Ticket — ticketNumber', () => {
  it('only populated when actually present — not generated', () => {
    const ticket = validTicket({ ticketNumber: undefined });
    expect(ticket.validateSync()).toBeUndefined();
    expect(ticket.ticketNumber).toBeNull();
  });
});

describe('validateExtractedTicket — LLM structured-output validation', () => {
  it('normalizes a well-formed extracted ticket, defaulting to OPEN', () => {
    const { ticket, error } = validateExtractedTicket({
      ticketNumber: 'TICKET-12345',
      title: 'Unable to login into Gmail',
      summary: "User can't access their Gmail account.",
      urgency: 'HIGH',
      priority: 'MEDIUM',
      requester: { name: 'Jane Doe', email: 'jane@example.com' },
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
      sourceType: 'EMAIL',
      threadId: 'thread_100',
      messageId: 'msg_001',
    });

    expect(error).toBeNull();
    expect(ticket.status).toBe('OPEN');
    expect(ticket.urgency).toBe('HIGH');
    expect(ticket.requester.email).toBe('jane@example.com');
  });

  it('rejects missing title', () => {
    const { ticket, error } = validateExtractedTicket({
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(ticket).toBeNull();
    expect(error).toMatch(/title/);
  });

  it('rejects missing sourceUrl', () => {
    const { ticket, error } = validateExtractedTicket({
      title: 'Something broke',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(ticket).toBeNull();
    expect(error).toMatch(/sourceUrl/);
  });

  it('rejects missing messageId when sourceType is EMAIL', () => {
    const { ticket, error } = validateExtractedTicket({
      title: 'Something broke',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(ticket).toBeNull();
    expect(error).toMatch(/messageId/);
  });

  it('falls back to null for an invalid urgency/priority rather than throwing', () => {
    const { ticket, error } = validateExtractedTicket({
      title: 'Something broke',
      urgency: 'NOT_A_REAL_LEVEL',
      priority: 'ALSO_NOT_REAL',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(error).toBeNull();
    expect(ticket.urgency).toBeNull();
    expect(ticket.priority).toBeNull();
  });

  it('never throws on malformed input', () => {
    expect(() => validateExtractedTicket(null)).not.toThrow();
    expect(() => validateExtractedTicket(undefined)).not.toThrow();
    expect(() => validateExtractedTicket({ requester: 'not an object' })).not.toThrow();
  });
});
