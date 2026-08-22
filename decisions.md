# Cortex — Architectural & Product Decisions

This log records meaningful decisions made while building Cortex's ingestion
pipeline: what we chose, what we considered instead, why, and what we
deliberately left out. Updated phase by phase.

---

## Phase 1 — Email Classification

### Decision: Regex/rule-based classification runs before any AI call

**Alternatives considered:** Send every ingested email straight to the LLM
and let it decide both "is this useful" and "what structured entity does it
contain" in one step.

**Reasoning:** A cheap, deterministic, instant filter should decide whether
an email is worth paying for an AI call at all. Most inbox volume (marketing,
notifications, personal mail) is obviously not business-relevant from
subject/sender/keyword signals alone — routing 100% of volume through an LLM
would be slower and needlessly expensive. Regex also gives us a fast,
unit-testable, provider-independent classification signal that doesn't
depend on any external API being up.

**Tradeoff accepted:** Regex will misclassify or miss genuinely useful
emails that don't match known keyword/sender patterns (e.g. an invoice with
unusual phrasing). This is acceptable for Phase 1 — the classifier's job is
routing, not final judgment, and rules are cheap to extend as real email
examples surface gaps.

---

### Decision: Classifier is a pure function, independent of MongoDB/Gmail/AI

**Alternatives considered:** Build classification directly inside
`syncEmailsService.js` or as a method on the email model, operating on
Mongoose documents.

**Reasoning:** The spec requires the classifier to be deterministic,
unit-testable, and easy to extend without touching ingestion or persistence
code. Keeping `classify(normalizedEmail)` a pure function over a plain object
means it can be tested with zero setup (no DB, no mocks, no network) and
reused later by any ingestion path (Gmail today, potentially other providers
later) without modification.

**Deliberately cut (for now):** Wiring the classifier into the live
`syncEmailsService.js` pipeline. Phase 1 is the classification layer only —
integration happens in a later phase once the `emails` collection and
processing-state machine exist to actually act on the classification result.

---

### Decision: Classifier input reuses the existing email-normalization shape

**Context:** `utils/helpers.js#extractEmailSnapshot` already turns a raw
Gmail API message into `{ metadata: { subject, from, ... }, encryptedCleanText, bodyHash, snippet }`
via MIME decoding, HTML-to-text conversion, and reply-chain stripping — but
it also encrypts the body inline, coupling normalization to encryption.

**Decision:** `classifier/normalizeEmail.js` takes plain, already-extracted
string fields (`subject`, `from`, `to`, `bodyText`, `snippet`) — the same
shape `extractEmailSnapshot` produces before its encryption step — rather
than re-implementing MIME/HTML parsing or accepting raw Gmail API payloads.

**Reasoning:** Reuses existing, working infrastructure instead of
duplicating MIME-parsing logic, per the instruction not to rewrite working
infra. Wiring the classifier into the real pipeline later will only need a
thin adapter (pass the already-decoded fields through), not a rewrite of
either side.

**Deliberately cut:** Refactoring `extractEmailSnapshot` to split
normalization from encryption. Not needed until the classifier is actually
wired into the live ingestion path (Phase 2/3) — doing it now would be a
speculative change to working code.

---

### Decision: Weighted rule scoring, not first-match-wins

**Alternatives considered:** Evaluate rule sets in priority order and return
the first type with any match.

**Reasoning:** Real emails can plausibly match more than one type's keywords
(e.g. a Stripe email mentioning both "invoice" and "payment received" — the
same company sends both). A weighted sum per type, with the highest-scoring
type winning, lets stronger/more specific signals (e.g. a payment-processor
sender domain + transaction ID) outweigh weaker/more generic ones (e.g. the
word "invoice" appearing once), which is a more realistic classification
behavior than "whichever type happened to be checked first."

**Reasoning for fixed evaluation order (INVOICE → TICKET → PAYMENT → EVENT →
DOCUMENT):** Only matters as a tie-break when two types score exactly equal
— an edge case, not the primary mechanism. Keeps classification fully
deterministic (same input always produces the same output) as required.

---

### Decision: DOCUMENT has its own explicit rule set, not a bare "else" fallback

**Alternatives considered:** Classify anything that doesn't match
INVOICE/TICKET/PAYMENT/EVENT as DOCUMENT by default.

**Reasoning:** The spec explicitly requires the classifier to discard
genuinely irrelevant email (newsletters, personal mail, marketing) rather
than filing it as a knowledge object. If DOCUMENT were "everything else,"
every irrelevant email would incorrectly become a DOCUMENT knowledge object.
Instead, DOCUMENT has its own concrete signals (compliance/security reports,
policies, proposals, whitepapers, announcements) and competes in the same
scoring as the other four types. An email matching none of the five rule
sets is discarded (`type: null`), distinct from an email that specifically
matches DOCUMENT's signals.

---

### Decision: A minimum score threshold (`ACCEPT_THRESHOLD = 0.4`) gates acceptance

**Reasoning:** A single weak, coincidental keyword match (e.g. the word
"report" appearing in an unrelated sentence) shouldn't be enough to classify
and persist an email. The threshold requires either one strong signal (a
specific sender domain, a number pattern) or several moderate signals
together, reducing false positives on ambiguous content. This value is a
starting point, not a tuned constant — expected to be revisited once real
email examples are available.

---

### Decision: Rules are plain JS modules, not a custom `.rules` file format

**Context:** The spec's illustrative file tree shows `invoice.rules`,
`ticket.rules`, etc. as if a distinct file type.

**Decision:** Implemented as `invoice.rules.js`, `ticket.rules.js`, etc. —
plain CommonJS modules exporting an array of
`{ id, weight, test(normalizedEmail) }` objects.

**Reasoning:** The backend is plain JavaScript (CommonJS) throughout — no
TypeScript, no existing config/build step for a custom rule-definition
format. Inventing a `.rules` file parser would mean writing and maintaining
a bespoke DSL and loader for no real benefit over native, directly
`require()`-able, directly unit-testable JS — the instructions explicitly
favor simple code over elaborate architecture and warn against premature
abstractions.

---

### Deliberately cut in Phase 1 (scoped for later phases per the implementation order)

- MongoDB schemas (`emails`, `knowledge_objects`, entity collections,
  `processing_attempts`) — Phase 2.
- Encrypted email persistence + TTL — Phase 3.
- AI extraction interface and structured-output validation — Phase 3.
- Entity creation, `KnowledgeObject` linking, idempotency — Phases 4–6.
- Attachment handling — Phase 7.
- Any UI — Phase 8.

None of the above were touched in this phase; the classifier module has no
dependency on any of them.

---

## Phase 1 (continued) — Intent Classification + Conversation Threads

### Decision: Classifier output changed from a single winner to a candidate list

**Alternatives considered:** Keep the single `{ type, confidence, matchedRules }`
winner-takes-all shape from the first iteration.

**Reasoning:** Real emails legitimately match more than one type's signals —
a Stripe email can plausibly read as both an invoice and a payment
confirmation; a failed-payment email legitimately contains ticket-like
"failed" language too. Forcing a single winner discards information a later
AI stage could use. `classify()` now returns
`{ candidates: [{ type, score, matchedRules }, ...] }`, sorted by score
descending; an empty array means nothing matched (discard as irrelevant).
`ACCEPT_THRESHOLD` was removed entirely rather than kept as a per-candidate
filter — the earlier phase's "some minimum score to be considered at all"
concept doesn't map cleanly onto "list every type with any real evidence and
let the next stage decide," so keeping it around unused would have been
misleading dead code.

**Deliberately cut:** A "confidence" summary field distinct from each
candidate's own score — with multiple candidates, there's no single
meaningful confidence number to report; each candidate carries its own
score.

---

### Decision: Ticket rules rebuilt around problem/request *intent*, not ticketing vocabulary

**Reasoning:** The original ticket rules only fired on explicit ticketing
language ("ticket #123", Zendesk/Freshdesk domains) and missed the common
case of a real support email like "Unable to login into Gmail" with no
ticket vocabulary at all. Rules now score problem statements ("unable to",
"not working", "broken"), request/help language ("please help", "can you"),
and explicit support terminology as independent, additive signals — an
email can be classified as a likely ticket from problem language alone, with
explicit ticket vocabulary as a bonus signal rather than a requirement.

### Decision: Overclassification is mitigated by ranking, not by narrowing the regex

**Context:** Problem words like "failed"/"error"/"issue" also show up in
non-ticket emails ("Payment failed", "Invoice issue"). Removing these words
from the ticket rules would fix those specific cases but reduce recall on
genuine tickets that use the same words.

**Decision:** Keep the broad problem-word rule, and rely on scoring/ranking
so a stronger, more specific signal (payment-processor sender domain +
transaction ID + confirmation phrase) outranks a single weak keyword match.
Verified: "Payment failed" from a Stripe-style sender scores PAYMENT well
above TICKET; "Invoice issue" with billing context scores INVOICE above
TICKET. Both still surface TICKET as a (correctly low-ranked) candidate,
which is the intended behavior — regex proposes candidates, it doesn't claim
certainty.

**Edge case surfaced, not fully resolved:** A bare subject like "Event
registration failed" with no other context has *no* real signal pointing to
any type other than a single weak "failed" keyword match. Rather than
fabricate a false EVENT signal to force a different winner (there's no
actual evidence of an invitation/calendar event), the classifier surfaces
TICKET as the sole candidate at its lowest possible score (a single matched
rule, 0.3). This is a genuine limitation of a bare-subject email with zero
other context — Phase 1 does not claim confident judgment here, and this is
exactly the kind of ambiguous case meant to be resolved by the AI stage in a
later phase, not by regex.

---

### Decision: `EmailThread` is a new, standalone model — not wired into the live ingestion pipeline yet

**Reasoning:** The instruction was explicit: "connect emails to threads" and
"add idempotency," but also "do not implement the entire ingestion pipeline
yet" and don't rewrite working infrastructure unnecessarily. The live
`syncEmailsService.js` → `DebitEmailToProcess` path is deployed and working
today. Rather than modify that production path for a partial feature, this
phase built `EmailThread` (model) + `threadService.findOrCreateThread()`
(service) as a complete, independently tested unit, ready to be called from
the ingestion path once the broader `emails`/`knowledge_objects` schema work
happens (per the original Phase 2 plan). **Flagging explicitly**: if the
intent was actually to wire this into the live pipeline right now, say so
and I'll do that as a follow-up — I read the "don't implement the entire
pipeline yet" instruction as still in force here.

### Decision: Thread uniqueness is scoped to (userId, provider, providerThreadId), not (provider, providerThreadId) alone

**Context:** The spec states "provider + providerThreadId" as the dedup
boundary.

**Reasoning:** Gmail thread IDs are only guaranteed unique within a single
mailbox. A global unique index on `(provider, providerThreadId)` alone would
risk incorrectly merging two different users' threads if their IDs ever
collided (astronomically unlikely but not architecturally impossible, and a
real cross-user data leak if it happened). Scoping the index to include
`userId` achieves the actual goal — never create Thread A/B/C for the same
Gmail conversation — without that risk. This is a deliberate, documented
deviation from the literal spec text, not an oversight.

### Decision: Gmail's `threadId` is the only threading mechanism implemented; subject normalization is a pure utility, not wired in

**Reasoning:** Section 18 explicitly lists "complex subject-based
threading" under "what not to build yet," and Gmail always supplies a
`threadId` today — there's no current situation where a subject-based
fallback would actually be exercised. `normalizeSubjectForThreading()` was
built (strips `Re:`/`RE:`/`Fwd:` prefixes, per the given examples) as a
small, tested, standalone utility for future use, but `findOrCreateThread()`
does not call it — it only ever looks up threads by
`(userId, provider, providerThreadId)`.

### Decision: Participant deduplication is by lowercased email only

**Reasoning:** `$addToSet` on subdocuments does deep-equality comparison, so
the same person appearing with a slightly different display name across
messages would otherwise be added twice. Deduplicating by email address
before the update avoids that without needing any name-merging logic —
matches the instruction not to build sophisticated conversation handling
yet.

### Decision: Thread creation races are handled explicitly (duplicate-key retry), not left to chance

**Reasoning:** Two near-simultaneous calls for the same new thread (e.g. a
webhook delivered twice in parallel) can both attempt the same upsert; the
unique index guarantees only one insert succeeds, and the loser gets a
MongoDB duplicate-key error (code 11000) rather than silently succeeding
twice. `findOrCreateThread()` catches that specific error and retries as a
plain (non-upsert) update, so the caller always gets back the single
canonical thread document rather than an error. This directly satisfies the
"duplicate webhook for the same thread" and "same email received twice"
idempotency requirements at the model layer.

---

### Deliberately cut in this phase

- Wiring the classifier or `findOrCreateThread` into the live
  `syncEmailsService.js` ingestion path.
- The `emails`, `knowledge_objects`, and typed entity Mongo collections
  (still pending from the original Phase 2 plan).
- Subject-based thread matching as an actual fallback mechanism (utility
  exists, unused).
- AI extraction of any kind.
- Any notion of "does this thread already have a KnowledgeObject" — the
  `EmailThread.knowledgeObjectId` field exists in the schema (nullable,
  unused for now) so the later phase that populates it doesn't need a schema
  migration, but no code reads or writes it yet.

---

## Entity Model

### Decision: Entity is the top-level registry, not the business object

**Reasoning:** Cortex needs one place to answer "what does this user have
knowledge of" across every entity type, without every query needing to know
about `tickets`/`invoices`/`payments`/etc. individually. Entity stores only
what's common across all types (who owns it, what kind it is, where it came
from, how confidently it was extracted) and a reference (`entityId`) to the
typed child collection that holds the actual domain data. This keeps the
registry cheap to query/list/paginate regardless of type, and keeps
type-specific schema changes (e.g. adding a `Ticket.priority` field) from
ever touching Entity.

### Decision: No generic `status` on Entity

**Reasoning:** A generic `status: "ACTIVE"` would be meaningless — active
compared to what business lifecycle? A resolved ticket and an unpaid invoice
are "done" in completely different senses. Business status belongs
exclusively to the typed child entity (`Ticket.status`, `Invoice.status`,
etc.), which doesn't exist yet. The only status Entity carries is
`extraction.status`, and it describes a different thing entirely — see next.

### Decision: `extraction.status` describes the Cortex pipeline, not the business object

**Reasoning:** `extraction.status: FAILED` means "Cortex failed to extract
structured data from this source" — it says nothing about whether a support
issue was resolved or an invoice was paid. Keeping this state under a nested
`extraction` object (alongside `model`, `confidence`, `extractedAt`) makes
the distinction structurally obvious rather than relying on a comment: it's
impossible to confuse `extraction.status` with a business-status field that
doesn't exist.

### Decision: Source URL is generated by the application, never by the AI

**Reasoning:** The instruction was explicit and the reasoning is a real
security/correctness concern, not just style: if the AI produced or could
override `source.url`, a prompt-injected or hallucinated email could cause
Cortex to store an arbitrary attacker-controlled URL as a trusted "visit
source" link. `buildSourceUrl()` (`services/sourceUrlService.js`) is the
only code path that constructs it, driven purely by provider metadata
(`provider`, `messageId`) Cortex already controls — the extraction/AI layer
never touches this field.

### Decision: Source URL is durable — stored on Entity, not derived from the temporary email record

**Reasoning:** The `emails` record (not yet implemented; `DebitEmailToProcess`
stands in for it today) is retained for only 30 days and then deleted via
TTL. If `source.url` were computed on read by joining against that record,
the "visit source" link would silently stop working after 30 days even
though the Entity itself is meant to be durable knowledge. Storing the
already-built URL directly on Entity at creation time means it survives the
source email's expiry — the whole point of Entity existing separately from
`emails` in the first place.

### Decision: Gmail message ID (not thread ID) is used for source navigation

**Reasoning:** An Entity is extracted from one specific message's content;
linking to that exact message (`.../#all/<providerMessageId>`) is more
precise than linking to the whole thread, which may contain many unrelated
messages by the time the user clicks through. `emailId`/`threadId` are kept
as internal ObjectId references (so Cortex itself can reason about the
relationship) separately from `url` (which is what the user actually clicks).

### Decision: No `source.description`

**Reasoning:** Same principle as no generic status — a description of *the
business object* ("user can't log in, requested a password reset...")
belongs on the typed child entity (`Ticket.description`), not on source
metadata. `source` describes provenance (where did this come from), not
content (what does it mean).

### Decision: `source.emailId`/`source.threadId` are conditionally required, not globally required

**Reasoning:** The schema is deliberately built to support future source
types (`UPLOAD`, `API`, `MANUAL`) without a migration, per the instruction
not to hard-code Entity around Gmail forever. A file upload has no email or
thread to reference. Rather than mark these fields required at the schema
level (which would break future non-email sources) or leave them fully
optional (which would let a malformed EMAIL-sourced entity silently miss
its provenance), they're required conditionally — enforced only when
`source.type === 'EMAIL'`, which is the only source type actually
implemented right now.

### Decision: `entityId` is a plain ObjectId, not a Mongoose `ref`

**Reasoning:** A `ref` would need to name one specific model, but which
collection `entityId` points to depends on `type` (`TICKET` → `tickets`,
`INVOICE` → `invoices`, etc.) — and none of those collections exist yet.
The instruction is explicit that resolving `type` + `entityId` to the
correct typed document is an **application-level** concern, not something
Mongoose's `populate()` should do automatically. This also avoids a schema
change once each typed collection is actually built — nothing about
`entityId` needs to change when `Ticket`/`Invoice`/etc. are added.

### Decision: Existing `Entity` model replaced in place — with known, flagged breakage

**Context:** An `Entity` model already existed from an earlier iteration —
a generic, schemaless design (`entityType` + `data` blob, `sourceType`
enum, a generic `status` field) built before this spec's classifier-first,
typed-child-collection architecture was decided. It's fundamentally
incompatible with the new design (free-form data blob vs. fixed enum +
`entityId` reference; a generic status field the new spec explicitly
forbids).

**Decision:** Replaced the model in place (same name `Entity`, same
`entities` collection) rather than creating a second, differently-named
model — per the explicit instruction to inspect and decide migrate-vs-new
rather than create a duplicate.

**Known breakage, confirmed (not fixed in this phase):**
- `src/ai/features/extractEntities/repository.js` — still constructs the
  old-shape document; verified with `validateSync()` that it now fails on
  five required fields (`type`, `title`, `source`, `entityId`, `extraction`).
- `src/listing/configs/entities.listConfig.js` — filters/sorts on fields
  that no longer exist (`entityType`, `status`, `sourceType`, `sourceEmailId`,
  `extractedAt` at the top level).
- `src/graphql/resolvers.js` / `schema.js` — the `entities`/`entity` GraphQL
  surface reads `entity.entityType` etc., which no longer exist.
- `src/ai/features/extractEntities/__tests__/orchestrator.test.js` — still
  passes, but only because it fully mocks the `Entity` model
  (`jest.mock('.../models/Entity', () => ({ insertMany: jest.fn() }))`) — it
  does NOT prove the real integration still works, and it doesn't.

**Why not fixed now:** Every one of the four depends on the old
generic-extraction orchestrator (`extractEntities/orchestrator.js`), which
is itself being superseded by the classifier → thread → Entity → typed-child
pipeline this spec is building phase by phase. Rewriting them now would mean
either (a) writing throwaway code against typed collections that don't
exist yet, or (b) prematurely designing the real AI-extraction rewrite —
both explicitly out of scope ("do not implement AI extraction yet"). This
is flagged as a known gap, not a silent one.

---

## Event Entity (first typed child entity)

### Decision: `userId` added to the persisted model despite not appearing in the spec's TS interface

**Context:** The given `Event` interface has no `userId` field.

**Reasoning:** Every existing model (`User`, `Entity`, `EmailThread`,
`AppStatus`, `UserPreferences`) carries `userId` for tenant isolation, and
the listing engine's `tenantMatchFactory` pattern depends on it being
present on every queryable collection. Reading the illustrative interface as
the **public/API-facing shape** (what a client already-authenticated as a
specific user would receive back — it doesn't need its own userId echoed to
it) rather than the literal persisted-document shape, `userId` was added as
a required, indexed field on the Mongoose model. Omitting it would be a
genuine multi-tenancy bug, not spec compliance — flagging this explicitly as
a deliberate, necessary deviation rather than a silent one.

### Decision: `_id` (ObjectId), not a prefixed string like `evt_123`

**Context:** The spec's example JSON shows `"id": "evt_123"`.

**Reasoning:** The instruction explicitly prioritizes "follow the existing
project's ID generation conventions" over the illustrative example — every
model in this codebase uses Mongoose's default ObjectId `_id`, with zero
precedent for prefixed string IDs anywhere. Introducing one just for Event
would be exactly the kind of "new architectural pattern just for Event" the
instructions warn against. The `_id` → `id` string mapping (if/when Event is
exposed via GraphQL) follows the same existing convention as the `Entity`
resolver: manual mapping in the resolver layer (`id: doc._id.toString()`),
not a schema-level `toJSON` transform — there is exactly one sub-schema in
this codebase using a transform (`models/schemas/AttachmentSchema.js`, a
different, unrelated concept: full R2 storage attachment records, not a
lightweight document reference), and it's not the convention for top-level
models.

### Decision: No TypeScript types were created

**Context:** The instructions ask to "create/update corresponding
TypeScript types/interfaces."

**Reasoning:** The backend has no TypeScript anywhere — checked
exhaustively; the only `.ts` file in the entire backend
(`listing/core/types.ts`) is dead: never imported by any `.js` file, and
`typescript` isn't even a dependency, so it isn't type-checked or compiled
by anything. It appears to be a leftover documentation artifact paired with
a hand-written `types.js` that's what actually gets used at runtime.
Creating a new `.ts` file for Event would introduce a build step / tooling
pattern that doesn't exist anywhere in this project, directly against "do
not introduce a new architectural pattern just for Event." The Mongoose
schema plus JSDoc comments in `Event.js` serve the same documentation
purpose using the project's actual existing convention.

### Decision: Event has no top-level `status`, and no `entityType`/`entityId`

**Reasoning:** Directly per spec — a scheduling event has no comparable
lifecycle to a Ticket/Invoice's business status, and Event is a first-class
entity that doesn't need a self-referential pointer back to `Entity`; that
association (`Entity.type = 'EVENT'`, `Entity.entityId = event._id`) is
owned entirely by `Entity`, one-directionally. Adding a back-reference on
Event would duplicate information Entity already holds and create two
sources of truth for the same relationship.

### Decision: Generic `url` field, not `meetingUrl`

**Reasoning:** Per spec — the event's own URL may be a Google Meet link,
Zoom link, Teams link, or a registration/details page; naming it
`meetingUrl` would misdescribe the non-meeting cases. Kept structurally and
conceptually separate from `sourceUrl` (where the Event was extracted
*from*, e.g. the Gmail message) — the two can never be confused since they
serve entirely different purposes (see decisions.md's existing Entity
section on the same url-vs-sourceUrl distinction, applied consistently here).

### Decision: Attachments are `{documentId, filename}` references only

**Reasoning:** Per spec — Document ownership of storage/processing/metadata
belongs entirely to the (not yet implemented) `Document` entity. Event's
`AttachmentRefSchema` deliberately does not reuse the existing
`models/schemas/AttachmentSchema.js` (a different concept: full storage
records with `storageKey`/`mimeType`/`size` for the R2-backed attachment
system) — embedding that shape into Event would duplicate storage metadata
Document is meant to own exclusively.

### Decision: `validateExtractedEvent()` built standalone, not wired into the live orchestrator

**Reasoning:** Same precedent as `EmailThread`/`threadService` last phase —
the current orchestrator (`ai/features/extractEntities/`) is generic and
type-agnostic (freeform `entityType`/`data`), and is itself being
superseded by the classifier → thread → Entity → typed-child pipeline this
spec is building phase by phase. Wiring one type-specific validator into
that generic orchestrator now would leave it in an inconsistent
half-migrated state. `validateExtractedEvent()` is a standalone, pure,
tested function mirroring the existing `postProcessor.js` convention (never
throws; returns `{ event: null, error }` on malformed input), ready to be
called once the real classifier-driven orchestrator exists. **Flagging
explicitly, as before**: if live wiring was actually wanted now, say so.

### Decision: No GraphQL exposure added

**Reasoning:** The instruction was conditional — "update API/GraphQL
definitions if the project exposes Event through them." It doesn't yet
(the existing `entities`/`entity` GraphQL surface is already broken against
the current `Entity` model per the prior phase's flagged conflicts), so
adding Event to a currently-broken surface was skipped rather than compounding
an already-flagged gap. Will be addressed alongside fixing that surface once
enough typed entities exist to make the fix meaningful.

---

## Document Entity (second typed child entity)

### Decision: Attachment references reuse the existing `attachmentId`/`fileName` naming, not the spec's illustrative `fileId`/`filename`

**Context:** The instruction explicitly said to inspect the existing
attachment/file representation before introducing `fileId`, and reuse it if
one exists.

**Reasoning:** Found `models/schemas/AttachmentSchema.js` and
`services/attachments/attachmentService.js` — the app-wide convention is
`attachmentId` (the attachment sub-document's `_id`) and `fileName`
(camelCase), not `fileId`/`filename`. `Document.attachments[]` uses this
existing vocabulary instead.

**Important nuance surfaced:** there is no single, currently-working
"Attachment" collection to hard-reference. The attachment entity-handler
registry (`services/attachments/entityHandlers/index.js`) that owns real
attachment records is presently **all `NOT_IMPLEMENTED` stubs**
(`RECURRING_PAYMENT`/`PROFILE`/`WORKSPACE`, none reachable) — and
separately, the classifier/orchestrator pipeline fetches email attachments
live from Gmail rather than persisting them through that system at all (a
decision from the Entity-extraction phase). So reusing the *naming*
convention was straightforward; there is no real attachment record to
Mongoose-`ref` yet either way. `attachmentId` is stored as a plain string
reference, resolved at the application layer — same pattern as
`Entity.entityId` and `Event.attachments[].documentId` — not a hard
dependency on a collection that doesn't functionally exist yet.

### Decision: `party.role` is a free-form string, not an enum

**Context:** The spec lists a suggested vocabulary (`CUSTOMER`, `VENDOR`,
`PARTNER`, `ISSUER`, `RECIPIENT`, `LICENSOR`, `LICENSEE`, `OTHER`) but also
explicitly says the role "should remain flexible because different document
types have different relationships" and to never force a role the source
doesn't clearly support.

**Reasoning:** This is a genuine, explicit exception to the pattern used
everywhere else in this Entity/Event/Document work (`type`, `sourceType`
are all hard enums). Enforcing the suggested vocabulary as a Mongoose enum
would directly contradict "remain flexible" the moment a real document uses
a relationship outside that list (e.g. "WITNESS", "GUARANTOR"). `role` is
validated only as an optional trimmed string.

### Decision: `summary`'s 300-500 word target is a generation instruction, not a schema constraint

**Reasoning:** `summary` is required and non-empty at the schema level, but
there is no hard word-count validator that would reject a document for
being "too short" or "too long." A genuinely short source document (e.g. a
one-line certificate renewal notice) producing a short, accurate summary
must never be forced to pad itself to hit a word target — that would
directly contradict "do not invent information... omit it rather than
guessing," which the same spec explicitly requires. Instead,
`validateExtractedDocument()` logs a `console.warn` (matching the existing
`postProcessor.js` pattern for other non-fatal extraction concerns) when a
summary is far outside the 300-500 word range, without rejecting it —
visibility without a false rejection.

### Decision: No Document-specific extraction prompt was written

**Reasoning:** Same precedent as `Event`'s `validateExtractedEvent` — the
current orchestrator (`ai/features/extractEntities/prompt.js`) is generic
and type-agnostic, and is itself being superseded by the classifier-driven
pipeline. `validateExtractedDocument()` was built standalone (pure, tested,
never throws) as the eventual target shape for a Document-specific
extraction prompt, including the 300-500 word summary instruction encoded
as `SUMMARY_WORD_TARGET` for that future prompt to reference — but no new
prompt-builder file was created, since there is no Document-aware
orchestrator yet to wire it into. **Flagging explicitly, again**: say so if
live wiring is actually wanted now rather than continuing to build
standalone, tested pieces.

### Decision: Same ID / TypeScript / GraphQL calls as the Event phase, for the same reasons

- `_id` (Mongoose ObjectId), not a prefixed string like `doc_123` — no
  precedent anywhere in this codebase for prefixed string IDs.
- No new TypeScript files — the backend has no real TypeScript anywhere
  (verified again; unchanged since the Event phase).
- No GraphQL exposure added — the `entities`/`entity` surface is still
  broken from the `Entity` model replacement two phases ago; adding
  `Document` to it now would compound an already-flagged, unfixed gap
  rather than resolve it.

---

## Invoice, Payment, and Reconciliation

### Decision: `threadId`/`messageId` are raw provider strings, not internal ObjectId refs — a deliberate divergence from `Entity.source`

**Context:** `Entity.source.threadId`/`source.emailId` (built two phases
ago) are Mongoose `ref`s to internal `EmailThread`/`DebitEmailToProcess`
documents. This phase's spec instead describes reconciliation as direct
equality — `Invoice.threadId === newEmail.threadId` — against Gmail's own
raw thread/message id strings.

**Reasoning:** Reconciliation has to compare an incoming webhook's raw
Gmail `threadId`/`messageId` against what's stored on existing
Invoice/Payment/Event/Document records *before* any internal-id lookup
would even be possible — resolving a raw Gmail id to our internal
`EmailThread._id` first, just to compare `_id`s, adds a lookup with no
benefit over comparing the raw strings directly. `threadId`/`messageId` on
Invoice, Payment, and (retroactively) Event/Document are therefore plain
strings holding the same raw values as `EmailThread.providerThreadId` and
`DebitEmailToProcess.messageId` — not `ref`s. **Flagging this explicitly**:
this is a real inconsistency with `Entity.source`'s design, not an
oversight — an internal-ref lookup is still one query away whenever
actually needed (`EmailThread.findOne({ userId, providerThreadId: doc.threadId })`).

### Decision: Retrofitted `threadId`/`messageId` onto the already-built `Event`/`Document` models

**Context:** This message states the four provenance fields "should remain
consistent across all entities," but `Event`/`Document` (built in prior
phases) only had `sourceUrl`/`sourceType` — no `threadId`/`messageId`.

**Reasoning:** Rather than leave a known, newly-surfaced inconsistency in
already-written (but still uncommitted) code, both models were retrofitted:
`threadId` (optional string) and `messageId` (required only when
`sourceType === 'EMAIL'`, matching the conditional-required pattern already
used elsewhere). Both models' test suites and `validateExtracted*`
functions were updated accordingly — verified via the full test run, not
just asserted. This was a judgment call made without asking first, since it
was small, additive, backward-compatible, and directly requested by name
("these fields should remain consistent across all entities") — flagged
here in case the intent was actually narrower (Invoice/Payment only).

### Decision: `PersonSchema`/`MoneySchema` extracted into `models/schemas/`

**Reasoning:** `{name?, email?}` was independently duplicated in `Event.js`
(as an inline `PersonSchema`) and `Document.js` (as an inline
`IssuerSchema`, identical shape) even before this phase added two more
duplicates (`Invoice.issuer`, `Payment.payer`/`payee`). This exact pattern
— a reusable embedded sub-schema shared across models — already has a
precedent in this codebase (`models/schemas/AttachmentSchema.js`, whose own
comment says "do NOT create per-entity copies of this schema"). Extracted
both into `models/schemas/PersonSchema.js` and the new
`models/schemas/MoneySchema.js` (`{value, currency?}`, needed identically
by `Invoice.amount` and `Payment.amount`), and updated `Event.js`/
`Document.js` to import rather than redefine. This is the one place this
phase touched already-shipped code beyond additive fields — done because
it's the exact established pattern for this exact situation, not a
speculative refactor.

### Decision: Invoice carries a business `status`; Payment does not

**Reasoning:** Per spec — Invoice has a genuine financial lifecycle
(`UNPAID → PAID`/`OVERDUE`) the same way Ticket will, unlike Event/Document
which have no comparable lifecycle. Payment has no equivalent: a Payment
either was successfully extracted (it exists) or wasn't; there's no
"payment status" distinct from "did this settle an invoice," and that
question is answered by `Invoice.status`, not a field on `Payment` itself.
Adding one would have been exactly the kind of field not asked for and not
justified by the given shape.

### Decision: `Invoice.status` defaults to `UNPAID`, and nothing in this phase sets it to `PAID` automatically

**Reasoning:** Per spec — "do not mark an Invoice as PAID solely because an
email contains vague language." `validateExtractedInvoice()` accepts a
status value if the extraction already supplies a valid one, but defaults
to `UNPAID`, and nothing built in this phase transitions an existing
Invoice to `PAID` — that transition is explicitly a reconciliation-pipeline
responsibility (find matching invoice → link Payment → **then** update
status), and the pipeline itself isn't wired yet (see below). There's
intentionally no code path anywhere in this phase that can produce a false
`PAID`.

### Decision: `conversation` uses `direction: "SENT"|"RECEIVED"`, not `fromUser: boolean`

**Reasoning:** Directly per spec's explicit instruction. A boolean loses
information a future third scenario (e.g. a third-party CC, or a
system-generated notification) might need to express; an enum extends
without a breaking change. Verified via a schema-inspection test that no
`fromUser` field exists.

### Decision: `conversation` lives only on Invoice, not Payment

**Reasoning:** The spec scopes conversation preservation to Invoice
specifically ("For Invoice, we may want to preserve relevant messages...").
Payment has no equivalent described need — a Payment already carries its
own `sourceUrl`/`threadId`/`messageId` provenance; there's no described use
case for it to separately accumulate a conversation log.

### Decision: The message-tracking/idempotency requirement is already fully satisfied by the existing `DebitEmailToProcess` design — no new tracking collection was built

**Investigation, not assumption:** Traced `syncEmailsService.js` end to
end. `DebitEmailToProcess` is created for **every** synced Gmail message
before classification/extraction happens — including messages that produce
no entity at all ("I'll get back to you tomorrow") — via a unique index on
`messageId`. `saveEmailToProcess()` already catches MongoDB's `E11000`
duplicate-key error and logs "already queued" without throwing or creating
a duplicate; `syncHistorySince()` additionally pre-checks
`DebitEmailToProcess.exists({ messageId })` before even fetching the
message from Gmail, purely as a fetch-avoidance optimization — the actual
correctness guarantee is the unique index, not this pre-check (a race
between two concurrent calls is resolved by the database, not the
application). This is exactly the "atomic database operation / unique
constraint" the spec asks for, and exactly the "global message tracking
mechanism, even for emails that produce no entity" it asks for — both
already exist. Per the explicit instruction not to duplicate a suitable
existing system, nothing new was built for this requirement; this was
verified by reading the actual code path, not assumed from the model name.

### Decision: Reconciliation is a standalone, deterministic scoring module — the LLM's relevance/confirmation judgment is explicitly NOT implemented

**Reasoning:** The spec is explicit that two different judgments are
involved: (1) *is this new email meaningfully relevant to an existing
Invoice/does it describe a payment confirmation* — an inherently semantic
judgment the spec assigns to the LLM — and (2) *given a payment has been
identified, which invoice (if any) does it settle* — a matching problem
against structured evidence (invoice number, transaction reference, amount,
payer/payee, thread). Only (2) is implemented, as
`paymentReconciliationService.findMatchingInvoice()` — a pure, deterministic
function reusing the same weighted-signal-scoring pattern as the email
classifier (`classifier/classifier.js`): each piece of evidence contributes
a weight, and a match is only accepted at or above `MATCH_THRESHOLD` (0.6).
This directly encodes "do not blindly link on amount alone" — `exact_amount`
alone (0.35) never clears the threshold by itself; either one very strong
signal (exact invoice number or transaction reference match, weight 1.0) or
two corroborating weaker signals (e.g. same-thread + exact-amount = 0.65, or
exact-amount + payee-matches-issuer = 0.60) are required. Verified against
both of the spec's own worked examples (the same-thread payment-confirmation
reply, and the different-thread bank-confirmation email) plus a
multiple-candidates and a currency-mismatch case.

**Deliberately not built, consistent with every prior phase's precedent:**
the actual LLM call that judges "is this new thread message relevant" or
"does this email describe a payment confirmation," and wiring any of
Invoice/Payment/reconciliation into the live `syncEmailsService.js` /
orchestrator pipeline. Both remain squarely "AI extraction," out of scope
for a schema/design phase. **Flagging again, as in every prior phase**:
say so if live wiring is actually wanted now.

### Decision: `invoiceId`/party-matching evidence (e.g. a stated transaction reference) is never persisted as a guessed field on Payment

**Reasoning:** `validateExtractedPayment()` deliberately ignores/discards
any `invoiceId` present in raw LLM output (even logging it as ignored in
tests) — linking is exclusively `paymentReconciliationService`'s job, gated
on evidence, never a pass-through of whatever the extraction layer guessed.
This closes off an obvious foot-gun: an LLM could otherwise "helpfully"
guess an invoice number that turns out wrong, and that association would
persist as ground truth with no scoring/threshold check at all.

---

## Invoice Attachments and the Reply-to-Payment Relationship

### Decision: Attachments live per-message inside `conversation`, not as a separate top-level `Invoice.attachments` field

**Reasoning:** An attachment is a fact about one specific email (the
original message's invoice PDF, a later reply's payment receipt) — not
about the Invoice as an abstract whole. Attaching it to the conversation
entry that actually carried it preserves that connection; a flat top-level
list would lose which message each file came from. If a flattened "all
files across this Invoice" view is ever needed, it's a trivial derived
read (`invoice.conversation.flatMap(m => m.attachments)`), not something
worth storing twice.

### Decision: Extracted a shared `AttachmentRefSchema` — but kept it distinct from `Event.attachments[].documentId`

**Context:** `Document.js` already had this exact `{attachmentId, fileName}`
shape inline; `Invoice.conversation[].attachments` needed the identical
shape a third time.

**Reasoning:** Same pattern as `PersonSchema`/`MoneySchema` — extracted into
`models/schemas/AttachmentRefSchema.js`, imported by both `Document.js` and
`Invoice.js`. Deliberately did **not** merge this with `Event.js`'s own
`AttachmentRefSchema` (`{documentId, filename}`), even though the names
look similar — they reference two different kinds of things: a Document
*entity* (a business object) vs. a physical *file* (raw attachment bytes).
Merging them would blur that distinction the first time someone tried to
reuse one where the other was meant.

### Decision: A reply-turned-Payment does not duplicate itself onto `Payment` — the same message plays two independent, non-duplicating roles

**The question this answers:** when a reply to an Invoice thread turns out
to be a payment confirmation, does `Payment` need its own conversation log
too?

**Answer: no.** The single Gmail message plays two roles once
reconciliation runs:
1. It gets appended to `Invoice.conversation[]` (via
   `validateConversationMessage()`, new this phase) — preserving it as
   context on the Invoice, exactly as before.
2. It independently becomes the *source* of a new `Payment` document —
   `Payment.messageId`/`threadId`/`sourceUrl` already identify precisely
   which message produced it.

These two facts are linked implicitly: `Payment.messageId` will equal one
of the entries in `Invoice.conversation[].messageId`. No new field was
added to `Payment` to make this explicit, because doing so would duplicate
data `Invoice.conversation` already holds — the same reasoning already
applied to why `conversation` lives only on Invoice, not Payment, extended
one step further. Added a test (`Invoice.test.js` — "Reply-turned-payment")
that documents this relationship directly, since it's easy to assume
"conversation" needs to exist on both sides when it doesn't.

**Still not wired (unchanged from prior phases):** the actual
reconciliation trigger — noticing a reply arrived, deciding it's relevant,
appending it via `validateConversationMessage()`, and separately running
`paymentReconciliationService` against it — remains AI-extraction/
orchestrator work, not built yet.

---

## Multiple Payments per Invoice, PARTIALLY_PAID, and linkMethod

### Decision: `Invoice.status` gains `PARTIALLY_PAID`; no `amountPaid` field was added

**Reasoning:** Once multiple Payments can link to one Invoice, partial
payment is a real case the two-state UNPAID/PAID split couldn't represent.
Rather than store a running `amountPaid` total on Invoice (which would need
to be kept in sync every time a payment links or unlinks — the same
dual-source-of-truth risk already avoided by not storing a `payments[]`
array on Invoice), added `determineInvoiceStatus()` — a pure function that
derives status on demand from the Invoice's amount/due date and its
currently-linked Payments. `Invoice.status` itself is still a stored field
(set by whatever code links/unlinks a payment, calling this function), but
nothing about *how much has been paid* is duplicated anywhere.

**Status precedence, a judgment call, not a spec requirement:** when a
partial payment exists AND the due date has passed, `PARTIALLY_PAID` wins
over `OVERDUE` — once any money has moved, that's treated as more useful
information than a static "overdue" flag. Flagging this specifically since
reasonable people could want it the other way (surface OVERDUE as an
urgency signal regardless of partial payment) — easy to flip if so.

**Currency safety:** payments in a different currency than the invoice are
excluded from the paid-total calculation (and logged, not silently summed)
— the same principle already applied everywhere else money gets compared
in this codebase (`amountsMatch()` in the reconciliation service).

### Decision: No `payments[]` array on Invoice — the payments tab queries `Payment.find({ invoiceId })` directly

**Reasoning:** This was your own call, and it's the right one for the same
reason `amountPaid` wasn't stored: `Payment.invoiceId` is already the
single source of truth for "which payments belong to this invoice";
duplicating that as a denormalized list on Invoice would mean keeping two
places in sync on every link/unlink, for a query MongoDB already answers
efficiently via the existing `{userId, invoiceId}` index on Payment.

### Decision: `Payment.linkMethod` (`THREAD_CONTEXT` | `RECONCILED` | `MANUAL`) records HOW a link was established — but never makes it permanent

**Context:** The original proposal was "if the payment came from the same
message/thread as the invoice, it cannot be unlinked." Agreed with the
underlying instinct (a same-thread reply is materially more trustworthy
than a cross-thread reconciliation match) but pushed back on making it
irreversible.

**Reasoning for rejecting a hard block:** this system's entire design so
far has been built around the idea that even strong-looking evidence can
be wrong — "do not assume every thread message is relevant," "do not
blindly link on amount alone," the existence of a manual-override path at
all (scenario 3). A same-thread reply *can* still be a misread by the AI
extraction layer. Removing the ability to correct that mistake is worse
than the small risk of an accidental unlink. Instead: `linkMethod` is
recorded, and `requiresUnlinkConfirmation(payment)` returns true only for
`THREAD_CONTEXT`, meant to gate a confirm-twice UI step, not a rejection.

**How `linkMethod` gets its value — same scoring function, one derived bit:**
scenario 2 (bank email, different thread) and scenario 4 (same-thread
reply) both go through the identical `findMatchingInvoice()` scoring
function — the only difference is whether the `same_thread` signal
contributed to the match. `determineLinkMethod(matchResult)` (added to
`paymentReconciliationService.js`) reads exactly that:
`matchedSignals.includes('same_thread')` → `THREAD_CONTEXT`, otherwise
`RECONCILED`. `MANUAL` is never derived here — it's set directly whenever
scenario 3's (not yet built) manual-link action runs, since that path
never calls the scoring function at all.

**Schema-level consistency, both directions:** `linkMethod` is required
exactly when `invoiceId` is set, and rejected if set while `invoiceId` is
null — an unlinked payment with a recorded "how it was linked" is just as
inconsistent a state as a linked payment with no recorded method.

**Still not built:** the actual "unlink" mutation/API that would call
`requiresUnlinkConfirmation()` and the manual-link action that would set
`linkMethod: 'MANUAL'` — both are the same kind of live-wiring work
deferred throughout every phase so far.

---

## Reconciliation Flow — Reference Scenarios

The individual decisions above were made piece by piece; this section
walks through the four scenarios that motivated them end to end, so the
overall flow is readable in one place instead of scattered across entries.
Each scenario names exactly which built pieces are involved and which part
is still missing (the AI/orchestrator glue — consistent gap across all
four, not repeated per scenario below except where it matters).

### Scenario 1 — A message is identified as an Invoice

```
Email arrives → classifier (classifier/classifier.js) scores candidates,
INVOICE wins
  → [MISSING: AI extraction reads the email, produces raw invoice fields]
  → validateExtractedInvoice() (Invoice.js) validates/normalizes the AI's
    output — malformed output never reaches the database
  → Invoice created — status defaults to UNPAID (never PAID from
    extraction alone, regardless of vague language in the source)
  → an Entity record is created pointing at it (entityId = invoice._id)
```

### Scenario 2 — A message is identified as a Payment (e.g. a bank debit alert)

```
Email arrives → classifier scores candidates, PAYMENT wins
  → [MISSING: AI extraction produces raw payment fields]
  → validateExtractedPayment() (Payment.js) validates/normalizes —
    invoiceId is always forced to null here regardless of what the AI
    guessed; linking is never a byproduct of extraction
  → Payment created
  → [MISSING: the code that fetches this user's candidate invoices and
    calls the function below — findMatchingInvoice() itself is built,
    the caller that gathers candidates and persists the result is not]
  → paymentReconciliationService.findMatchingInvoice(evidence, candidates)
    scores each candidate; below MATCH_THRESHOLD (0.6) → no link, Payment
    persists with invoiceId: null (this is the "bank alert with only a
    matching amount, nothing else" case — deliberately unlinked)
  → if a match clears the threshold: determineLinkMethod(matchResult) →
    'RECONCILED' (same_thread did NOT contribute) → payment.invoiceId set,
    payment.linkMethod = 'RECONCILED' → Invoice status re-derived via
    determineInvoiceStatus() using all of that invoice's linked Payments
```

Known current limitation, surfaced while discussing this scenario:
`personMatches()` (used for the payee-matches-issuer signal) does exact,
case-insensitive string comparison — "Acme Corporation" will NOT match
"Acme Corp" today. A bank email naming the vendor slightly differently
than the original invoice's issuer name will fail to link on that signal
alone. Not fixed yet — flagged as a real gap, not a hidden one; the fix
would be name-normalization (stripping Corp/Corporation/Inc/Ltd suffixes)
or fuzzy matching in `personMatches()`, with its own test coverage for the
Acme Corp / Acme Corporation case specifically.

### Scenario 3 — The user manually links a Payment to an Invoice

```
User selects Payment X and Invoice Y in the UI
  → [MISSING: the mutation itself does not exist yet]
  → intended behavior: payment.invoiceId = Y directly, NO scoring/threshold
    check (a human assertion is treated as higher-confidence than any
    automated match by construction) — payment.linkMethod = 'MANUAL'
  → Invoice status re-derived via determineInvoiceStatus(), same as any
    other link
```

This is the one scenario with essentially nothing built yet beyond the
schema support (`linkMethod: 'MANUAL'` already exists as a valid enum
value) — no UI, no mutation, no resolver. Called out specifically because
it would be easy to assume it's covered by the reconciliation service,
which it deliberately is not and should not be — see the `linkMethod`
decision above for why manual links skip scoring entirely.

### Scenario 4 — A reply arrives in the invoice's own thread ("Received 5000 thanks")

```
Reply arrives, same Gmail threadId as an existing Invoice
  → [MISSING: noticing this thread already has an Invoice, and the AI
    judgment call on whether this specific reply is meaningful at all —
    "have a great day" must be ignored, "received 5000" must not]
  → validateConversationMessage() (Invoice.js) normalizes the reply —
    appended to Invoice.conversation[] regardless of whether it turns out
    to be a payment confirmation, as long as it's judged relevant
  → if judged to be a payment confirmation: a NEW Payment is created
    (same path as scenario 2) — the reply is a source of a new fact, not
    just a status flip on the Invoice
  → findMatchingInvoice() scores this payment against the same-thread
    Invoice: same_thread (0.3) + exact_amount (0.35) = 0.65, clears
    MATCH_THRESHOLD
  → determineLinkMethod(matchResult) → 'THREAD_CONTEXT' (same_thread WAS
    part of the match) → payment.invoiceId set, payment.linkMethod =
    'THREAD_CONTEXT' → this link requires confirmation to undo
    (requiresUnlinkConfirmation() returns true), unlike scenario 2's
    'RECONCILED' link
  → Invoice status re-derived — PAID if this fully covers the amount,
    PARTIALLY_PAID if it only covers part of it
```

This is the scenario that ties every piece from this whole Invoice/Payment
phase together in one place: classification, conversation storage,
reconciliation scoring, `linkMethod` derivation, and status re-derivation
all participate in a single incoming reply. It's also the scenario with
the most direct test coverage already in place — `findMatchingInvoice()`'s
same-thread test and `determineLinkMethod()`'s `THREAD_CONTEXT` test
together cover exactly this path's matching/labeling logic, even though
the AI judgment call and the orchestration code that strings these pieces
together in sequence are still missing.

### What's common to all four, worth saying once instead of four times

Every scenario's "back half" — schema validation, matching, status
derivation, link-method labeling — is built and tested. Every scenario's
"front half" — the AI call that turns raw email content into structured
candidate data, and the orchestration code that decides which function
runs in which order — is not. This has been true and explicitly flagged
since the very first Entity/Event/Document phases; nothing about the
Invoice/Payment work changes that boundary, it just makes the shape of the
missing piece more concrete now that there's a full scenario set to point
at.

---

## Ticket Entity

### Decision: `conversation` (schema + `validateConversationMessage`) extracted into a shared file

**Reasoning:** Ticket needs the exact same `{messageId, direction, content,
timestamp, attachments}` shape and validator Invoice already had. Moved
both into `models/schemas/ConversationMessageSchema.js` and retrofitted
`Invoice.js` to import rather than define its own copy — same extraction
pattern as `PersonSchema`/`MoneySchema`/`AttachmentRefSchema`. Verified the
two models now literally share the same Mongoose sub-schema instance
(tested directly: `Ticket.schema.path('conversation').schema === Invoice.schema.path('conversation').schema`).

### Decision: `createdOn` is just `createdAt` — no separate field was added

**Reasoning:** Every model already gets `createdAt`/`updatedAt`
automatically via `timestamps: true`. Adding a second, differently-named
field for the identical concept would create a "which one is authoritative"
ambiguity for no benefit. `Ticket.createdAt` is what `createdOn` meant.

### Decision: `RESOLVED` added to the status enum (confirmed, not assumed)

Final: `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `RESOLVED`, `CLOSED`. The original
field list given didn't include it; flagged the discrepancy against the
very first architecture sketch (which did have it) and got explicit
confirmation before adding it, rather than silently picking one version.

### Decision: `urgency` and `priority` are two separate fields, both optional, never guessed

**Reasoning:** They answer different questions — urgency is how
time-sensitive the issue is from the reporter's side; priority is the
business's assigned importance, which can diverge (a VIP customer's minor
issue can be high-priority despite low inherent urgency). Both use the
same `LOW/MEDIUM/HIGH/CRITICAL` value set but are independent fields, not
one derived from the other. Neither is defaulted to a guessed value when
the source gives no signal — same "do not invent" principle as everywhere
else (Invoice.dueDate, Document.effectiveDate, etc.).

### Decision: `ticketNumber` added — not originally in the given field list, my own suggestion

**Reasoning:** The classifier already has a `ticket_number_pattern` rule
(`classifier/rules/ticket.rules.js`) specifically detecting things like
"Ticket #12345"/"Case #123" — it would have been a real gap to detect that
signal and have nowhere in the schema to persist it. Same pattern as
`Invoice.invoiceNumber`/`Document.documentNumber`: only populated when an
actual number is present in the source, never generated.

### Decision: `assignee` is manual/mock-only — the schema allows it, extraction never sets it

**Confirmed directly**: this is a mock system with no real staff/user
directory, and assignment is a human selection, not something an email
could ever state. `validateExtractedTicket()` forces `assignee: null`
unconditionally, discarding whatever the AI output might contain for it —
same principle as `Payment.invoiceId` never being a pass-through of the
AI's guess. `requester`, in contrast, CAN be populated from extraction
(usually inferable from the sender), with the same caution already applied
to `Event.organizer`/`Document.issuer`: not assumed automatically, only set
when the source gives actual evidence.

### Decision: `parentTicketId`/`duplicateOfTicketId` — stored on the child/duplicate side, never set by extraction

**Reasoning, relationship modeling:** Same "store the FK on the many/
pointing side, don't duplicate as an array" principle already applied to
`Payment.invoiceId` (not `Invoice.payments[]`). A ticket's children:
`Ticket.find({ parentTicketId: ticket._id })`; its duplicates:
`Ticket.find({ duplicateOfTicketId: ticket._id })`. No `childTicketIds[]`/
`duplicateTicketIds[]` array exists on the parent/canonical ticket.

**Reasoning, never AI-set:** Detecting "is this a duplicate of an existing
open ticket" or "is this a sub-task of that other ticket" is an
evidence-based matching problem — structurally the same kind of decision
`paymentReconciliationService.findMatchingInvoice()` makes for
Payment↔Invoice, not something to let a single extraction pass guess at
directly. `validateExtractedTicket()` forces both fields to null
unconditionally. **Deliberately not built yet**: the equivalent
`ticketReconciliationService`-style matching logic (e.g. same thread + same
requester + similar title → likely a duplicate) — this is squarely the
next kind of "AI-extraction-adjacent but still deterministic" work in the
same shape as the payment reconciliation service, flagged the same way
every prior phase's missing piece has been.

---

## Entity.displayId

### Decision: `displayId` lives only on `Entity`, not duplicated onto the typed children

**Reasoning:** Same "derive, don't duplicate" principle applied throughout
— anything that already has an Entity record (which is how `type` +
`entityId` get resolved to the typed child in the first place) already has
access to `entity.displayId` without needing a second copy stored on
`Ticket`/`Invoice`/etc.

### Decision: The type→prefix mapping is an explicit table, not a substring of the type name

**Reasoning:** `EVENT`'s natural abbreviation is `EVT`, not the first three
letters `EVE`; `TICKET`'s is `TKT`, not `TIC`. Blind truncation would
produce unreadable or misleading prefixes for at least two of the five
types. `ENTITY_TYPE_PREFIXES` (in `Entity.js`, next to `ENTITY_TYPES`) is
the single source of truth `displayIdService.js` reads from.

### Decision: Sequences are scoped per `(userId, type)`, not global

**Reasoning:** A single global counter per type would make the numbers
meaningless to any individual user (why is my first ticket "TKT-047"?) and
would leak cross-user volume information (how many tickets has anyone
ever created). Each user gets their own "TKT-001, TKT-002, ..." series per
type — the counter key is `"<userId>:<type>"`.

### Decision: A new `Counter` model + `displayIdService.generateDisplayId()` — the first non-pure function added in this whole Entity/Ticket/Invoice/Payment body of work

**Reasoning:** Every other `validateExtracted*`/`determine*` function
built across these phases is a pure, synchronous, DB-independent function
— deliberately testable via `validateSync()` or plain assertions with zero
setup. A truly sequential, gap-free, collision-free number cannot be
generated that way — it requires a coordinated database write. Rather than
the unsafe `Entity.countDocuments({userId, type}) + 1` approach (racy under
concurrency: two simultaneous creates could both read the same count and
both try to use the same next number), `generateDisplayId()` uses the
standard MongoDB atomic-counter pattern: `findOneAndUpdate` with `$inc` and
`upsert: true` on a dedicated `Counter` document. MongoDB serializes
concurrent `$inc` operations on the same document, so no duplicate-key
retry logic is needed here (contrast with `EmailThread.findOrCreateThread`,
which does need one — that function is racing to *create* a new document;
this one is only ever *incrementing* an existing/upserted one, a
fundamentally race-free operation by construction).

**Tested the same way as every other DB-touching piece in this codebase**:
`Counter` is `jest.mock`'d (no in-memory Mongo exists anywhere here),
verifying the exact `$inc`/`upsert` call shape and the resulting
`PREFIX-NNN` string, rather than exercising a real database.

### Decision: Padding is a minimum, not a fixed width — "TKT-1000" after 999, never truncated or reset

**Reasoning:** Zero-padding to 3 digits (`TKT-001`) is purely cosmetic
below 1000; forcing a fixed 3-character numeric field would either
truncate a 4-digit sequence or require a schema change once any user's
count of one entity type exceeds 999. `String(seq).padStart(3, '0')`
naturally produces `"1000"` unpadded once it's already ≥3 digits — verified
with a test specifically for the 1000th ticket.

### Decision: `Entity.displayId` uniqueness is scoped to `(userId, displayId)`, matching the `EmailThread` precedent

Same reasoning already applied to `EmailThread.providerThreadId`: a
per-user unique index, not a global one — two different users legitimately
having their own "TKT-001" is expected and correct, not a collision.

---

## Wiring the classifier into live ingestion + DebitEmail→Email rename

### Decision: `classifier.classify()` is now the ingestion gate — an email is only persisted if it matches at least one rule set

**Context:** Every prior phase built the classifier, `EmailThread`, and all
five typed entities as pure, tested, standalone pieces, explicitly *not*
wired into the live `syncEmailsService.js` → `DebitEmailToProcess` path
(flagged repeatedly: "if the intent was actually to wire this into the
live pipeline right now, say so"). That instruction has now been given.
This phase is step one of that wiring — ingestion and storage only, not
the orchestrator/extraction rewrite (still the next phase).

**Change:** `syncEmailsService.processEmail()` now calls `classifyEmail()`
(the existing normalize+classify convenience wrapper) on every synced
message before persisting anything. Zero candidates → the email is
discarded (logged, not stored). One or more candidates → the email is
persisted with its full `classification.candidates` list attached, so the
orchestrator phase can consume the classifier's output without
reclassifying.

**Flagged deviation from the existing message-tracking design:** the
Invoice/Payment phase established `DebitEmailToProcess` as the global,
"track every synced message, even ones producing no entity" dedup
mechanism specifically so duplicate webhook/history-sync deliveries are
caught by the unique index on `messageId`. Gating storage on classifier
eligibility means a rejected email now leaves **no record at all** — a
real, intentional change to that design, not an oversight.

This is judged safe: `classify()` is a pure, side-effect-free function, so
re-classifying the same rejected message on a later duplicate
sync/webhook is cheap and always produces the same (still-rejected)
outcome — there is nothing to deduplicate for a message that was never
persisted in the first place. The tradeoff actually accepted is losing an
audit trail of what was discarded and why; nothing currently reads or
needs that trail, but it's worth knowing if a future requirement
("show me what Cortex ignored and why") needs it.

### Decision: conversation-linking (matching a new message to an existing Invoice/Ticket by `threadId`) is explicitly orchestrator work, not ingestion work

Per this document's own Scenario 4 (the reply-to-invoice-thread
walkthrough), deciding whether a reply is actually *relevant* enough to
append to `conversation[]` — "received 5000, thanks" must be appended,
"have a great day" must not — is a semantic judgment this project has
consistently assigned to the AI layer, and `validateConversationMessage()`
already expects that judgment to have been made before it's called.
Ingestion's responsibility, already satisfied, is narrower: capture
`threadId`/`messageId` faithfully on every persisted record so the
orchestrator can later do the cheap, deterministic half itself
(`Invoice.findOne({ userId, threadId })` / `Ticket.findOne(...)`) before
making the AI relevance call. No new ingestion-side lookup was added for
this — there's nothing to gain by pre-computing it before an orchestrator
exists to consume it.

### Decision: renamed `DebitEmailToProcess`/`debitEmailProcessorService`/`debitEmailsToProcess` (and `AppStatus`'s `debitProcessingInProgress`/`lastDebitAIProcess*` fields) to generic `Email*` names

**Reasoning:** These names are leftovers from this codebase's origin as an
"Expense tracker" (see `ab55a47`) — before the finance-specific modules
were removed and the project became a generic knowledge-base pipeline.
`syncEmailsService.js` already had a comment admitting this ("Cortex has
no finance-specific ingestion filter"). Renamed to
`EmailToProcess`/`emailProcessorService`/`emailsToProcess` (collection)/
`processEmails`/`getEmailsToProcess`/`getEmailsToProcessByStatus`, and
`AppStatus.emailProcessingInProgress`/`lastEmailAIProcess*`, across the
model, service, GraphQL schema/resolvers, and the one frontend component
that calls them (`ProcessDebitEmailAlert.tsx` → `ProcessEmailAlert.tsx`,
including fixing its copy, which still said "transaction emails" /
"synced to your Google Sheet" — stale text from the same finance-era
origin, unrelated to what Cortex actually does).

**No data migration:** the old `debitEmailsToProcess` collection is
30-day TTL and `AI_PROVIDER=mock` everywhere today (local and production
env files) — there is no real extraction traffic to preserve. Old
documents simply expire under their existing TTL; new ones land in the
renamed `emailsToProcess` collection.

### Discovered, not fixed: `extractEmailSnapshot` cannot currently be unit-tested directly

While adding test coverage for this phase (`syncEmailsService.js` had
none at all before this), `utils/helpers.js#extractEmailSnapshot`'s
`await import('email-reply-parser')` (a dynamic import of an ESM-only
package) fails under this project's plain Jest config with
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` — Jest isn't configured
with `--experimental-vm-modules` or a babel transform that would handle
it. This is pre-existing (the import predates this phase) and is exactly
why no test ever covered this function. Worked around here by mocking
`extractEmailSnapshot` entirely in `syncEmailsService.test.js` (this
phase's tests cover what `processEmail` does with its output, not the
MIME/HTML-parsing internals). Not fixed as part of this phase — it's a
Jest/tooling configuration change, out of scope for an ingestion-gating
task — but flagged since it blocks testing this function directly, and
the new `cleanText` field added this phase couldn't be given its own
direct unit test as a result.

### Deliberately cut in this phase

- Rewriting the AI orchestrator, or updating `EmailToProcess.status`
  based on extraction output/error — next phase.
- Any actual Invoice/Ticket conversation-linking logic — orchestrator
  work, per above.
- Fixing the Jest/dynamic-import gap described above.

---

## Email Processor — Idempotency Hardening & Missed-Email Recovery

Audited the full ingestion/processing pipeline end to end
(`syncEmailsService.js`, `emailProcessorService.js`, `webhookController.js`,
`resolvers.js`'s manual sync mutation, `passport.js`'s login-time recovery)
for two specific failure classes: a message processed more than once
producing duplicate side effects, and a message silently never processed at
all. Four concrete gaps were found and fixed; one adjacent gap was found and
deliberately left alone (see below).

### Gap 1 (critical): a crash mid-AI-batch stranded emails in `PROCESSING` forever

**Investigation:** `processEmails()`'s atomic lock (`findOneAndUpdate` to
`PROCESSING`) is correct for preventing two workers from processing the same
email concurrently, but `PROCESSING` was never included in `allowedStatuses`
for re-locking, and no code anywhere reset it. If the process died (crash,
OOM-kill, deploy) between acquiring the lock and writing a terminal status,
that email became permanently invisible: the default query only looks at
`DETECTED`, and even an explicit `status: "PROCESSING"` query couldn't
re-lock it. This is exactly a "missed email," just at the AI-processing
stage instead of the ingestion stage — no error surfaced anywhere, since
nothing ever looked at it again.

**Fix:** added `EmailToProcess.processingStartedAt` (set when a lock is
acquired, cleared on every terminal transition) and
`reclaimStaleProcessing(userId)`, called at the top of every `processEmails()`
run, which atomically resets any `PROCESSING` record older than
`PROCESSING_STALE_TIMEOUT_MS` (10 min) back to `RETRY_PENDING`. This is the
same crash-recovery shape already used twice elsewhere in this codebase —
`AppStatus.emailSyncStatus`/`syncStartedAt` (webhook lock) and
`AppStatus.emailProcessingInProgress`/`lastEmailAIProcessStartedAt`
(resolver-level lock) — applied here at the level of an individual queued
email rather than the whole batch run.

**Known adjacent gap, not fixed:** if a worker crashes *after*
`extractEntitiesFromEmail()` successfully persists entities but *before* the
status update to `LLM_PROCESSED` commits, a reclaim-and-retry will re-run
extraction and (once `repository.js`'s known schema mismatch — see the
Entity Model section above — is eventually fixed so this path can succeed at
all) could persist duplicate entities. `repository.js`/the generic
orchestrator is already flagged throughout this document as a legacy path
being superseded by the classifier → thread → Entity pipeline, so hardening
it against this specific race wasn't done here — real idempotency for entity
creation (e.g. an `(sourceEmailId)`-scoped upsert or a dedupe check in
`persistEntities`) belongs in whichever orchestrator actually ships, not in
this reliability pass. Flagging explicitly per this document's established
practice, rather than leaving it a silent gap.

### Gap 2 (high): a webhook whose `historyId` expired had no recovery path

**Investigation:** Gmail's History API rejects a `startHistoryId` that's too
old (returns 404/410 once the mailbox's history window has rolled past it).
`config/passport.js#triggerLoginSync` already handles this correctly — on a
`syncHistorySince` failure it falls back to `syncEmailsByLookback()` using
`UserPreferences.emailSyncStartDate`. The live webhook handler
(`webhookController.js#processNotificationAsync`) had no equivalent: a
`syncHistorySince` throw was caught by the outer catch-all, logged, and
nothing else happened — `User.historyId` never advanced, so the *next*
webhook delivery would hit the exact same expired `historyId` and fail
identically, forever. For an account with a long-lived session (no reason to
log in again soon), this meant real-time email ingestion could silently stop
for an indefinite period, discovered only if/when the user next logged in.

**Fix:** `webhookController.js#recoverFromExpiredHistoryId()` — on a
`syncHistorySince` throw, re-establish a fresh anchor via
`gmailService.setupWatch()` (safe to call anytime; also renews the watch)
and backfill the gap via `syncEmailsByLookback()`, preferring
`AppStatus.emailLastSyncedAt` (more precise for an active mailbox) and
falling back to `UserPreferences.emailSyncStartDate`, then a bare 24h window
if neither exists. `User.historyId` is then set to the fresh value so the
next webhook resumes from a valid cursor instead of repeating the same
failure.

### Gap 3 & 4 (moderate): `syncRecentEmails`/`syncEmailsByLookback` could silently drop emails or wedge on one bad message

**Investigation:** `syncHistorySince()` already had the right policy —
track per-message failures, skip messages that have become "poison"
(`AppStatus.syncFailures` + `MAX_SYNC_FAILURES`, an existing mechanism), and
only advance the cursor once nothing is left un-retried. Neither
`syncRecentEmails()` nor `syncEmailsByLookback()` followed it:
`syncRecentEmails()` had no per-message `try/catch` at all, so one message
that always throws (a decode bug, an oversized attachment, whatever)
permanently blocked discovery of every Gmail message *after* it in the
inbox, on every future run, with no poison-pill escape. `syncEmailsByLookback()`
caught per-message errors but then unconditionally advanced
`emailLastSyncedAt` regardless — a transient failure (a momentary Gmail API
or DB blip) was silently and permanently excluded the moment the date
window moved past it, with no retry.

**Fix:** both functions now track `failedMessageIds`, skip messages already
confirmed poison (reusing the same `AppStatus.syncFailures`/
`MAX_SYNC_FAILURES` state `syncHistorySince` already maintains — one shared
poison-pill ledger across all three sync paths, not three independent ones),
and only advance `emailLastSyncedAt` once every message in the batch has
either succeeded or become poison.

### Refactor: extracted `services/syncFailureTracker.js`

The "increment failure counters, decide retryable-vs-poison, advance the
cursor if and only if nothing is retryable" logic existed as two
near-identical, independently-maintained copies (`webhookController.js`'s
historyId handling and `resolvers.js`'s `syncEmails` mutation) even before
this phase added two more call sites for the same policy. Extracted into
`reconcileSyncFailures()` (plus the underlying `incrementSyncFailures()`/
`getRetryableFailures()`), parameterized by an `onAdvance` callback since
what "advancing the cursor" means differs (`User.historyId` vs.
`AppStatus.emailLastSyncedAt`). Same precedent as this document's
`PersonSchema`/`MoneySchema`/`AttachmentRefSchema` extractions: reuse the
established pattern once a third/fourth copy would otherwise be needed,
rather than let four copies of the same policy drift independently.

### Deliberately not touched in this phase

- `repository.js`'s known Entity-schema mismatch and the duplicate-entity-
  on-retry risk it implies (see Gap 1's "known adjacent gap" above) — both
  already flagged, both squarely orchestrator-rewrite work.
- Gmail push notification de-duplication at the Pub/Sub layer itself (Google
  Cloud Pub/Sub is at-least-once delivery) — already handled downstream by
  `EmailToProcess`'s unique `messageId` index + `E11000` handling in
  `saveEmailToProcess()`, which this phase verified still fully covers a
  duplicate webhook delivery for the same message.

---

## The Real AI Orchestrator — Invoice + Payment (first two types)

Replaces the generic, type-agnostic orchestrator (`ai/features/extractEntities/*`,
flagged as broken/being-superseded in every phase above) with the real
classifier-driven pipeline: top classifier candidate → type-specific
extraction → type-specific validation → type-specific repository → `Entity`
row. The legacy directory is deleted, not left alongside its replacement —
nothing referenced it once `emailProcessorService.js`'s one call site moved
over, and it was already permanently broken (see the Entity Model section
above), so keeping known-dead code around served no purpose.

### Decision: top classifier candidate only — the AI never re-decides type

The classifier already assigns type(s); making the AI re-classify would
duplicate the exact job a cheap, deterministic, tested rule engine exists to
do. `extractAndPersistEntity()` always acts on
`emailDoc.classification.candidates[0].type` only. Multi-candidate handling
(e.g. running extraction for more than one candidate when scores are close)
is explicitly deferred — same "don't build what's not needed yet" precedent
as every prior phase.

### Decision: two shared processors (Document, Text/Summary) + a per-type prompt/repository split, not five parallel pipelines

**Per-type (genuinely different content):** `prompts/invoicePrompt.js`,
`prompts/paymentPrompt.js`, `repositories/invoiceRepository.js`,
`repositories/paymentRepository.js` — an Invoice's fields and a Payment's
fields are just different, as is what persisting one actually requires
(status re-derivation vs. same-thread auto-link).

**Shared (identical mechanics regardless of type):**
- `documentProcessor.js` — OCR each attachment, dispatch to the right
  type's prompt builder via a lookup table (mirrors `ai/client/index.js`'s
  own provider-dispatch pattern rather than duplicating the OCR/AI-call/
  parse/merge logic five times), reconcile across multiple attachments.
- `structuredExtraction.js` — the actual "build prompt → call `aiClient
  .generate` → parse JSON" step. Pulled out of `documentProcessor.js` into
  its own module specifically so the *fallback* path (extracting straight
  from the email body when no attachment produced usable data) can reuse
  it without reaching into the document-specific module — same function,
  different input text, one shared implementation either way.
- `textSummaryProcessor.js` — summarizing an email body needs no
  type-specific logic at all; one shared prompt/call, feeding a
  secondary/context field, never a source of primary structured fields.
- `repositories/entityRepository.js` — displayId generation, source-URL
  construction, and thread lookup are identical for every type; extracted
  once and called by all type repositories, same precedent as
  `PersonSchema`/`MoneySchema`/`AttachmentRefSchema`.

### Decision: attachment-derived data is authoritative; the email body is a fallback, not a co-equal source

Previously, attachment OCR text and email body text were concatenated into
one blob for a single generic prompt — no priority between them. Now: if
attachments exist, `documentProcessor.js`'s result is used outright; the
email body is only sent through `structuredExtraction.js` as a **fallback**
when the Document Processor found nothing (no attachments, or none
produced usable fields). The Text/Summary Processor always runs regardless,
but only ever populates a secondary summary/notes field — it never competes
with attachment-derived data for the primary structured fields.

**Multi-attachment conflicts** (two attachments disagree on a field, e.g.
two different `amount.value`) resolve via first-non-null-wins, logged as a
warning — not a rejection. Matches the existing "warn, don't reject"
convention (`Document.js`'s summary-word-count check). Flagged as a default,
not a settled requirement — revisit if a real conflict case turns out to
need stricter handling.

### Decision: `feature: 'summarizeEmail'` added as a second AI-client feature tag

`ai/client/mock.client.js` previously only recognized `'extractEntities'`;
anything else silently fell through to a generic "unknown feature" stub.
The Text/Summary Processor's calls needed their own branch so local/test
runs against the mock provider actually exercise this path instead of
getting junk back. `MOCK_EXTRACTIONS` in the mock client is also now keyed
by `options.type` (`INVOICE`/`PAYMENT`), matching the flat per-type response
shape the new prompts ask for — the old mock's single hardcoded "contact"
response is gone along with the generic orchestrator it was written for.

### Decision: `Payment.paidAt`'s "always extractable" requirement is satisfied by falling back to the email's own Date header

`Payment.paidAt` is schema-required, but the AI may legitimately find no
explicit payment date in the text. Per the exact fallback this document
already called for when `Payment.js` was built ("falling back to the source
email's received date... is an extraction-layer concern, not a schema
one"), `paymentRepository.js` uses `emailDoc.date` (the email's own `Date`
header, already stored on `EmailToProcess`) whenever the extracted `paidAt`
is null, before validating.

### Decision: Payment auto-linking is scoped to same-thread only; cross-thread reconciliation stays manual

`paymentReconciliationService.findMatchingInvoice()`/`determineLinkMethod()`
existed but were never wired in. `paymentRepository.js` now calls them, but
restricts candidates to `Invoice.find({userId, threadId: payment.threadId})`
— same-Gmail-thread Invoices only. Two consequences, both deliberate: (1)
`determineLinkMethod()` can only ever resolve to `'THREAD_CONTEXT'` here,
never `'RECONCILED'`, since cross-thread candidates are never queried; (2)
same-thread alone still isn't sufficient to auto-link — the existing
scoring still requires a corroborating signal (typically exact-amount) to
clear `MATCH_THRESHOLD`. A bank-alert-style payment in a different thread,
matched only by amount/payee, is left unlinked (`invoiceId: null`) for the
user to link manually — the manual-link mutation itself isn't built yet
(still schema-only, `linkMethod: 'MANUAL'`), so "manual" is aspirational
until that follow-up lands.

### Decision: idempotency via `{userId, messageId}` unique+sparse indexes on all five typed collections, plus `{entityId}` unique+sparse on `Entity`

Closes the "known adjacent gap" flagged in the idempotency-hardening phase
above: with "top candidate only," each email produces at most one typed
entity, so a unique index on `(userId, messageId)` is the correct invariant.
Applied to all five typed collections now (not just Invoice/Payment) even
though only two have repositories yet — cheap, and avoids the inconsistency
of some typed collections having the guarantee and others not once Ticket/
Event/Document are built. Every repository's `create()` call catches the
resulting `E11000` and fetches the existing record instead of erroring
(same idiom as `saveEmailToProcess()`); `entityRepository.js` does the same
for the Entity row itself, independently — so a retry that reaches "typed
child already exists, Entity row doesn't yet" self-heals in one call rather
than needing special-case recovery logic.

### Deliberately not built in this phase

- Ticket/Event/Document prompts and repositories — next, per the agreed
  build order (Invoice+Payment exercised both the attachment-heavy and
  no-attachment/fallback paths; Ticket is next, mostly body-driven).
- To/Cc/Bcc and raw HTML in the extraction context — still only
  subject/from/body, unchanged from before this phase. Not yet needed by
  the Invoice/Payment prompts; revisit per-type if a specific prompt
  actually needs them, and fetch live via Gmail at extraction time (same
  pattern as attachments) rather than persisting them on `EmailToProcess`.
- The manual Payment-linking mutation/resolver (`linkMethod: 'MANUAL'`
  stays schema-only, unreachable from any code path yet).
- Cross-thread reconciliation (`'RECONCILED'` link method) — structurally
  impossible to reach in the current wiring, not merely untested.
- Native structured-output modes (e.g. Gemini's `responseSchema`) — prompts
  still ask for free-text JSON, parsed via fence-stripping + `JSON.parse`,
  consistent with the rest of this codebase's AI-response handling so far.

---

## Ticket/Event/Document Prompts + Repositories (closing the gap the prior phase deferred)

Per the prior phase's own "deliberately not built" list — `PROMPT_BUILDERS`/
`REPOSITORIES` only had `INVOICE`/`PAYMENT` entries, so an email correctly
classified as `EVENT`/`TICKET`/`DOCUMENT` always failed extraction with
`No extraction prompt configured for type "X"`, even though the classifier
rules, Mongoose models, and `validateExtracted*` functions for all three
already existed from earlier phases.

### Decision: same per-type prompt/repository split as Invoice/Payment, no new shared processor

`prompts/eventPrompt.js`/`ticketPrompt.js`/`documentPrompt.js` and
`repositories/eventRepository.js`/`ticketRepository.js`/`documentRepository.js`
mirror `invoicePrompt.js`/`invoiceRepository.js` exactly — same
source-agnostic, never-guess prompt instructions; same idempotent-on-
`(userId, messageId)` persist-then-`createEntityForTypedChild` shape. Two
intentional omissions, both because the source of truth for that data lives
elsewhere and extraction has no way to supply it correctly:
- `Event.attachments[].documentId` (a reference to a separately-extracted
  Document entity) is never asked for — reconciling "which Document does
  this Event's attachment correspond to" needs the same kind of
  evidence-based matching this document has deferred every time it's come
  up (Payment↔Invoice, Ticket duplicate/parent), not a single extraction
  pass's guess.
- `Document.attachments[].attachmentId`/`fileName` likewise isn't asked for
  — those are physical-file references the app already has from
  `emailDoc.attachments`, never AI-supplied.

### Deliberately not built

Populating `Document.attachments` from `emailDoc.attachments` in
`documentRepository.js` (trivial, but no current reader needs it) and the
Event↔Document attachment-linking mentioned above — both left as schema-
supported, code-empty, same as Payment's manual-link mutation above.

---

## Fixing `getAppStatus`'s Date fields — a real bug found while building a new consumer

**Context:** `LastSyncedAt` (a new UI component, see below) was the first
thing to actually *render* `getAppStatus.emailLastSyncedAt`. Existing
consumers (`SyncEmailsAlert`) fetched the field but never displayed it, so
this bug was latent and invisible until something finally read the value.

**The bug:** `resolvers.js`'s `getAppStatus` resolver returned the raw
Mongoose `Date` object straight into a GraphQL `String`-typed field.
`GraphQLString.serialize()` calls `.valueOf()` on anything object-shaped
before falling back to `String()` — for a `Date`, `.valueOf()` returns the
epoch-millisecond number, so the client received `"1787303164237"`, not an
ISO string. `new Date("1787303164237")` does **not** parse that as epoch
millis (only `new Date(number)` does) — it tries to parse it as a date
string, fails, and produces `Invalid Date`.

**Fix:** `.toISOString()` explicitly on all three Date-typed fields
(`emailLastSyncedAt`, `lastEmailAIProcessStartedAt`,
`lastEmailAIProcessCompletedAt`) before returning them from the resolver.

**Why this wasn't caught earlier:** exactly the same reasoning as this
document's very first "regex before AI" framing, inverted — a field nobody
renders can silently carry wrong data indefinitely; the bug surfaces the
moment, and only the moment, a real consumer exists. Worth remembering next
time a "found: 0 emails" or "not synced yet" state looks suspicious with
real data underneath it.

---

## Sync/Process Banners Gated to Dev-Only

**Context:** `SyncEmailsAlert`/`ProcessEmailAlert` are manual-trigger UI —
useful locally because this environment's Gmail Pub/Sub watch is currently
misconfigured (`Invalid topicName does not match projects/.../topics/*`,
observed repeatedly this session), so nothing else keeps the local inbox
in sync. In production, the webhook does that job automatically.

### Decision: gated behind the existing `config.isLocal` (`import.meta.env.DEV`), reusing the one precedent already in this codebase

`login-form.tsx` already had exactly one env-gated branch
(`if (config.isLocal) { ... }`), so both components adopt the identical
pattern rather than inventing a new env-check convention: `skip:
IS_PRODUCTION` on every `useQuery` (stops the polling network calls
outright, not just the render) plus an early `return null`. No backend
change — these are pure dev-convenience UI, not something a production user
should ever need or see.

---

## Reactive Sync Status — Race Condition Fix + Unified Toast UX

**Context:** `LastSyncedAt` (adaptive-poll status indicator) and
`AppInitializer`'s login-triggered toast were built independently and only
covered the login case. Investigating "what happens in the UI when mail
arrives via webhook mid-session" (asked directly, not assumed) surfaced
three real problems, not one:

1. A poll-driven indicator can miss a fast sync/process cycle entirely — it
   can start and finish between two 10s-apart polls, showing no spinner and
   no tick, just a timestamp that silently moved.
2. **The AppStatus bookkeeping the indicator depends on
   (`emailProcessingInProgress`, `lastEmailAIProcess*`) was only ever
   written by the `processEmails` GraphQL resolver** — the webhook's
   fire-and-forget autoProcess call (`syncEmailsService.js`, inside
   `processEmail()`) called `emailProcessorService.processEmails()`
   directly, bypassing the resolver entirely. So a webhook-triggered
   extraction was completely invisible to any polling frontend, not just
   racily visible.
3. `processEmail()` fired one autoProcess call **per matched email** — a
   burst of N emails in one webhook delivery meant N separate, uncoordinated
   `processEmails()` calls racing for the same lock, instead of one
   coordinated cycle.

### Decision: move the AppStatus lock/bookkeeping from the resolver into `emailProcessorService.processEmails()` itself

Same lock-acquire/execute/finally-release shape that already existed in
`resolvers.js` (mirroring the webhook's own `emailSyncStatus` lock pattern,
per the idempotency-hardening phase above), just relocated so every caller
— the resolver **and** the webhook's direct call — gets identical tracking.
The resolver becomes a thin wrapper: call the service, map its
`alreadyInProgress` sentinel back to the pre-existing `"Processing already
in progress"` response shape so nothing downstream (`ProcessEmailAlert.tsx`'s
special-case check) needed to change.

### Decision: batch the autoProcess trigger per sync call, not per email

`processEmail()` now returns the saved email's id instead of triggering
anything itself; `syncRecentEmails`/`syncHistorySince`/`syncEmailsByLookback`
each collect ids across their loop and fire **one** `processEmails({ids,
userId})` call after the loop if `autoProcess` is on. This is the direct
answer to "what happens when multiple emails arrive close together": Gmail's
`historyId`-based sync already coalesces a burst into one `listHistory()`
call (confirmed, not assumed, by reading the pagination loop); this makes
the *processing* phase coalesce the same way, so N emails produce exactly
one `emailProcessingInProgress` pulse and one accurate count. Two sync
attempts that genuinely overlap still resolve the same way every lock in
this codebase already does — the loser's emails stay `DETECTED`, picked up
by whichever call next succeeds; nothing is lost, only deferred.

### Decision: the race fix is "detect completion two ways," not "poll faster"

`AppInitializer` (the one component mounted for the app's entire lifetime,
confirmed via `routes/index.tsx`) became the single poller and the single
place edge-detection happens, replacing two independent, potentially-
disagreeing `useQuery` polls (`LastSyncedAt` had its own) with one shared
`useAppStore.syncStatus`. Completion fires on *either* a clean falling edge
of `syncing` *or* `emailLastSyncedAt` having visibly advanced since the last
tick even though `syncing` was never observed true — the second branch is
what actually closes the race: a cycle fast enough to start and finish
between two polls still gets caught on the very next tick, because the
timestamp moved even though the boolean never did. Speeding up the poll
interval would only ever shrink the race window, never close it.

### Decision: one toast-producing code path, not two competing ones

The temptation was to keep `runAutoSync`'s existing `toast.loading`/
`toast.success` calls for login and bolt a second, independent toast
mechanism onto the passive poller for webhook-triggered syncs — risking
both firing for the same underlying event. Instead, `handleStatusTick` is
the *only* function that ever creates or resolves a toast; `runAutoSync`
sets an `isOwnTriggeredRef` flag (which only changes toast *copy* —
`"Syncing emails..."` vs `"New emails detected. Sync in progress."`) and
runs two explicit `GET_SYNC_STATUS` queries immediately before and after its
own mutations. Those two explicit checks, not the passive poll interval, are
what give the *login* toast a zero-race guarantee independent of poll
timing — the same machinery that fixes the general race also makes the
login case race-free by construction rather than by coincidence of timing.

### Deliberately not built

- A real push channel (GraphQL subscriptions/WebSockets) instead of
  polling — would close the detection-latency gap (up to the poll interval)
  entirely rather than just the "did we ever see it happen" gap this phase
  closes. Not pursued: no subscription infrastructure exists anywhere in
  this codebase yet, and the timestamp-advanced fallback already makes
  polling *correct*, just not instantaneous — a bigger architectural change
  than this specific race warranted.
- Fixing the Pub/Sub watch topic-name misconfiguration observed repeatedly
  this session (`Invalid topicName does not match projects/.../topics/*`)
  — a deployment/config issue, not a code path this phase touched; flagged
  because as configured today, none of the webhook-triggered behavior above
  actually fires in this environment until it's fixed.
- Surfacing individual failed extractions to a production user at all —
  `ProcessEmailAlert`'s retry UI is now dev-only (see above), so a
  webhook-ingested email that fails extraction in production is currently
  invisible and unretryable by any user action. Flagged as a real gap
  opened by the dev-only gating decision, not closed by this phase.

---

## Conversations: Attachments, Reply Reconciliation, and Why We Never Send

Populates `Ticket`/`Invoice.conversation[]` for real (previously always `[]`
— see the schema-plan discussion above) and builds the UI that renders it.
Three separate decisions worth recording on their own, since each has a
real alternative that was deliberately rejected.

### Decision: conversation attachments are a live Gmail proxy, never stored by Cortex

**Context:** the obvious-looking shortcut — "store the attachment's URL,
clicking downloads it" — doesn't actually work. Gmail exposes no public,
directly-fetchable URL for an attachment; the only way to get the bytes is
the authenticated `gmail.users.messages.attachments.get` API call, scoped to
that specific mailbox owner's OAuth token (`gmailService.js#fetchAttachment`,
already used once for Document Processor OCR — see "The Real AI
Orchestrator" section above).

**Decision:** `AttachmentRefSchema` gained optional `mimeType`/`size` (already
captured at ingestion by `syncEmailsService.js#extractAttachmentRefs`, just
previously dropped) so the UI can show a correct icon/size without a second
round-trip. A new REST route, `GET /api/attachments/gmail/:messageId/:attachmentId`
(`routes/attachmentRoutes.js`, mounted alongside `authRoutes`/`aiRoutes` —
after session/passport middleware, so `req.isAuthenticated()`/`req.user`
work), calls `gmailService.fetchAttachment` fresh **on every request** and
streams the bytes straight through with a `Content-Disposition: attachment`
header. Nothing is ever written to R2/S3/disk — no storage system was added
for this at all.

**Ownership check is against the durable typed-child record, not the TTL'd
one:** the route verifies the requesting user actually owns this
`messageId`/`attachmentId` pair by querying `Invoice`/`Ticket.conversation[]`
directly (`findOwnedAttachmentMeta`) rather than `EmailToProcess` — the
latter expires on a 30-day TTL (see the Entity Model section's "durable
source of truth" precedent), while attachment metadata was copied onto the
typed child's `conversation[]` entry at creation time specifically so it
survives that expiry. Using `EmailToProcess` here would have quietly broken
attachment downloads on any ticket older than 30 days.

**Reversed an explicit prior invariant, flagged rather than silently
overridden:** `Document.test.js` had a test asserting `AttachmentRefSchema`
"carries no storage metadata (content lives on the physical file model)" —
written when a fuller R2-backed attachment record was assumed to eventually
own that metadata. That system (`services/attachments/entityHandlers/`) is,
and remains, entirely `NOT_IMPLEMENTED` stubs for every entity type that
matters here — email attachments were never going to flow through it. The
test was updated (not deleted) to assert the real remaining boundary:
`storageKey` (an actual upload-ownership concept) is still absent;
`mimeType`/`size` are lightweight, already-known-at-ingestion descriptive
fields, not evidence of owning the file's bytes.

### Decision: a reply is matched to an existing conversation by `threadId`, checked *before* classification

**Context:** discovered by testing, not assumed — a real reply ("Thanks, it
is working now.") sent to an existing Ticket's thread has zero
problem/request-language signal, so `classifyEmail()` alone would discard it
before it ever reached the database. The classifier-first design (Phase 1's
founding decision, top of this document) is right for *new* emails, but
wrong for a reply on a thread Cortex already has an opinion about.

**Decision:** `services/conversationService.js#findExistingConversationEntity`
checks `Invoice.findOne({userId, threadId})` then `Ticket.findOne(...)` —
the "cheap, deterministic half" of reconciliation this document has pointed
at since the Invoice/Payment phase's Scenario 4 walkthrough, now actually
built for Ticket/Invoice replies specifically. `syncEmailsService.js#processEmail()`
runs this check immediately after `extractEmailSnapshot()`, **before**
`classifyEmail()` — a match short-circuits the entire classify/save/extract
path and instead builds a `ConversationMessage` (sender parsed from the raw
`From` header, direction derived by comparing it against the account
owner's own email — same rule as the creation-time path) and `$push`es it
onto the existing record. `buildConversationMessage()` (the sender/direction/
validation logic) is shared between this path and
`entityRepository.js#buildInitialConversationMessage` (the *first* message,
seeded at creation) — extracted into `conversationService.js` specifically
so that logic lives in exactly one place regardless of when in the pipeline
it runs.

**No AI relevance judgment — every reply on a matching thread is captured,
full stop.** Scenario 4's original framing split this into two judgments:
"is this reply meaningfully relevant" (assigned to the LLM) and "which
invoice does it settle" (deterministic matching, built). This phase only
builds the deterministic half and skips the relevance judgment entirely —
a "have a great day" reply on a Ticket's thread gets appended exactly the
same as "it's resolved now, thanks." This is a **deliberate simplification,
not an oversight**: matches the requesting instruction directly, and adding
an LLM relevance call here would be exactly the kind of speculative
AI-extraction work this document has repeatedly deferred until a concrete
need shows up. Revisit if noise in practice turns out to matter.

**Idempotent against duplicate delivery, same pattern as everywhere else in
this codebase:** `appendConversationMessage()`'s update filter,
`{_id, 'conversation.messageId': {$ne: message.messageId}}`, means a
duplicate webhook delivery or retried sync for the same reply is a no-op
(`modifiedCount: 0`) rather than a second, duplicate bubble — the same
"unique constraint over a second write, not an application-level guard"
philosophy as `EmailToProcess.messageId`'s unique index and
`Entity.entityId`'s unique+sparse index.

**Deliberately not built:** a reply that *doesn't* match any existing
thread still goes through the full classify/extract path as before (it
could be the start of a brand-new Ticket/Invoice) — this phase only adds
the short-circuit for the "already have an opinion about this thread" case.

### Decision: Cortex never sends a reply — deliberately, not as a missing feature

**The question this closes:** now that Cortex can *display* a full
back-and-forth conversation convincingly enough to look like a real inbox
view, the natural next ask is "let me reply from here" — a compose box
under the conversation thread, wired to Gmail's `messages.send` API.

**Decision: not building it, now or as an implied next step.** Cortex is
explicitly a read-only observer of a mailbox it doesn't own the
conversation in — it captures what already happened (sync from Gmail),
never originates what happens next. Adding send capability would make
Cortex a **second channel** through which a reply to a customer/vendor
could originate, alongside the user's actual email client (Gmail web,
Outlook, mobile Mail app, whatever they actually use day to day) — the
exact dual-channel-communication problem this system is deliberately
avoiding: two places a reply could come from means two places to check for
"did I already answer this," a real risk of the same question getting two
different answers, and Cortex silently drifting out of sync with whatever
the user's actual email client shows the moment they reply from there
instead (which, being their real inbox, they always can).

**What this means concretely:** `ConversationMessage.direction` (`SENT`/
`RECEIVED`) will keep showing a user's own past replies — captured
passively via the same thread-reconciliation sync path as any other reply,
exactly like the "Me <...>" `SENT` case already covered above — but there
is no code path anywhere in this system, and none planned, that originates
a new outgoing message. The `Conversations` component's attachment
badges/links are read-only for the same reason: view and download, never
compose or send.

---

## Bug: quoted reply chains weren't being stripped from conversation content

**How this surfaced:** discovered by actually reading real conversation
content, not by inspection — the reconciliation work above was the first
time raw `cleanText` became something a human reads verbatim in the UI.
`cleanText` already ran through `email-reply-parser` specifically to strip
quoted history; a live reply still showed the entire quoted thread beneath
it anyway.

**Root cause, confirmed by reproducing it directly against the real Gmail
bytes, not guessed:** `utils/helpers.js#extractEmailSnapshot` decided
whether to run a body through `html-to-text`'s `convert()` by content-
sniffing with `/<[a-z][\s\S]*>/i` — meant to detect an actual HTML body, but
it also matches a plain-text quote header's bare angle-bracketed address
(`"...Ashwin S <s.ashwin.0411@gmail.com> wrote:"` reads exactly like an
opening HTML tag to that regex). A genuinely plain-text reply would
therefore get wrongly converted anyway. `convert()`, given non-HTML input,
collapses every line break into a single space — and `email-reply-parser`'s
quote-boundary detection depends entirely on line boundaries to find where
"On ... wrote:" starts. Flatten the text first and the parser has nothing
left to find; it returns the whole thing, quote included.

**Fix:** `extractBody()` now returns `{ text, mimeType }` instead of a bare
string, so the caller knows definitively which MIME part it actually pulled
from. `convert()` only ever runs when `mimeType === 'text/html'` — content-
sniffing was removed entirely rather than tightened, since any regex
guessing "is this HTML" from text alone has the same false-positive shape
(a bare `<anything-that-looks-like-a-tag>` substring) for some input.

**Not covered by an automated test, same pre-existing gap as before this
fix:** `decisions.md`'s idempotency-hardening phase already flagged that
`extractEmailSnapshot` can't be unit-tested under this project's plain Jest
config (`import('email-reply-parser')` is a dynamic ESM import Jest isn't
configured for). `extractBody` is a closure inside that same function, not
separately exported, so this fix couldn't add coverage either — verified
instead by re-running the *real* fetch-message → extractEmailSnapshot path
against the actual Gmail message that exposed the bug and confirming the
quote no longer survives.

**Already-persisted bad data was hand-repaired, not left to a future
re-sync:** the two conversation entries captured before this fix shipped
already had the bad, quote-included content baked into
`Ticket.conversation[]`. A plain re-sync would **not** have fixed them —
`appendConversationMessage()`'s idempotency guard
(`'conversation.messageId': {$ne: ...}`) exists specifically to skip a
message that's already present, so it would have silently left the old bad
content in place forever. Ran a one-off script instead: re-fetch each
affected message from Gmail, re-run the now-fixed `extractEmailSnapshot`,
and `$set` the corrected text onto the existing array element directly
(`'conversation.$.content'`). Not turned into a migration/backend endpoint
— this was a handful of test-session records, not a production data
problem; a real fix-forward migration would only be worth building if this
surfaces again against real user data.

---

## Phase 2 — Chat / Conversations

### Decision: `/conversations` ships as a UI shell first — local-only state, no backend, no real AI reply

**Alternatives considered:** Build the route with a real chat message model
(Mongoose + GraphQL), wire it to `ai/client` for actual replies grounded in
extracted entities (RAG-style), from the start.

**Reasoning:** The request was explicitly about the *UX* — a Claude-Desktop
-style three-pane layout (locked icon nav, conversation history sidebar,
chat panel with pinned composer). Layout and interaction design is a
separable concern from "what answers the user's question and how." Landing
the shell first lets the layout be verified and iterated on its own, before
any backend/RAG design work (which will need its own decisions: how to
scope retrieval to a user's entities, how to stream a reply, whether to
reuse `ai/client`) gets bolted on top of a still-moving UI.

**What was built:** `store/conversationStore.ts` — a plain Zustand store
(`conversations`, `createConversation()`, `addMessage()`), same
`create<T>((set) => (...))` convention as `appStore.ts`. Messages typed as
`{ role: 'user' | 'assistant' }` so the shape is ready for a real assistant
reply later, but nothing fabricates one now — sending a message only ever
appends a `user`-role entry.

**Deliberately not built (explicit follow-up phase):** backend persistence
for conversations/messages (no Mongoose model, no GraphQL type), the actual
LLM/RAG call, multi-device sync. The store is local-only — a page reload or
full navigation resets history, which is expected and accepted for this
phase.

### Decision: route-scoped sidebar lock via `SidebarProvider`'s existing controlled-prop escape hatch, not a change to the shared primitive

**Alternatives considered:** Add a `forceCollapsed` prop to
`lib/ui/sidebar.tsx` itself, or a global "chat mode" flag in `appStore.ts`.

**Reasoning:** `SidebarProvider` (`lib/ui/sidebar.tsx`) already accepts
controlled `open`/`onOpenChange` props and falls back to its own internal/
localStorage-backed state when they're `undefined`. `AppLayout.tsx` just
checks `pathname.startsWith("/conversations")` and passes `open={false}` +
a no-op `onOpenChange` on that route only, `undefined`/`undefined`
everywhere else. Zero changes to the shared sidebar primitive, and every
other route's expand/collapse/persistence behavior is untouched — verified
by visiting `/conversations` then `/home` and confirming the collapse
trigger and Cmd+B still work normally on `/home`.

**Second sidebar (conversation history) is a plain component, not built on
the shadcn `Sidebar` primitives:** it doesn't need icon-rail/offcanvas
collapse modes — just show/hide on mobile via local `useState`, styled to
match (`bg-sidebar`, `border-r`). Reusing the shadcn `Sidebar` machinery for
a panel that only ever needs one collapse behavior (full overlay on mobile,
always-visible on desktop) would have been more indirection than the panel
needs.

**Verified in-browser (desktop + mobile):** desktop — locked icon rail,
history sidebar, welcome state, message send/create-conversation flow,
history list title/timestamp updates, `/home` unaffected. Mobile (resized
viewport <768px, the same `useIsMobile()` breakpoint used elsewhere in this
codebase) — history sidebar hidden by default, `ChatPanel`'s hamburger
header bar opens it as a `fixed inset-0 z-30` overlay with a dismissible
backdrop, composer stays pinned at the bottom with no page-level scroll.

---

## Phase 3 — Chat backend: conversations, intent orchestration, async polling

### Decision: `ChatConversation`/`ChatMessage`, not `Conversation`/`ConversationMessage`

**Reasoning:** `backend/src/services/conversationService.js` and
`backend/src/models/schemas/ConversationMessageSchema.js` already exist for
an unrelated feature — capturing email reply-threads embedded in
`Ticket.conversation[]`/`Invoice.conversation[]`. Naming the new chat models
`Conversation`/`ConversationMessage` would collide with that vocabulary in
every future search/grep of this codebase. The `Chat` prefix disambiguates
the JS identifiers; the Mongo collection names (`conversations`,
`conversationDetails`) still match the feature's own spec exactly.

### Decision: a fully separate `ai/chatOrchestrator/` tree, reusing only `ai/client`

**Reasoning:** The existing `ai/orchestrator/` pipeline (classify email type
→ per-type prompt → validate → persist one new entity) and chat's pipeline
(classify intent → whitelist-validate → multi-source **read** → synthesize)
share no steps beyond the provider-agnostic `aiClient.generate()` factory.
Bolting chat onto the existing `PROMPT_BUILDERS`/`REPOSITORIES` dispatch
tables would conflate two different meanings of the same-looking string
(`"TICKET"` as a classifier candidate vs. a chat data-source enum value).

### Decision: `dataSources` for a validated intent comes from the registry, never from the LLM's own echoed value

**Bug found during live verification (real OpenAI provider, not mock):**
asking "What invoices are still unpaid?" produced the graceful
UNSUPPORTED-style fallback message instead of a real answer. Root cause:
`validateIntentOutput()` originally *intersected* the LLM's own
`raw.dataSources` array against the intent's whitelist
(`requestedSources.filter(s => registryEntry.dataSources.includes(s))`) —
when the model's chosen intent was valid but its `dataSources` copy had any
mismatch (plural/casing drift, e.g. `"INVOICES"` vs `"INVOICE"`), every
source got silently dropped, `dataSources` went empty, and the orchestrator
treated that exactly like `UNSUPPORTED` (empty `dataSources` → no retrieval
→ graceful message), even though the intent itself was correct. **Fix:**
once an intent is validated against `INTENT_REGISTRY`, its `dataSources` are
read directly from the registry entry (`registryEntry.dataSources`) —
never from the LLM's output at all. The mapping intent→dataSources is
already unambiguous once the intent is known; asking the LLM to also state
it and then trusting that copy added a failure mode with no corresponding
benefit. The intent prompt's requested JSON shape was simplified to
`{intent, filters}` accordingly (no `dataSources` field asked for). Caught
by testing against the real provider, not the mock — the mock's simpler
keyword-matching never exercised this exact case, which is itself a decision
point about the limits of mock-based-only verification for future phases.

### Decision: filter whitelisting is value-level, not just key-level

**Reasoning:** Whitelisting only the filter *keys* an intent accepts still
lets an LLM (or, later, prompt-injected content it was shown) pass a Mongo
operator object as a "value" — e.g. `{status: {"$ne": null}}`. Every filter
key maps to a typed sanitizer function (`filterSanitizers.js`) that returns
either a safe primitive/date-range object or `undefined` (never passes
through as-is); `undefined` means "drop this filter," never "pass it
through." The repository read functions (`find*ByFilters`) additionally
never spread `filters` into a Mongo query — they read only the specific
sanitized keys they expect, so an unexpected key can't reach Mongo even if
some future whitelist gap let it through validation.

### Decision: `sources[].entityId` is always `Entity._id`, never the typed child's own `_id`

**Reasoning:** The frontend's `EntityDetailSheet`/`GET_ENTITY_DETAIL` query
is keyed exclusively on the Entity registry row's id, not the typed child
document's own `_id` — confirmed by reading
`frontend/src/graphql/query/entities/entitiesQueries.ts` directly rather
than assuming. Every new repository read function (`ticketRepository.js`
etc.) joins its typed-child results to `Entity` via a batched
`Entity.find({entityId: {$in: childIds}, type})` lookup and returns
`entity._id` as `entityId` — verified live in the browser by clicking two
different source chips from the same answer and confirming each opened the
correct, distinct invoice.

### Decision: two separate `aiClient.generate()` calls, not one combined prompt

**Reasoning:** Intent-extraction and response-generation are separated by a
hard sequential dependency — the response can't be grounded in retrieved
data that doesn't exist yet at intent-extraction time. This mirrors the
existing extraction pipeline's own precedent of separate calls for separate
concerns (`structuredExtraction.js` + `textSummaryProcessor.js`), and keeps
each of the five error codes (`ORCHESTRATION_FAILED`/`INVALID_QUERY` vs.
`DATA_RETRIEVAL_FAILED` vs. `RESPONSE_GENERATION_FAILED`) attributable to
the specific step that actually failed.

### Decision: no global/singleton lock for chat message processing

**Reasoning:** Unlike email sync (`AppStatus`'s `emailSyncStatus` lock,
guarding one shared per-user job), each chat message is an independent unit
of work — there's nothing to serialize. The one real race (double-submitting
"new conversation" before the first row exists) has no backend fix because
`conversationId` is server-generated: two rapid submits would legitimately
create two separate conversations, not corrupt shared state. Fixed
entirely on the frontend — `ChatComposer` disables its textarea/send button
for the duration of the in-flight request.

### Decision: fire-and-forget async processing, no job queue

**Reasoning:** Reused the exact pattern already established by
`webhookController.js`'s `processNotificationAsync` — respond to the HTTP
request immediately (`201 {conversationId, messageId, status:'PROCESSING'}`)
and only then call the async pipeline detached (`.catch(console.error)`,
no `await`). No Bull/BullMQ or other job-queue library exists in this
codebase, and chat's per-message workload doesn't need one — status is
persisted directly on the `ChatMessage` document, which is what makes the
frontend's short-polling loop correct: the backend keeps processing
independently of whether the frontend is still polling, and the polling
endpoint always reflects the backend's own persisted state, never something
the frontend decided.

**Not built (explicit gap, mirrors an existing one):** no stale-PROCESSING
sweep for a message whose async processing died mid-flight (e.g. a server
restart before `completeAssistantMessage`/`failAssistantMessage` ran) — the
message stays `PROCESSING` forever. `AppStatus`'s email-sync lock has the
same class of gap (a stale-lock timeout only, not a full recovery sweep).
Worth a follow-up if it surfaces against real usage, not built speculatively
here.

### Decision: frontend polling isolated behind one hook (`useMessageStatusPoll`)

**Reasoning:** All `setInterval`/timeout logic for short-polling lives in a
single hook returning `{status, message, sources, error, refresh,
isTimedOut}`. `ChatPanel` and the Zustand store only ever consume that
shape — swapping to SSE/WebSocket later means replacing what's inside this
one file with an equivalent-shaped subscription, without touching the
conversation store or `ChatPanel`'s rendering logic at all. `TIMEOUT` is a
frontend-only state layered on top of backend status after
`MAX_POLL_ATTEMPTS` (20 × 3s = 60s) — never written back to the server, and
the same hook instance is deliberately kept mounted through a
PROCESSING→TIMEOUT transition (by tracking the message while its status is
either) so `refresh()` stays callable from the same instance rather than
being lost to a remount.

**Frontend gap found and fixed during verification:** a new conversation's
AI-generated title (set server-side, in parallel with orchestration) never
appeared in the history sidebar until an unrelated full page reload — the
store's conversation list was only ever fetched once, on `ConversationsPage`
mount. Fixed by having `ChatPanel` refetch the conversation list
(`loadConversations()`) whenever its tracked message's poll status reaches
a terminal state (`COMPLETED`/`FAILED`) — by then the title-generation call
has already completed server-side (it runs before orchestration in
`processNewConversationAsync`), so the refetch is guaranteed to pick up the
real title, not the `"New conversation"` placeholder.

**Verified end-to-end against the real OpenAI provider (not just the mock),
using real synced data:** new-conversation flow (title generation, PROCESSING
→ COMPLETED transition, source chips), existing-conversation follow-up in a
different data source (tickets) within the same thread with no title
regeneration, full transcript + title reload on a hard page refresh, and
clicking two different source chips from the same answer opening two
distinct, correct entity detail sheets.

---

## Phase 4 — Full-field filtering + multi-source (cross-entity) queries

### Bug found: "How many tickets have high urgency?" → "I didn't find anything matching that"

Ticket TKT-003 genuinely has `urgency: 'HIGH'`, but the Phase 3 intent
registry only exposed `status`/`dateRange`/`keyword` as filterable fields
for tickets — `urgency`/`priority` had no filter path at all. The LLM,
lacking a real place to put "high urgency," most likely folded it into the
free-text `keyword` filter, producing a title-substring search for "high"
that matched nothing (no ticket title contains that word). **Fix:** added
`urgency`/`priority` as whitelisted `TICKET` filters, sanitized against
`Ticket.TICKET_LEVELS`.

### Decision: drop named intents (`GET_TICKETS` etc.) entirely — the LLM names data sources directly

**Context:** the user also wanted the same full-field treatment for
Documents/Events/Invoices/Payments, plus support for cross-entity questions
like "Plan my day" (needs today's `EVENT`s **and** open/urgent `TICKET`s
retrieved together in one turn). The Phase 3 design — one named intent maps
to exactly one hardcoded data source with one shared filter set — cannot
express that at all.

**Reasoning:** once the LLM can freely combine data sources, a named intent
(`GET_TICKETS`) becomes a redundant label that must stay in sync with a
`dataSource` value that already fully determines behavior on its own —
exactly the "trust the LLM's own copy of a fact the registry already
knows" bug shape the Phase 3 `dataSources`-echo bug (documented above)
already burned once. Recreating that one level up (an `intent` string that
must agree with a `dataSource`) was rejected. The wire contract between the
two AI calls changed from `{intent, filters}` to `{queries:
[{dataSource, filters}, ...]}` — the LLM names one or more data sources
directly, each with its own independently-validated filter set.
`backend/src/ai/chatOrchestrator/intentRegistry.js` was deleted outright
(not kept alongside the new file) and replaced by
`dataSourceRegistry.js`'s `DATA_SOURCE_FILTERS` (keyed directly by data
source name) + `validateQueries()` — keeping both would have reintroduced
the exact dual-source-of-truth problem being fixed. `UNSUPPORTED` stopped
being a named sentinel value; an empty (or fully-invalid) `queries` array
is the graceful-fallback signal now, a strict generalization of the old
"dataSources.length === 0" check rather than a new code path.

**`retrieveData`'s signature changed** from `{dataSources, filters}` (one
filter set shared across every requested source) to `{queries}` (an array
of independently-filtered `{dataSource, filters}` pairs) —
`backend/src/ai/chatOrchestrator/dataAccess/index.js`. This is the one
change that actually makes "different filters per source in one turn"
possible. `generateResponse`/`buildResponsePrompt`
(`responseGenerator.js`) needed **no shape change** — they already accepted
`Record<dataSource, rows[]>` with possibly multiple keys from day one.

**Defensive cap:** `MAX_QUERIES_PER_TURN = 5` in `validateQueries` — an LLM
naming an unreasonable number of data sources in one turn gets truncated,
not trusted wholesale. A malformed/unwhitelisted `dataSource` entry in the
array is dropped silently, same "don't fail the whole turn over one bad
entry" philosophy as the original per-source dataSources filtering.

### Decision: inject the actual current date into the intent prompt, computed per-turn at the call site

**Reasoning:** `buildIntentPrompt` told the LLM to "resolve relative date
language yourself" but never actually told it what today's date *is* — a
real, independent prompt bug (not just a "Plan my day" nice-to-have) that
made every relative-date question ("meetings today," "invoices due this
week") silently unable to resolve to a correct absolute filter.
`orchestrateChatTurn` (`backend/src/ai/chatOrchestrator/index.js`) now
computes `const now = new Date()` once per call and passes it into
`buildIntentPrompt({input, history, now})`. Deliberately NOT a module-level
constant inside `intentPrompt.js` — that would be evaluated once at
`require()` time (process start) and silently go stale for the lifetime of
a long-running server, reintroducing the exact bug being fixed. The
sanitizers stay deliberately "dumb": `sanitizeDateRange` still only
validates already-absolute ISO dates and never interprets relative
language — resolving "today" is the LLM's job, now that it's actually told
what today is.

### Decision: person-name filtering widens `keyword`, not a new filter key per person field

**Reasoning:** a separate `issuerName`/`payerName`/`organizerName` key per
entity would just be `sanitizeText` again under a different name — pure
duplication for zero new capability, and users don't naturally ask "filter
payer name but not payee name," they ask "payments from Acme." Invoice/
Payment already searched `issuer.name`/`payer.name`/`payee.name` via
`keyword` before this phase; extended the same pattern to Event
(`organizer.name`, `attendees[].name` via `$elemMatch`) and Document
(`issuer.name`, `parties[].name` via `$elemMatch`). No new sanitizer
needed — reuses the already-audited `sanitizeText`/`escapeRegExp` path
rather than adding a second one.

### Decision: `dateRange` always means "created," a second date gets its own `<field>Range` key

**Reasoning:** consistent naming beats ad-hoc per-type meaning. `dateRange`
targets `createdAt` on every type. Event (`startTime`) and Payment
(`paidAt`) already had exactly one meaningful business date, correctly
mapped to `dateRange` from Phase 3 — no second key needed. Invoice gained
`dueDateRange` (→ `dueDate`) and Document gained `effectiveDateRange`/
`expiryDateRange` (→ `effectiveDate`/`expiryDate`) as genuinely distinct
questions from "when was this created" ("invoices due this week" ≠
"invoices created this week"). All reuse the existing `sanitizeDateRange`
sanitizer — only the Mongo field each one targets differs, in the
repository's query-building code.

### Decision: new `sanitizeAmountRange({min?, max?})`, same contract as `sanitizeDateRange`

For Invoice/Payment `amount.value` range queries ("invoices over $1000").
Rejects non-finite values and rejects an incoherent range (`min > max`)
outright rather than applying half of it — `undefined` means reject, never
partially trust, same convention as every other sanitizer in
`filterSanitizers.js`.

**Not built:** amount-range/date-range filtering for Ticket (no amount
field exists) or cross-referencing linked Payments' amounts onto Invoice
queries (e.g. "invoices with no payments yet") — real, plausible follow-up
questions, but out of scope for this pass; would need a join beyond the
single-collection `find()` every reader does today.
