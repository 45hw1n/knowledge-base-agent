# TICKET test emails

Send each from `s.ashwin.0411@gmail.com` to `ashwin.fynverse@gmail.com`.
Scored against `src/classifier/rules/ticket.rules.js`. Every sample below
also benefits from the automatic +0.35 `helpdesk_sender_domain` bonus that
any gmail.com sender gets — genuinely helpful here since these ARE tickets.

---

## 1. Clear support issue with ticket number

**Subject:** Unable to login to my account

**Body:**
```
Hi team,

I'm unable to login to my account since this morning. I keep getting an
"invalid password" error even though I'm using the correct credentials.

Could you please help? Ticket #88214 was opened for this issue.

Status: Open
Priority: High
```

**Expected:** TICKET, score ~1.0 (capped). Matches nearly every rule:
subject problem language, problem description, request language, ticket
system signal, ticket number pattern, status/priority phrase, plus the
automatic sender bonus.

---

## 2. Minimal — no explicit "ticket" vocabulary

**Subject:** Trouble uploading documents

**Body:**
```
Hi, I'm having trouble uploading documents to the portal — it keeps failing
at 90%. Can you help me figure out what's wrong?
```

**Expected:** TICKET, score ~0.80. This is the specific case the rule file's
own comments call out: recognizing a support request by *intent* ("having
trouble", "can you help") without the word "ticket" anywhere. No other
type's rules should fire on this content.

---

## 3. Escalation with case number and priority

**Subject:** Issue with recent order - Case 4471

**Body:**
```
Hi Support,

There's an issue with my recent order — it hasn't been working properly
since delivery. This is broken and needs urgent attention.

Priority: Urgent
Case: 4471
```

**Expected:** TICKET, score ~1.0 (capped). Matches: subject problem
language ("issue"), ticket system signal ("case"), case number pattern,
status/priority phrase, plus the automatic sender bonus.
