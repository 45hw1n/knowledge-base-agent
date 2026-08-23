// Regex-only signals for "this email is probably an EVENT" (calendar
// invite / meeting / scheduled happening).
module.exports = [
  {
    id: 'invitation_subject_prefix',
    weight: 0.35,
    test: (email) => /^invitation:/i.test(email.subject),
  },
  {
    id: 'invite_phrase',
    weight: 0.3,
    test: (email) => /\b(you're invited|meeting invite|calendar invite|rsvp)\b/i.test(email.searchableText),
  },
  {
    id: 'calendar_sender_domain',
    weight: 0.3,
    test: (email) => /(calendar\.google\.com|zoom\.us|teams\.microsoft\.com|calendly\.com)$/i.test(email.fromDomain),
  },
  {
    id: 'time_pattern',
    weight: 0.2,
    test: (email) => /\b\d{1,2}:\d{2}\s?(am|pm)\b/i.test(email.searchableText),
  },
  {
    id: 'when_where_phrase',
    weight: 0.2,
    test: (email) => /\b(when:|where:|location:)/i.test(email.searchableText),
  },
  // Cross-cutting trusted-sender bonus, identical across all five rule
  // sets — see ticket.rules.js's zamp_sender_domain for the full
  // reasoning. Small on purpose: keeps a zamp email from scoring exactly
  // 0 without overriding genuine content signal for the real type.
  {
    id: 'zamp_sender_domain',
    weight: 0.1,
    test: (email) => /(^|\.)zamp\.[a-z]+$/i.test(email.fromDomain),
  },
];
