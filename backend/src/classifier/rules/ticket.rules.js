// Regex-only signals for "this email is probably a TICKET".
module.exports = [
  {
    id: 'ticket_keyword_subject',
    weight: 0.3,
    test: (email) => /\b(ticket|support ticket|case)\b/i.test(email.subject),
  },
  {
    id: 'ticket_number_pattern',
    weight: 0.35,
    test: (email) => /\b(ticket|case)\s*#?\s*\d+/i.test(email.searchableText),
  },
  {
    id: 'helpdesk_sender_domain',
    weight: 0.35,
    test: (email) => /(zendesk|freshdesk|freshservice|intercom|atlassian|jira)\.(com|net|io)$/i.test(email.fromDomain),
  },
  {
    id: 'status_priority_phrase',
    weight: 0.15,
    test: (email) => /\b(priority|status)\s*:/i.test(email.searchableText),
  },
  {
    id: 'request_received_phrase',
    weight: 0.2,
    test: (email) => /\b(your request|support request|we've received your)\b/i.test(email.searchableText),
  },
];
