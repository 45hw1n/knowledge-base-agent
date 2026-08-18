jest.mock('../../../../utils/emailEncryption', () => ({
    decryptClearText: jest.fn((field) => field?.__clear ?? null)
}));
jest.mock('../../../../services/gmailService', () => ({
    fetchAttachment: jest.fn()
}));
jest.mock('../../../../documentParsing/client', () => ({
    parse: jest.fn()
}));
jest.mock('../../../client', () => ({
    generate: jest.fn()
}));
jest.mock('../../../../models/Entity', () => ({
    insertMany: jest.fn()
}));

const gmailService = require('../../../../services/gmailService');
const documentParserClient = require('../../../../documentParsing/client');
const aiClient = require('../../../client');
const Entity = require('../../../../models/Entity');
const { extractEntitiesFromEmail } = require('../orchestrator');

function buildEmailDoc(overrides = {}) {
    return {
        _id: 'email-1',
        accountUserId: 'user-1',
        messageId: 'msg-1',
        subject: { __clear: 'Meeting request' },
        from: { __clear: 'alice@example.com' },
        encryptedCleanText: { __clear: 'Let us meet on Monday at 10am.' },
        attachments: [],
        ...overrides
    };
}

describe('extractEntitiesFromEmail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Entity.insertMany.mockImplementation(async (docs) => docs.map((doc, i) => ({ ...doc, _id: `entity-${i}` })));
    });

    it('extracts entities from email body text alone (no attachments)', async () => {
        aiClient.generate.mockResolvedValue(JSON.stringify({
            entities: [{ entityType: 'appointment', data: { date: 'Monday 10am' }, confidence: 0.8 }]
        }));

        const emailDoc = buildEmailDoc();
        const result = await extractEntitiesFromEmail(emailDoc);

        expect(gmailService.fetchAttachment).not.toHaveBeenCalled();
        expect(aiClient.generate).toHaveBeenCalledWith(
            expect.stringContaining('Let us meet on Monday at 10am.'),
            { feature: 'extractEntities' }
        );
        expect(Entity.insertMany).toHaveBeenCalledTimes(1);
        const [persistedDocs] = Entity.insertMany.mock.calls[0];
        expect(persistedDocs).toHaveLength(1);
        expect(persistedDocs[0]).toMatchObject({
            userId: 'user-1',
            entityType: 'appointment',
            sourceType: 'EMAIL_BODY',
            sourceEmailId: 'email-1'
        });
        expect(result).toEqual({ entitiesCreated: 1, error: null });
    });

    it('routes attachments through the document parser before extraction', async () => {
        gmailService.fetchAttachment.mockResolvedValue(Buffer.from('invoice contents'));
        documentParserClient.parse.mockResolvedValue({ text: 'Invoice #123 total $50', provider: 'mock' });
        aiClient.generate.mockResolvedValue(JSON.stringify({
            entities: [{ entityType: 'invoice', data: { invoiceNumber: '123', total: 50 }, confidence: 0.95 }]
        }));

        const emailDoc = buildEmailDoc({
            attachments: [{ attachmentId: 'att-1', filename: 'invoice.pdf', mimeType: 'application/pdf', size: 1024 }]
        });
        const result = await extractEntitiesFromEmail(emailDoc);

        expect(gmailService.fetchAttachment).toHaveBeenCalledWith('user-1', 'msg-1', 'att-1');
        expect(documentParserClient.parse).toHaveBeenCalledWith(
            expect.objectContaining({ mimeType: 'application/pdf', fileName: 'invoice.pdf' })
        );
        expect(aiClient.generate).toHaveBeenCalledWith(
            expect.stringContaining('Invoice #123 total $50'),
            { feature: 'extractEntities' }
        );
        const [persistedDocs] = Entity.insertMany.mock.calls[0];
        expect(persistedDocs[0]).toMatchObject({ sourceType: 'EMAIL_ATTACHMENT', entityType: 'invoice' });
        expect(result).toEqual({ entitiesCreated: 1, error: null });
    });

    it('returns a postprocess error and skips persistence on malformed AI output', async () => {
        aiClient.generate.mockResolvedValue('not json');

        const result = await extractEntitiesFromEmail(buildEmailDoc());

        expect(Entity.insertMany).not.toHaveBeenCalled();
        expect(result.entitiesCreated).toBe(0);
        expect(result.error).toMatch(/Failed to parse AI response/);
    });
});
