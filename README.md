# Cortex

## From messy information to structured knowledge

The problem statement sounds simple:

> **Build a system that takes unstructured or semi-structured documents and converts them into clean, structured data that can be searched and queried.**

But there is an ambiguity hidden inside that statement:

**What is a document? And what is data?**

In a real organization, data doesn't arrive neatly packaged as rows in a database. It arrives as emails, attachments, invoices, payment confirmations, support requests, screenshots, PDFs, notifications, and replies to existing conversations.

An IT team doesn't receive a neatly structured `Ticket` object.

They receive:

> "Hey, I can't access the VPN anymore. I tried restarting my laptop but it's still not working. This is blocking me from accessing the production environment."

An accounts team doesn't receive a structured `Invoice` object.

They receive an email with an invoice attached.

A finance team doesn't receive a `Payment` record.

They receive a payment confirmation email, sometimes followed by another email correcting or explaining the transaction.

**The information already exists. The structure doesn't.**

That is the problem we decided to solve.

## We built Cortex

We chose to build **Cortex** — an AI agent that sits at the boundary between messy information and structured knowledge.

Instead of asking users to manually tell the system what something is, Cortex intelligently looks at incoming information, understands its context, and determines what kind of data it represents.

For example:

* An email saying **"I can't connect to the VPN"** → **IT Ticket**
* An email saying **"Please find attached invoice INV-1042"** → **Invoice**
* An email saying **"Payment of ₹42,500 has been received"** → **Payment**
* An email containing a contract or policy document → **Document**
* An email announcing **"Server maintenance scheduled for Sunday"** → **Event**
* A reply to an existing ticket → **Update to the existing Ticket**, rather than creating a new one

The important part is that Cortex doesn't simply classify documents.

It **extracts the underlying entity and its relationships**.

## What Cortex understands

Cortex currently converts incoming information into a small set of structured primitives:

| Type         | What it represents                                                   |
| ------------ | ---------------------------------------------------------------------|
| **Entity**   | The people, companies, vendors, customers, or other parties involved |
| **Ticket**   | An issue or request that needs attention                             |
| **Invoice**  | A bill or request for payment                                        |
| **Payment**  | A financial payment or payment confirmation                          |
| **Document** | Meaningful documents and their extracted information                 |
| **Event**    | Something that happened or is scheduled to happen                    |

This gives us a common language for information that originally looked completely different.

For example, these two emails:

> "The VPN isn't working. Please help."

and

> "The VPN issue is fixed. Thanks!"

look like two independent pieces of text.

Cortex understands that they are not.

The second email is a **reply to the conversation represented by the first ticket**.

This is why Cortex also maintains the relationship between incoming messages and the knowledge they produce. Message IDs, thread IDs, source URLs, and other source metadata allow the system to identify whether an incoming message is new information or a continuation of something it already knows.

## The goal

The goal isn't to build another document database.

The goal is to create a layer where **unstructured information becomes structured, queryable knowledge**.

Once an email has been transformed into a Ticket, Invoice, Payment, Document, Event, or Entity, the application no longer needs to repeatedly interpret the original email.

It can query the structured representation directly.

That creates a simple pipeline:

**Messy information → AI understanding → Structured knowledge → Queryable data**

And that is the core idea behind Cortex.

---

## What this looks like for a real team

Cortex doesn't ask a team to change how they communicate. It reads the same inbox they already use and quietly builds the structured record behind it.

- **IT** — a "VPN won't connect"/"laptop won't boot" email becomes a Ticket with urgency and priority already inferred, not a thread someone has to triage by hand. A follow-up reply ("fixed now, thanks") updates that same Ticket instead of creating noise.
- **Finance/Accounts** — an email with an invoice attached becomes an Invoice record with amount, due date, and issuer already extracted from the attachment. A later payment-confirmation email is recognized as settling that specific invoice, not treated as an unrelated event.
- **Operations** — a "server maintenance scheduled for Sunday" announcement becomes a queryable Event, not a message that gets buried after a day.
- **Anyone with a question** — "Ask Cortex" turns all of the above into something you can actually ask: *"What invoices are still unpaid?"*, *"Summarize my open tickets"*, *"Which vendors have I paid this month?"* — answered from the structured knowledge Cortex has already built, with clickable links back to the exact record.

## Features

### Entity — the registry behind everything

Every Ticket, Invoice, Payment, Event, and Document Cortex creates is backed by one shared **`Entity`** row: who owns it, what type it is, where it came from, and how confidently it was extracted. It's the one place to answer "what does this user have knowledge of," regardless of which of the five typed collections actually holds the business data. An `Entity` gets created in exactly one of two ways — email ingestion or manual ingestion — and everything downstream (the entity list, Ask Cortex, the detail views) reads through this registry, not the source it came from.

#### Email ingestion

This is the default, always-on path. Cortex syncs a connected Gmail inbox (both on a schedule and in real time via a Gmail push-notification webhook), and every new message goes through the same pipeline:

1. **Classify** — a fast, deterministic, rule-based classifier scores the email against every entity type using subject/sender/body signals, *before* any AI call is made. Obviously irrelevant mail (newsletters, personal mail, marketing) is discarded here at zero cost; only real candidates move on.
2. **Extract** — the top-scoring candidate type runs through a per-type AI prompt against the email body, and separately against any attachments via Google Document AI (OCR + structured extraction), to pull out the real fields (amount, due date, ticket urgency, event time, and so on).
3. **Persist** — the extracted data is validated and saved as a typed record, with an `Entity` row created alongside it.
4. **Reconcile** — a reply on a thread Cortex already has an opinion about is recognized *before* classification even runs, and is appended to that Ticket's or Invoice's conversation instead of becoming a new record. A payment confirmation arriving on an invoice's own thread is automatically linked back to that invoice.

#### Manual ingestion

Not everything worth knowing arrives by email. The **Create Knowledge** action lets you type a type (Ticket/Invoice/Payment/Event/Document), a free-text description, and optionally attach files — Cortex runs the same per-type extraction prompts against your typed text (the primary source) and each attachment (only used to fill in whatever the text left blank), and creates the entity asynchronously in the background. A toast confirms when it's ready and links straight to the new record.

### What each entity type holds

- **Ticket** — an issue or request: ticket number, title, AI-generated summary, status (open/in progress/on hold/resolved/closed), urgency, priority, due date, assignee, requester, and the full conversation thread. Tickets can also reference a parent ticket or mark themselves a duplicate of another.
- **Invoice** — a bill or request for payment: invoice number, amount, due date, issuer, status (unpaid/partially paid/paid/overdue), its conversation thread, and any Payments that have been linked to it.
- **Payment** — a payment or payment confirmation: amount, when it was paid, payer, payee, which Invoice it settles (if any), and *how* that link was established — found in the same thread, reconciled after the fact, or linked manually.
- **Event** — something scheduled or that happened: title, description, start/end time, timezone, location, a join/details URL, organizer, attendees, and any referenced Documents (e.g. an agenda).
- **Document** — a meaningful document and its extracted meaning: type (contract, NDA, policy, certificate, and so on), a 300–500 word AI-generated summary, document number, issuer, the parties involved and their roles, effective/expiry dates, and the original file(s) as downloadable attachments.

### Ask Cortex

A chat interface over everything Cortex has already extracted — not a search box, a conversation. Ask something like *"What invoices are still unpaid?"*, *"Summarize my open tickets"*, or *"Which vendors have I paid this month?"* and Cortex:

1. Classifies what you're actually asking into one or more data sources (it can combine several in one turn — e.g. *"Plan my day"* pulls both today's Events and open Tickets together).
2. Validates every requested field/filter against a strict whitelist before it ever reaches a database query — the AI names *what* to look for, it never gets to shape the query itself.
3. Retrieves the matching records and synthesizes a plain-language answer grounded in them, with clickable source chips that open the exact Ticket/Invoice/Payment/Event/Document the answer came from.

Conversations persist, so you can ask a follow-up in the same thread without repeating context.

### Handling manual ingestion failures

A manual submission doesn't always make it — the extraction might fail to find a required field, or a tab might close mid-processing. Rather than that submission silently disappearing after its one-shot toast, the **Manual Entries** page lists every submission that's still in progress or failed, with its type, a truncated summary, and its status:

- **Edit & retry** — reopens the same form, pre-filled with what you originally typed and any attachments you already added, and re-runs extraction **against the same record** once you fix or clarify the details — it doesn't create a second, orphaned entry for what's really one submission.
- **Delete** — permanently discards a failed submission, refused server-side (not just in the UI) while it's still in progress.

## Tech stack

**Backend** — Node.js / Express, Apollo Server (GraphQL), MongoDB via Mongoose, Passport (Google OAuth), Gmail API + Cloud Pub/Sub (real-time sync), Google Document AI (attachment OCR/extraction), OpenAI / Gemini (`@tanstack/ai`) as pluggable LLM providers, Cloudflare R2 (S3-compatible object storage) for uploaded attachments.

**Frontend** — React 19 + TypeScript, Vite, Apollo Client, Zustand for client state, React Router, Tailwind CSS with Radix UI / shadcn primitives, TanStack Table, Sonner for toasts.

## Project structure

```
backend/src/
  ai/            # the three orchestrators + classifier + shared LLM client
  classifier/    # rule-based, pre-AI email classification
  config/        # DB connection, Passport setup
  controllers/   # chat, app-status, webhook request handlers
  documentParsing/ # mock vs. Google Document AI abstraction
  graphql/       # schema + resolvers
  jobs/          # scheduled tasks (e.g. Gmail watch renewal)
  listing/       # generic list/filter/sort engine
  models/        # Mongoose schemas — one per entity/domain object
  routes/        # Express REST routes (auth, attachments, webhooks)
  services/      # Gmail sync, email processing, storage, reconciliation
  utils/         # encryption, constants, parsing helpers

frontend/src/
  features/      # feature-sliced modules: entities, conversations, knowledge, attachments
  components/    # shared UI (sidebar, alerts, tables)
  pages/         # route-level pages
  graphql/       # query/mutation documents
  store/         # Zustand stores
  lib/           # Apollo client setup, API helpers, shadcn ui/ primitives
  layouts/       # app shell layout
  router/        # route guards
```

## Getting started

### Prerequisites

- Node.js and a MongoDB instance (local or Atlas)
- A Google Cloud project with OAuth credentials, the Gmail API, and Cloud Pub/Sub enabled (for real-time sync)
- A Google Document AI processor (optional — a mock document parser is available for local development)
- A Cloudflare R2 bucket (for manually-attached files)
- An OpenAI or Gemini API key (optional — a mock AI provider is available for local development)

### Environment variables

Copy `backend/.env.example` to `backend/.env.local` and fill in:

- **Server/DB**: `PORT`, `NODE_ENV`, `MONGO_URI`
- **Auth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `EMAIL_ENCRYPTION_KEY`
- **Gmail push sync**: `PUBSUB_PROJECT_ID`, `PUBSUB_TOPIC_NAME`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`
- **AI provider**: `AI_PROVIDER` (`mock` / `openai` / `gemini`), `OPENAI_API_KEY`, `GEMINI_API_KEY`
- **Document parsing**: `DOCUMENT_PARSER_PROVIDER` (`mock` / `google-document-ai`), `DOCUMENT_AI_PROJECT_ID`, `DOCUMENT_AI_LOCATION`, `DOCUMENT_AI_PROCESSOR_ID`, `GOOGLE_APPLICATION_CREDENTIALS`
- **Storage**: `STORAGE_PROVIDER` (`cloudflare-r2`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`
- **URLs**: `FRONTEND_URL`, `BACKEND_BASE_URL`, `GOOGLE_AUTH_BASE_URL`

Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` to the backend's base URL.

### Running locally

Backend and frontend are independent projects, run separately:

```bash
# Backend (http://localhost:5000 by default)
cd backend
npm install
npm run dev

# Frontend (http://localhost:5173 by default)
cd frontend
npm install
npm run dev
```

## What's next

Cortex is connected to Gmail today, but the classifier → extraction → typed-entity pipeline was built independent of any one source. The natural next step is plugging in other places knowledge already lives — Slack, Outlook, WhatsApp Business, or a direct file upload — without changing what happens once information reaches Cortex.
