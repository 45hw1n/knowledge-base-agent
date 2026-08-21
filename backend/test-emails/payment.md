# PAYMENT test emails

Send each from `s.ashwin.0411@gmail.com` to `ashwin.fynverse@gmail.com`.
Scored against `src/classifier/rules/payment.rules.js`. Note: every email
sent from a gmail.com address also gets an automatic TICKET score of 0.35
(see `ticket.rules.js`'s `helpdesk_sender_domain` rule).

---

## 1. Clear payment confirmation

**Subject:** Payment Confirmation - Order #4521

**Body:**
```
Hi Ashwin,

Payment Received successfully.

Transaction ID: TXN9988271
Amount: $89.99

Thank you for your business.
```

**Expected:** PAYMENT, score ~0.85. Matches: payment confirmation phrase,
transaction ID pattern, currency amount.

---

## 2. Receipt-style, minimal

**Subject:** Your Receipt from Coffee Bros

**Body:**
```
Thanks for your order! Here's your receipt.

Total charged: $14.50
Txn: 88213-XZ
```

**Expected:** PAYMENT, score ~0.6. Matches: receipt keyword in subject,
transaction ID pattern, currency amount.

---

## 3. Deliberate ambiguity: "Payment Failed" (edge case, expect TICKET to win)

**Subject:** Payment Failed - Action Required

**Body:**
```
We were unable to process your payment. Transaction ID: TXN55219. Please
contact support if this issue persists, case #7743 has been opened.
```

**Expected result: TICKET wins, NOT PAYMENT** — this is intentional, not a
bug in the test. `payment_confirmation_phrase` only matches
received/confirmation/successful language, so "Payment Failed" scores
PAYMENT only ~0.3 (transaction ID alone). Meanwhile "unable to", "case
#7743", and the automatic gmail-sender helpdesk bonus push TICKET to ~1.0.

This mirrors the exact ambiguity called out in `classifier.js`'s own
docstring ("Payment failed" scores both PAYMENT and TICKET) — in production,
a real payment processor's sender domain (stripe.com, paypal.com, etc.)
would tip this back to PAYMENT via `payment_processor_domain`, which a
personal Gmail test sender can't replicate. Worth knowing as a real
limitation of sender-domain-based signals when testing from a personal inbox.
