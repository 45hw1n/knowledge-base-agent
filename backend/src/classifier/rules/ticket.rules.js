// Signals for "this email is probably a TICKET" — reworked around problem/
// request INTENT rather than explicit ticketing-system vocabulary alone, so
// a plain support email ("Unable to login into Gmail") is recognized even
// without the word "ticket" anywhere in it. Explicit ticket-system language
// and provider domains are still strong signals, just no longer mandatory.
module.exports = [
  {
    id: 'ticket_subject_problem',
    weight: 0.30,
    test: (email) =>
      /\b(unable|can't|cannot|not working|doesn't work|isn't working|broken|issue|problem|error|failed|failure)\b/i
        .test(email.subject),
  },
  {
    id: 'ticket_problem_description',
    weight: 0.25,
    test: (email) =>
      /\b(unable to|trying to|can't|cannot|doesn't|isn't|not able to|having trouble|having issues with)\b/i
        .test(email.searchableText),
  },
  {
    id: 'ticket_request_language',
    weight: 0.20,
    test: (email) =>
      /\b(help|please help|need help|assistance|can you|could you|please fix|please investigate)\b/i
        .test(email.searchableText),
  },
  {
    id: 'ticket_system_signal',
    weight: 0.30,
    test: (email) =>
      /\b(ticket|support ticket|case|incident|support request)\b/i
        .test(email.searchableText),
  },
  {
    id: 'ticket_number_pattern',
    weight: 0.35,
    test: (email) => /\b(ticket|case|incident)[\s#:-]*\d+\b/i.test(email.searchableText),
  },
  {
    id: 'helpdesk_sender_domain',
    weight: 0.35,
    test: (email) => /(zendesk|freshdesk|freshservice|intercom|atlassian|jira|gmail)\.(com|net|io)$/i.test(email.fromDomain),
  },
  {
    id: 'status_priority_phrase',
    weight: 0.15,
    test: (email) => /\b(priority|status)\s*:/i.test(email.searchableText),
  },
  // Cross-cutting trusted-sender bonus, identical across all five rule
  // sets — see zamp_sender_domain in the other .rules.js files. Small on
  // purpose: it keeps a zamp email from scoring exactly 0 (and being
  // silently discarded) without overriding genuine content signal for
  // whichever type the email actually is.
  {
    id: 'zamp_sender_domain',
    weight: 0.1,
    test: (email) => /(^|\.)zamp\.[a-z]+$/i.test(email.fromDomain),
  },
];
