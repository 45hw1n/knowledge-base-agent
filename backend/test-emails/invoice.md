# INVOICE test emails

Send each from `s.ashwin.0411@gmail.com` to `ashwin.fynverse@gmail.com`.
Scored against `src/classifier/rules/invoice.rules.js`. Note: every email
sent from a gmail.com address also gets an automatic TICKET score of 0.35
(see `ticket.rules.js`'s `helpdesk_sender_domain` rule) — each sample below
clears that floor comfortably.

---

## 1. Clear-cut, full invoice

**Subject:** Invoice #10234 from Fynverse Labs

**Body:**
```
Hi Ashwin,

Please find attached Invoice Number: 10234 for services rendered in October 2026.

Amount Due: $1,250.00
Due Date: 2026-09-05

Please pay at your earliest convenience.

Thanks,
Billing Team
```

**Expected:** INVOICE, score ~1.0 (capped). Matches: subject keyword, invoice
number, amount due phrase, currency amount, due date phrase.

---

## 2. Minimal invoice (no number, no due date)

**Subject:** Invoice for September Consulting

**Body:**
```
Hi,

Here's the invoice for last month's consulting work.

Total: $500

Let me know if you have any questions.
```

**Expected:** INVOICE, score ~0.5 (subject keyword + currency amount only).
TICKET will also appear as a secondary candidate at ~0.35 — good case to
confirm INVOICE still wins the top slot by a comfortable margin.

---

## 3. Overdue reminder tone

**Subject:** Reminder: Invoice #556 Balance Due

**Body:**
```
This is a reminder that Invoice Number: 556 has a balance due of $320.00.
The due date has passed — please remit payment immediately to avoid late fees.
```

**Expected:** INVOICE, score ~1.0 (capped). Matches: subject keyword,
invoice number, "balance due", currency amount, due date phrase. Does NOT
trigger PAYMENT (needs "payment received/confirmation/successful" — not
present here).
