const mongoose = require('mongoose');
const Event = require('../Event');
const { validateExtractedEvent } = require('../Event');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validEvent(overrides = {}) {
  return new Event({
    userId: objectId(),
    title: 'Client Demo - Acme Corp',
    description: 'Demo of the new payment dashboard',
    startTime: new Date('2026-08-20T15:00:00Z'),
    endTime: new Date('2026-08-20T16:00:00Z'),
    timezone: 'Asia/Kolkata',
    location: 'Google Meet',
    url: 'https://meet.google.com/abc-defg-hij',
    attendees: [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@acme.com' },
    ],
    organizer: { name: 'Jane Smith', email: 'jane@acme.com' },
    attachments: [{ documentId: 'doc_123', filename: 'meeting-agenda.pdf' }],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    sourceType: 'EMAIL',
    threadId: 'thread_100',
    messageId: 'msg_abc123',
    metadata: {},
    ...overrides,
  });
}

describe('Event — valid creation', () => {
  it('validates a fully-populated Event with no errors', () => {
    expect(validEvent().validateSync()).toBeUndefined();
  });

  it('does not carry a business status field', () => {
    expect(Event.schema.path('status')).toBeUndefined();
  });

  it('does not carry entityType/entityId back-references', () => {
    expect(Event.schema.path('entityType')).toBeUndefined();
    expect(Event.schema.path('entityId')).toBeUndefined();
  });

  it('has no dedicated meetingUrl field — uses the generic url field', () => {
    expect(Event.schema.path('meetingUrl')).toBeUndefined();
    expect(Event.schema.path('url')).toBeDefined();
  });
});

describe('Event — without optional fields', () => {
  it('validates with only the required fields present', () => {
    const event = new Event({
      userId: objectId(),
      title: 'Team Standup',
      startTime: new Date('2026-08-20T09:00:00Z'),
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/xyz',
      sourceType: 'EMAIL',
      messageId: 'msg_xyz',
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.description).toBeNull();
    expect(event.endTime).toBeNull();
    expect(event.timezone).toBeNull();
    expect(event.location).toBeNull();
    expect(event.url).toBeNull();
    expect(event.attendees).toEqual([]);
    expect(event.organizer).toBeNull();
    expect(event.attachments).toEqual([]);
    expect(event.threadId).toBeNull();
  });

  it('has only a start time and no end time', () => {
    const event = validEvent({ endTime: undefined });
    expect(event.validateSync()).toBeUndefined();
    expect(event.endTime).toBeNull();
  });

  it('has no meeting URL', () => {
    const event = validEvent({ url: undefined, location: 'Conference Room A' });
    expect(event.validateSync()).toBeUndefined();
    expect(event.url).toBeNull();
  });

  it('has no attachments', () => {
    const event = validEvent({ attachments: undefined });
    expect(event.validateSync()).toBeUndefined();
    expect(event.attachments).toEqual([]);
  });
});

describe('Event — event/meeting URLs', () => {
  it('accepts a Google Meet URL', () => {
    const event = validEvent({ url: 'https://meet.google.com/abc-defg-hij' });
    expect(event.validateSync()).toBeUndefined();
    expect(event.url).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('accepts a Zoom URL', () => {
    const event = validEvent({ url: 'https://zoom.us/j/123456789' });
    expect(event.validateSync()).toBeUndefined();
    expect(event.url).toBe('https://zoom.us/j/123456789');
  });

  it('accepts a Teams URL', () => {
    const event = validEvent({ url: 'https://teams.microsoft.com/l/meetup-join/abc' });
    expect(event.validateSync()).toBeUndefined();
    expect(event.url).toBe('https://teams.microsoft.com/l/meetup-join/abc');
  });
});

describe('Event — attendees', () => {
  it('accepts a list of attendees with partial info (name-only or email-only)', () => {
    const event = validEvent({
      attendees: [{ name: 'No Email Person' }, { email: 'no-name@example.com' }],
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.attendees).toHaveLength(2);
    expect(event.attendees[0].name).toBe('No Email Person');
    expect(event.attendees[0].email).toBeNull();
    expect(event.attendees[1].name).toBeNull();
    expect(event.attendees[1].email).toBe('no-name@example.com');
  });
});

describe('Event — organizer', () => {
  it('accepts an organizer distinct from attendees', () => {
    const event = validEvent({
      organizer: { name: 'Jane Smith', email: 'jane@acme.com' },
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.organizer.email).toBe('jane@acme.com');
  });

  it('organizer is optional', () => {
    const event = validEvent({ organizer: undefined });
    expect(event.validateSync()).toBeUndefined();
    expect(event.organizer).toBeNull();
  });
});

describe('Event — Document attachments', () => {
  it('references attachments through documentId + filename only (no embedded content)', () => {
    const event = validEvent({
      attachments: [
        { documentId: 'doc_123', filename: 'meeting-agenda.pdf' },
        { documentId: 'doc_456', filename: 'presentation.pdf' },
      ],
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.attachments).toHaveLength(2);
    expect(event.attachments[0].toObject()).toEqual({ documentId: 'doc_123', filename: 'meeting-agenda.pdf' });
    // No storage/content fields exist on the attachment ref sub-schema.
    expect(Event.schema.path('attachments').schema.path('content')).toBeUndefined();
    expect(Event.schema.path('attachments').schema.path('storageKey')).toBeUndefined();
  });
});

describe('Event — required fields', () => {
  it('requires title', () => {
    const error = validEvent({ title: undefined }).validateSync();
    expect(error?.errors?.title).toBeDefined();
  });

  it('requires startTime', () => {
    const error = validEvent({ startTime: undefined }).validateSync();
    expect(error?.errors?.startTime).toBeDefined();
  });

  it('requires sourceUrl', () => {
    const error = validEvent({ sourceUrl: undefined }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });

  it('requires sourceType', () => {
    const error = validEvent({ sourceType: undefined }).validateSync();
    expect(error?.errors?.sourceType).toBeDefined();
  });
});

describe('Event — sourceType validation', () => {
  it.each(['EMAIL', 'DOCUMENT'])('accepts %s', (sourceType) => {
    expect(validEvent({ sourceType }).validateSync()).toBeUndefined();
  });

  it('rejects an invalid sourceType', () => {
    const error = validEvent({ sourceType: 'CALENDAR' }).validateSync();
    expect(error?.errors?.sourceType).toBeDefined();
  });
});

describe('Event — url and sourceUrl remain independent', () => {
  it('keeps url and sourceUrl as separate, unrelated values', () => {
    const event = validEvent({
      url: 'https://meet.google.com/abc-defg-hij',
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.url).not.toBe(event.sourceUrl);
    expect(event.url).toBe('https://meet.google.com/abc-defg-hij');
    expect(event.sourceUrl).toBe('https://mail.google.com/mail/u/0/#all/abc123');
  });

  it('sourceUrl is required even when url is present, and vice versa is not true', () => {
    // url absent, sourceUrl present — valid.
    expect(validEvent({ url: undefined }).validateSync()).toBeUndefined();
    // sourceUrl absent, url present — invalid.
    const error = validEvent({ sourceUrl: undefined, url: 'https://meet.google.com/abc' }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });
});

describe('Event — threadId/messageId provenance', () => {
  it('threadId is optional', () => {
    const event = validEvent({ threadId: undefined });
    expect(event.validateSync()).toBeUndefined();
    expect(event.threadId).toBeNull();
  });

  it('messageId is required when sourceType is EMAIL', () => {
    const error = validEvent({ messageId: undefined }).validateSync();
    expect(error?.errors?.messageId).toBeDefined();
  });

  it('messageId is not required when sourceType is DOCUMENT', () => {
    const error = validEvent({ sourceType: 'DOCUMENT', messageId: undefined }).validateSync();
    expect(error).toBeUndefined();
  });

  it('stores threadId/messageId as plain strings for direct equality matching', () => {
    const event = validEvent({ threadId: 'thread_100', messageId: 'msg_002' });
    expect(event.validateSync()).toBeUndefined();
    expect(event.threadId).toBe('thread_100');
    expect(event.messageId).toBe('msg_002');
  });
});

describe('Event — no source.description equivalent, no top-level status', () => {
  it('does not have a description field duplicated under source-like naming', () => {
    // description is the event's own content, not part of a "source" sub-object —
    // Event has no nested source object at all (unlike Entity).
    expect(Event.schema.path('source')).toBeUndefined();
  });
});

describe('validateExtractedEvent — LLM structured-output validation', () => {
  it('normalizes a well-formed extracted event', () => {
    const { event, error } = validateExtractedEvent({
      title: 'Client Demo - Acme Corp',
      startTime: '2026-08-20T15:00:00Z',
      endTime: '2026-08-20T16:00:00Z',
      timezone: 'Asia/Kolkata',
      url: 'https://meet.google.com/abc-defg-hij',
      attendees: [{ name: 'John Doe', email: 'john@example.com' }],
      organizer: { name: 'Jane Smith', email: 'jane@acme.com' },
      attachments: [{ documentId: 'doc_123', filename: 'agenda.pdf' }],
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
      sourceType: 'EMAIL',
      threadId: 'thread_100',
      messageId: 'msg_abc123',
    });

    expect(error).toBeNull();
    expect(event.title).toBe('Client Demo - Acme Corp');
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.attendees).toHaveLength(1);
    expect(event.organizer.email).toBe('jane@acme.com');
    expect(event.threadId).toBe('thread_100');
    expect(event.messageId).toBe('msg_abc123');
  });

  it('rejects missing title', () => {
    const { event, error } = validateExtractedEvent({
      startTime: '2026-08-20T15:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(event).toBeNull();
    expect(error).toMatch(/title/);
  });

  it('rejects missing/invalid startTime', () => {
    const { event, error } = validateExtractedEvent({
      title: 'Standup',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(event).toBeNull();
    expect(error).toMatch(/startTime/);
  });

  it('rejects missing sourceUrl', () => {
    const { event, error } = validateExtractedEvent({
      title: 'Standup',
      startTime: '2026-08-20T15:00:00Z',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });
    expect(event).toBeNull();
    expect(error).toMatch(/sourceUrl/);
  });

  it('rejects a missing messageId when sourceType is EMAIL', () => {
    const { event, error } = validateExtractedEvent({
      title: 'Standup',
      startTime: '2026-08-20T15:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(event).toBeNull();
    expect(error).toMatch(/messageId/);
  });

  it('rejects an invalid sourceType', () => {
    const { event, error } = validateExtractedEvent({
      title: 'Standup',
      startTime: '2026-08-20T15:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'CALENDAR',
    });
    expect(event).toBeNull();
    expect(error).toMatch(/sourceType/);
  });

  it('drops an attendee/organizer with neither name nor email rather than keeping an empty object', () => {
    const { event } = validateExtractedEvent({
      title: 'Standup',
      startTime: '2026-08-20T15:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
      attendees: [{ name: 'Has Name' }, {}],
      organizer: {},
    });

    expect(event.attendees).toEqual([{ name: 'Has Name', email: null }]);
    expect(event.organizer).toBeNull();
  });

  it('does not invent an end time when none is provided', () => {
    const { event } = validateExtractedEvent({
      title: 'Standup',
      startTime: '2026-08-20T15:00:00Z',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      messageId: 'msg_1',
    });

    expect(event.endTime).toBeNull();
  });

  it('never throws on malformed input', () => {
    expect(() => validateExtractedEvent(null)).not.toThrow();
    expect(() => validateExtractedEvent(undefined)).not.toThrow();
    expect(() => validateExtractedEvent('not an object')).not.toThrow();
    expect(() => validateExtractedEvent({ attendees: 'not an array' })).not.toThrow();
  });
});
