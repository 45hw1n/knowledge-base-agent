// Regex-only signals for "this email carries a useful DOCUMENT" — the
// fallback entity type for useful content that isn't an invoice/ticket/
// payment/event. Deliberately specific (compliance reports, policies,
// proposals) rather than broad, so genuinely irrelevant email doesn't
// fall through into DOCUMENT by default.
module.exports = [
  {
    id: 'compliance_report_keyword',
    weight: 0.4,
    test: (email) => /\b(soc\s?2|soc2|iso\s?27001|security report|compliance report|audit report)\b/i.test(email.searchableText),
  },
  {
    id: 'policy_terms_keyword',
    weight: 0.35,
    test: (email) => /\b(privacy policy|terms of service|terms and conditions|policy update)\b/i.test(email.searchableText),
  },
  {
    id: 'proposal_announcement_keyword',
    weight: 0.35,
    test: (email) => /\b(proposal|whitepaper|white paper|product announcement|release notes|announcing)\b/i.test(email.searchableText),
  },
  {
    id: 'report_keyword_subject',
    weight: 0.2,
    test: (email) => /\breport\b/i.test(email.subject),
  },
  {
    id: 'attached_document_phrase',
    weight: 0.15,
    test: (email) => /\b(please find attached|attached is|attached document|sharing the document)\b/i.test(email.searchableText),
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
