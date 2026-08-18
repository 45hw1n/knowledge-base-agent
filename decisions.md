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
