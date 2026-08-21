# EVENT test emails

Send each from `s.ashwin.0411@gmail.com` to `ashwin.fynverse@gmail.com`.
Scored against `src/classifier/rules/event.rules.js`. Note: every email
sent from a gmail.com address also gets an automatic TICKET score of 0.35
(see `ticket.rules.js`'s `helpdesk_sender_domain` rule) — samples below
clear that floor, though sample 3 does so by a tighter margin (called out).

---

## 1. Classic calendar invite

**Subject:** Invitation: Product Sync — Thu Sep 4, 2026 3:00pm

**Body:**
```
You're invited to join our Product Sync meeting.

When: Thursday, September 4, 2026, 3:00 PM
Where: Google Meet (link below)

Please RSVP by replying to this email.
```

**Expected:** EVENT, score ~1.0 (capped). Matches: "Invitation:" subject
prefix, invite phrase ("you're invited", "rsvp"), time pattern, when/where
phrase.

---

## 2. Meetup style, no "Invitation:" prefix

**Subject:** You're Invited: Team Offsite Planning

**Body:**
```
Join us for the team offsite planning session.

Time: 10:30 AM
Location: Conference Room B

Looking forward to seeing you there!
```

**Expected:** EVENT, score ~0.70. Note the subject does NOT start with
literally "Invitation:" so that specific rule doesn't fire — this tests the
invite-phrase + time + location path instead.

---

## 3. Minimal, informal scheduling

**Subject:** Quick Sync Tomorrow?

**Body:**
```
Hey, can we do a quick sync tomorrow at 4:15 PM? Let me know if that works,
and RSVP when you can.
```

**Expected:** EVENT, score ~0.50 (invite phrase "rsvp" + time pattern only).
This is the tightest margin of any sample in this set — EVENT (~0.50) vs.
the automatic TICKET floor (~0.35) — good one to double-check actually
lands as EVENT and not TICKET.
