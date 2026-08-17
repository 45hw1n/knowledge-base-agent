const {
  parseWebhookPayload,
} = require('../webhookParser');

describe('webhookParser', () => {
  it('normalizes an inbound text message and attaches rawPayload', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550001111',
                  phone_number_id: 'PHONE_ID',
                },
                contacts: [
                  {
                    profile: { name: 'Ashwin' },
                    wa_id: '919876543210',
                  },
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.TEST_1',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Hello Fynverse' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: 'wamid.TEST_1',
      phoneNumber: '919876543210',
      messageType: 'text',
      text: 'Hello Fynverse',
      mediaId: null,
      rawPayload: payload,
    });
    expect(messages[0].timestamp).toEqual(new Date(1700000000 * 1000));
  });

  it('ignores status / delivery updates', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.STATUS',
                    status: 'delivered',
                    timestamp: '1700000001',
                    recipient_id: '919876543210',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseWebhookPayload(payload)).toEqual([]);
  });

  it('returns empty array for malformed payloads', () => {
    expect(parseWebhookPayload(null)).toEqual([]);
    expect(parseWebhookPayload({})).toEqual([]);
    expect(parseWebhookPayload({ object: 'something_else' })).toEqual([]);
  });

  it('ignores non-text inbound messages (Milestone 1)', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.IMG_1',
                    timestamp: '1700000002',
                    type: 'image',
                    image: { id: 'MEDIA_123', mime_type: 'image/jpeg' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseWebhookPayload(payload)).toEqual([]);
  });
});
