const mongoose = require('mongoose');
const Entity = require('../Entity');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validTicketEntity(overrides = {}) {
  return new Entity({
    userId: objectId(),
    type: 'TICKET',
    title: 'Unable to login into Gmail',
    source: {
      type: 'EMAIL',
      provider: 'GMAIL',
      url: 'https://mail.google.com/mail/u/0/#all/abc123',
      emailId: objectId(),
      threadId: objectId(),
    },
    entityId: objectId(),
    extraction: {
      status: 'SUCCESS',
      model: 'gemini-1.5-flash',
      confidence: 0.92,
      extractedAt: new Date(),
    },
    ...overrides,
  });
}

describe('Entity — valid document', () => {
  it('validates a well-formed TICKET entity with no errors', () => {
    const error = validTicketEntity().validateSync();
    expect(error).toBeUndefined();
  });

  it('does not embed or duplicate typed-entity fields — only common metadata + provenance', () => {
    const entity = validTicketEntity();
    expect(entity.toObject()).not.toHaveProperty('description');
    expect(entity.toObject()).not.toHaveProperty('priority');
    expect(entity.toObject()).not.toHaveProperty('data');
  });
});

describe('Entity — type', () => {
  it.each(['TICKET', 'INVOICE', 'PAYMENT', 'EVENT', 'DOCUMENT'])('accepts %s', (type) => {
    const error = validTicketEntity({ type }).validateSync();
    expect(error).toBeUndefined();
  });

  it('rejects an arbitrary/unknown type', () => {
    const error = validTicketEntity({ type: 'UNKNOWN' }).validateSync();
    expect(error?.errors?.type).toBeDefined();
  });

  it('requires a type', () => {
    const error = validTicketEntity({ type: undefined }).validateSync();
    expect(error?.errors?.type).toBeDefined();
  });
});

describe('Entity — no generic business status', () => {
  it('has no top-level status field in the schema', () => {
    expect(Entity.schema.path('status')).toBeUndefined();
  });

  it('the only status in the schema is extraction.status', () => {
    expect(Entity.schema.path('extraction.status')).toBeDefined();
  });
});

describe('Entity — extraction.status', () => {
  it.each(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])('accepts %s', (status) => {
    const error = validTicketEntity({ extraction: { status } }).validateSync();
    expect(error).toBeUndefined();
  });

  it('rejects an invalid extraction status', () => {
    const error = validTicketEntity({ extraction: { status: 'DONE' } }).validateSync();
    expect(error?.errors?.['extraction.status']).toBeDefined();
  });

  it('requires extraction', () => {
    const error = validTicketEntity({ extraction: undefined }).validateSync();
    expect(error?.errors?.extraction).toBeDefined();
  });
});

describe('Entity — extraction.confidence', () => {
  it('accepts values within [0, 1]', () => {
    expect(validTicketEntity({ extraction: { status: 'SUCCESS', confidence: 0 } }).validateSync()).toBeUndefined();
    expect(validTicketEntity({ extraction: { status: 'SUCCESS', confidence: 1 } }).validateSync()).toBeUndefined();
    expect(validTicketEntity({ extraction: { status: 'SUCCESS', confidence: 0.5 } }).validateSync()).toBeUndefined();
  });

  it('rejects confidence below 0', () => {
    const error = validTicketEntity({ extraction: { status: 'SUCCESS', confidence: -0.1 } }).validateSync();
    expect(error?.errors?.['extraction.confidence']).toBeDefined();
  });

  it('rejects confidence above 1', () => {
    const error = validTicketEntity({ extraction: { status: 'SUCCESS', confidence: 1.1 } }).validateSync();
    expect(error?.errors?.['extraction.confidence']).toBeDefined();
  });

  it('confidence is optional (e.g. while still PENDING)', () => {
    const error = validTicketEntity({ extraction: { status: 'PENDING' } }).validateSync();
    expect(error).toBeUndefined();
  });
});

describe('Entity — required top-level fields', () => {
  it.each(['userId', 'type', 'title', 'source', 'entityId', 'extraction'])('requires %s', (field) => {
    const error = validTicketEntity({ [field]: undefined }).validateSync();
    expect(error?.errors?.[field]).toBeDefined();
  });
});

describe('Entity — source', () => {
  it('requires source.type, source.provider, source.url', () => {
    const error = validTicketEntity({
      source: { type: undefined, provider: undefined, url: undefined, emailId: objectId(), threadId: objectId() },
    }).validateSync();

    expect(error?.errors?.['source.type']).toBeDefined();
    expect(error?.errors?.['source.provider']).toBeDefined();
    expect(error?.errors?.['source.url']).toBeDefined();
  });

  it('requires source.emailId and source.threadId when source.type is EMAIL', () => {
    const error = validTicketEntity({
      source: {
        type: 'EMAIL',
        provider: 'GMAIL',
        url: 'https://mail.google.com/mail/u/0/#all/abc123',
        emailId: undefined,
        threadId: undefined,
      },
    }).validateSync();

    expect(error?.errors?.['source.emailId']).toBeDefined();
    expect(error?.errors?.['source.threadId']).toBeDefined();
  });

  it('preserves emailId and threadId references', () => {
    const emailId = objectId();
    const threadId = objectId();
    const entity = validTicketEntity({
      source: {
        type: 'EMAIL',
        provider: 'GMAIL',
        url: 'https://mail.google.com/mail/u/0/#all/abc123',
        emailId,
        threadId,
      },
    });

    expect(entity.validateSync()).toBeUndefined();
    expect(entity.source.emailId.toString()).toBe(emailId.toString());
    expect(entity.source.threadId.toString()).toBe(threadId.toString());
  });

  it('rejects an unsupported source provider', () => {
    const error = validTicketEntity({
      source: {
        type: 'EMAIL',
        provider: 'OUTLOOK',
        url: 'https://example.com',
        emailId: objectId(),
        threadId: objectId(),
      },
    }).validateSync();

    expect(error?.errors?.['source.provider']).toBeDefined();
  });

  it('does not have a source.description field in the schema', () => {
    expect(Entity.schema.path('source.description')).toBeUndefined();
  });
});
