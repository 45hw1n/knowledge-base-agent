const { buildAckReply } = require('../whatsappReplyService');

describe('whatsappReplyService', () => {
  it('builds the Milestone 1 ack reply with original content', () => {
    expect(buildAckReply('Hello Fynverse')).toBe(
      [
        'Received the message by Fynverse',
        '',
        'Content:',
        'Hello Fynverse',
      ].join('\n')
    );
  });
});
