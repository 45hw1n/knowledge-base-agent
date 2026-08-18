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
