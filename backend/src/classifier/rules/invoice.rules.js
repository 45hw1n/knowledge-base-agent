// Regex-only signals for "this email is probably an INVOICE" — never
// responsible for extracting the actual invoice fields, only for routing.
module.exports = [
  {
    id: 'invoice_keyword_subject',
    weight: 0.35,
    test: (email) => /\binvoice\b/i.test(email.subject),
  },
  {
    id: 'invoice_number_pattern',
    weight: 0.3,
    test: (email) => /invoice\s*(no\.?|number|#)?\s*[:\-]?\s*\d+/i.test(email.searchableText),
  },
  {
    id: 'amount_due_phrase',
    weight: 0.2,
    test: (email) => /\b(amount due|total due|balance due|please pay)\b/i.test(email.searchableText),
  },
  {
    id: 'currency_amount_pattern',
    weight: 0.15,
    test: (email) => /(\$|USD|INR|EUR|₹|Rs\.?)\s?\d[\d,]*(\.\d{2})?/i.test(email.searchableText),
  },
  {
    id: 'billing_sender',
    weight: 0.2,
    test: (email) =>
      /\b(billing|invoices?|accounts?)@/i.test(email.from) ||
      /(quickbooks|xero|stripe|zoho|freshbooks)\.com$/i.test(email.fromDomain),
  },
  {
    id: 'due_date_phrase',
    weight: 0.1,
    test: (email) => /\bdue date\b/i.test(email.searchableText),
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
