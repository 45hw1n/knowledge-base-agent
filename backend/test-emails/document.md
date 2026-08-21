# DOCUMENT test emails

Send each from `s.ashwin.0411@gmail.com` to `ashwin.fynverse@gmail.com`.
Scored against `src/classifier/rules/document.rules.js`. Note: every email
sent from a gmail.com address also gets an automatic TICKET score of 0.35
(see `ticket.rules.js`'s `helpdesk_sender_domain` rule) — samples below
were adjusted to clearly clear that floor (sample 2 originally tied at
0.35 before adding a second matching phrase).

---

## 1. Compliance report

**Subject:** Q3 SOC 2 Compliance Report Available

**Body:**
```
Hi Ashwin,

Please find attached our Q3 SOC 2 compliance report covering the audit
period July–September 2026.

Let us know if you have any questions about the findings.
```

**Expected:** DOCUMENT, score ~0.75. Matches: compliance report keyword
("SOC 2", "compliance report"), "report" in subject, "please find attached".

---

## 2. Policy update

**Subject:** Updated Privacy Policy — Effective October 2026

**Body:**
```
We're writing to let you know we've updated our Privacy Policy and Terms
of Service, effective October 1, 2026. Attached is the full policy update
for your review.
```

**Expected:** DOCUMENT, score ~0.50. Matches: policy/terms keyword
("Privacy Policy", "Terms of Service", "policy update") + attached-document
phrase ("Attached is"). Without the second phrase this would tie exactly
with the automatic TICKET floor (0.35 vs 0.35) — worth remembering that a
single weak DOCUMENT signal alone risks losing a tie to TICKET when testing
from a gmail.com sender.

---

## 3. Product announcement / proposal

**Subject:** Announcing Our New Product Roadmap

**Body:**
```
We're excited to be announcing several new features coming this quarter.
Please find attached our proposal whitepaper outlining the new roadmap.
```

**Expected:** DOCUMENT, score ~0.50. Matches: proposal/announcement keyword
("announcing", "proposal", "whitepaper") + "please find attached" phrase.
