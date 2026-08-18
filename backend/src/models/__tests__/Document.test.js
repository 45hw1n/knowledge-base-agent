const mongoose = require('mongoose');
const Document = require('../Document');
const { validateExtractedDocument } = require('../Document');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function validDocument(overrides = {}) {
  return new Document({
    userId: objectId(),
    type: 'NDA',
    title: 'Mutual Non-Disclosure Agreement - Acme Corp',
    description: 'Mutual NDA between Acme Corporation and Zamp.',
    summary:
      'Overview\n\nThis is a mutual non-disclosure agreement between Acme Corporation and Zamp. ' +
      'The agreement governs how confidential information exchanged between both parties should be handled.',
    documentNumber: 'NDA-2026-1042',
    issuer: { name: 'Acme Corporation', email: 'legal@acme.com' },
    parties: [
      { name: 'Acme Corporation', role: 'CUSTOMER' },
      { name: 'Zamp', role: 'VENDOR' },
    ],
    effectiveDate: new Date('2026-08-01T00:00:00Z'),
    expiryDate: new Date('2028-08-01T00:00:00Z'),
    attachments: [{ attachmentId: 'att_123', fileName: 'acme-nda-2026.pdf' }],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    sourceType: 'EMAIL',
    metadata: {},
    ...overrides,
  });
}

describe('Document — valid creation', () => {
  it('validates a fully-populated Document with no errors', () => {
    expect(validDocument().validateSync()).toBeUndefined();
  });

  it('does not carry a business status field', () => {
    expect(Document.schema.path('status')).toBeUndefined();
  });

  it('does not carry entityType/entityId back-references', () => {
    expect(Document.schema.path('entityType')).toBeUndefined();
    expect(Document.schema.path('entityId')).toBeUndefined();
  });

  it('does not carry generic file-storage fields (those belong to the physical file model)', () => {
    for (const field of ['filename', 'mimeType', 'fileSize', 'storagePath', 'bucket']) {
      expect(Document.schema.path(field)).toBeUndefined();
    }
  });
});

describe('Document — all supported types', () => {
  it.each([
    'CONTRACT',
    'NDA',
    'TERMS_AND_CONDITIONS',
    'PRIVACY_POLICY',
    'COMPLIANCE',
    'CERTIFICATE',
    'LICENSE',
    'AGREEMENT',
    'POLICY',
    'OTHER',
  ])('accepts %s', (type) => {
    expect(validDocument({ type }).validateSync()).toBeUndefined();
  });

  it('rejects an invalid/unknown type', () => {
    const error = validDocument({ type: 'MEMO' }).validateSync();
    expect(error?.errors?.type).toBeDefined();
  });
});

describe('Document — only required fields', () => {
  it('validates with only the required fields present', () => {
    const doc = new Document({
      userId: objectId(),
      type: 'OTHER',
      title: 'Untitled Policy',
      summary: 'A short summary of the document content.',
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/xyz',
      sourceType: 'EMAIL',
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.description).toBeNull();
    expect(doc.documentNumber).toBeNull();
    expect(doc.issuer).toBeNull();
    expect(doc.parties).toEqual([]);
    expect(doc.effectiveDate).toBeNull();
    expect(doc.expiryDate).toBeNull();
    expect(doc.attachments).toEqual([]);
  });
});

describe('Document — optional fields', () => {
  it('accepts a document with issuer', () => {
    const doc = validDocument({ issuer: { name: 'Acme Corporation', email: 'legal@acme.com' } });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.issuer.email).toBe('legal@acme.com');
  });

  it('issuer is optional', () => {
    const doc = validDocument({ issuer: undefined });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.issuer).toBeNull();
  });

  it('accepts multiple parties with flexible, non-enum roles', () => {
    const doc = validDocument({
      parties: [
        { name: 'Acme Corporation', role: 'CUSTOMER' },
        { name: 'Zamp', role: 'VENDOR' },
        { name: 'Some Other Org' }, // no role — not forced
      ],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.parties).toHaveLength(3);
    expect(doc.parties[2].role).toBeNull();
  });

  it('does not restrict party.role to a fixed enum', () => {
    // The spec explicitly asks for role to "remain flexible" — an
    // unlisted role string must still validate.
    const doc = validDocument({ parties: [{ name: 'Some Org', role: 'WITNESS' }] });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe('Document — effective/expiry dates', () => {
  it('accepts both effective and expiry dates', () => {
    const doc = validDocument({
      effectiveDate: new Date('2026-08-01T00:00:00Z'),
      expiryDate: new Date('2028-08-01T00:00:00Z'),
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.effectiveDate).toBeInstanceOf(Date);
    expect(doc.expiryDate).toBeInstanceOf(Date);
  });

  it('validates without an expiry date (e.g. some Terms & Conditions)', () => {
    const doc = validDocument({ expiryDate: undefined });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.expiryDate).toBeNull();
  });
});

describe('Document — attachments', () => {
  it('accepts a document with attachments, referenced correctly', () => {
    const doc = validDocument({
      attachments: [{ attachmentId: 'att_123', fileName: 'acme-nda-2026.pdf' }],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.attachments[0].toObject()).toEqual({ attachmentId: 'att_123', fileName: 'acme-nda-2026.pdf' });
  });

  it('accepts multiple attachments', () => {
    const doc = validDocument({
      attachments: [
        { attachmentId: 'att_123', fileName: 'main-agreement.pdf' },
        { attachmentId: 'att_456', fileName: 'annexure-a.pdf' },
        { attachmentId: 'att_789', fileName: 'pricing-schedule.pdf' },
      ],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.attachments).toHaveLength(3);
  });

  it('validates with no attachments', () => {
    const doc = validDocument({ attachments: undefined });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.attachments).toEqual([]);
  });

  it('uses the project\'s existing attachmentId/fileName naming, not fileId/filename', () => {
    const attachmentSchema = Document.schema.path('attachments').schema;
    expect(attachmentSchema.path('attachmentId')).toBeDefined();
    expect(attachmentSchema.path('fileName')).toBeDefined();
    expect(attachmentSchema.path('fileId')).toBeUndefined();
    expect(attachmentSchema.path('filename')).toBeUndefined();
  });

  it('attachment references carry no storage metadata (content lives on the physical file model)', () => {
    const attachmentSchema = Document.schema.path('attachments').schema;
    expect(attachmentSchema.path('storageKey')).toBeUndefined();
    expect(attachmentSchema.path('mimeType')).toBeUndefined();
    expect(attachmentSchema.path('size')).toBeUndefined();
  });
});

describe('Document — required fields', () => {
  it('requires title', () => {
    const error = validDocument({ title: undefined }).validateSync();
    expect(error?.errors?.title).toBeDefined();
  });

  it('requires summary', () => {
    const error = validDocument({ summary: undefined }).validateSync();
    expect(error?.errors?.summary).toBeDefined();
  });

  it('requires sourceUrl', () => {
    const error = validDocument({ sourceUrl: undefined }).validateSync();
    expect(error?.errors?.sourceUrl).toBeDefined();
  });

  it('requires type', () => {
    const error = validDocument({ type: undefined }).validateSync();
    expect(error?.errors?.type).toBeDefined();
  });

  it('requires sourceType', () => {
    const error = validDocument({ sourceType: undefined }).validateSync();
    expect(error?.errors?.sourceType).toBeDefined();
  });
});

describe('Document — sourceType validation', () => {
  it.each(['EMAIL', 'DOCUMENT'])('accepts %s', (sourceType) => {
    expect(validDocument({ sourceType }).validateSync()).toBeUndefined();
  });

  it('rejects an invalid sourceType', () => {
    const error = validDocument({ sourceType: 'UPLOAD' }).validateSync();
    expect(error?.errors?.sourceType).toBeDefined();
  });
});

describe('Document — sourceUrl preservation', () => {
  it('preserves the exact sourceUrl value', () => {
    const doc = validDocument({ sourceUrl: 'https://mail.google.com/mail/u/0/#all/xyz789' });
    expect(doc.sourceUrl).toBe('https://mail.google.com/mail/u/0/#all/xyz789');
  });
});

describe('Document — metadata', () => {
  it('defaults to an empty object', () => {
    const doc = validDocument({ metadata: undefined });
    expect(doc.metadata).toEqual({});
  });

  it('preserves arbitrary document-specific metadata', () => {
    const doc = validDocument({ metadata: { governingLaw: 'Delaware', renewalTerm: '1 year' } });
    expect(doc.metadata).toEqual({ governingLaw: 'Delaware', renewalTerm: '1 year' });
  });
});

describe('validateExtractedDocument — LLM structured-output validation', () => {
  it('normalizes a well-formed extracted document', () => {
    const { document, error } = validateExtractedDocument({
      type: 'NDA',
      title: 'Mutual NDA - Acme Corp',
      summary: 'Overview... key terms... important dates...',
      documentNumber: 'NDA-2026-1042',
      issuer: { name: 'Acme Corporation', email: 'legal@acme.com' },
      parties: [
        { name: 'Acme Corporation', role: 'CUSTOMER' },
        { name: 'Zamp', role: 'VENDOR' },
      ],
      effectiveDate: '2026-08-01T00:00:00Z',
      expiryDate: '2028-08-01T00:00:00Z',
      attachments: [{ attachmentId: 'att_123', fileName: 'acme-nda-2026.pdf' }],
      sourceUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
      sourceType: 'EMAIL',
    });

    expect(error).toBeNull();
    expect(document.type).toBe('NDA');
    expect(document.effectiveDate).toBeInstanceOf(Date);
    expect(document.expiryDate).toBeInstanceOf(Date);
    expect(document.parties).toHaveLength(2);
    expect(document.issuer.email).toBe('legal@acme.com');
  });

  it('rejects missing title', () => {
    const { document, error } = validateExtractedDocument({
      type: 'NDA',
      summary: 'summary text',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(document).toBeNull();
    expect(error).toMatch(/title/);
  });

  it('rejects missing summary', () => {
    const { document, error } = validateExtractedDocument({
      type: 'NDA',
      title: 'Some Doc',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(document).toBeNull();
    expect(error).toMatch(/summary/);
  });

  it('rejects missing sourceUrl', () => {
    const { document, error } = validateExtractedDocument({
      type: 'NDA',
      title: 'Some Doc',
      summary: 'summary text',
      sourceType: 'EMAIL',
    });
    expect(document).toBeNull();
    expect(error).toMatch(/sourceUrl/);
  });

  it('rejects an invalid type', () => {
    const { document, error } = validateExtractedDocument({
      type: 'MEMO',
      title: 'Some Doc',
      summary: 'summary text',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });
    expect(document).toBeNull();
    expect(error).toMatch(/type/);
  });

  it('rejects an invalid sourceType', () => {
    const { document, error } = validateExtractedDocument({
      type: 'NDA',
      title: 'Some Doc',
      summary: 'summary text',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'UPLOAD',
    });
    expect(document).toBeNull();
    expect(error).toMatch(/sourceType/);
  });

  it('does not fabricate a documentNumber, effectiveDate, or expiryDate when absent', () => {
    const { document } = validateExtractedDocument({
      type: 'TERMS_AND_CONDITIONS',
      title: 'Terms and Conditions',
      summary: 'These terms govern use of the service.',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });

    expect(document.documentNumber).toBeNull();
    expect(document.effectiveDate).toBeNull();
    expect(document.expiryDate).toBeNull();
  });

  it('does not force a role onto a party when none is given', () => {
    const { document } = validateExtractedDocument({
      type: 'AGREEMENT',
      title: 'Vendor Agreement',
      summary: 'Summary text.',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
      parties: [{ name: 'Some Org' }],
    });

    expect(document.parties).toEqual([{ name: 'Some Org', role: null }]);
  });

  it('accepts, but warns on, a summary far outside the 300-500 word target rather than rejecting it', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { document, error } = validateExtractedDocument({
      type: 'CERTIFICATE',
      title: 'Short Certificate',
      summary: 'Valid for one year.',
      sourceUrl: 'https://mail.google.com/x',
      sourceType: 'EMAIL',
    });

    expect(error).toBeNull();
    expect(document).not.toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('never throws on malformed input', () => {
    expect(() => validateExtractedDocument(null)).not.toThrow();
    expect(() => validateExtractedDocument(undefined)).not.toThrow();
    expect(() => validateExtractedDocument('not an object')).not.toThrow();
    expect(() => validateExtractedDocument({ parties: 'not an array' })).not.toThrow();
  });
});
