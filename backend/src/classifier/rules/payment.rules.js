// Regex-only signals for "this email is probably a PAYMENT" (money that has
// already moved, as opposed to an INVOICE requesting money).
module.exports = [
  {
    id: 'payment_confirmation_phrase',
    weight: 0.4,
    test: (email) =>
      /\b(payment received|payment confirmation|payment successful|you sent a payment|you've received a payment)\b/i.test(
        email.searchableText
      ),
  },
  {
    id: 'transaction_id_pattern',
    weight: 0.3,
    test: (email) => /\b(transaction|txn)\s*(id)?\s*[:\-]?\s*[a-z0-9]+/i.test(email.searchableText),
  },
  {
    id: 'payment_processor_domain',
    weight: 0.35,
    test: (email) => /(paypal|stripe|razorpay|venmo|squareup|cashapp)\.com$/i.test(email.fromDomain),
  },
  {
    id: 'currency_amount_pattern',
    weight: 0.15,
    test: (email) => /(\$|USD|INR|EUR|₹|Rs\.?)\s?\d[\d,]*(\.\d{2})?/i.test(email.searchableText),
  },
  {
    id: 'receipt_keyword_subject',
    weight: 0.15,
    test: (email) => /\breceipt\b/i.test(email.subject),
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
