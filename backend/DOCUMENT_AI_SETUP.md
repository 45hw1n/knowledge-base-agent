# Document AI Setup Guide

The entity-extraction pipeline (`src/ai/orchestrator/documentProcessor.js`) parses
email attachments through a pluggable document parser before running LLM
extraction — see `src/documentParsing/client/`. Locally it defaults to a mock
provider that passes text through unchanged, so the whole pipeline runs without
any GCP setup. This guide covers switching to real Google Document AI
OCR/layout parsing.

## What's Already Built

- ✅ Provider-agnostic document parser interface (`DOCUMENT_PARSER_PROVIDER=mock|google-document-ai`)
- ✅ Mock provider for local dev (no credentials needed)
- ✅ Google Document AI client implementation, untested against a real processor
  (no GCP project was available while building this — verify the request/response
  shape against the current `@google-cloud/documentai` SDK before relying on it)

## Steps to Enable Real Document AI

### 1. Enable the API

In Google Cloud Console: **APIs & Services → Library → Document AI API → Enable**.

### 2. Create a Processor

1. Go to **Document AI → Processors → Create Processor**
2. Pick a processor type that fits your documents (e.g. "Document OCR" for
   general text extraction, or a specialized parser like "Invoice Parser" /
   "Expense Parser" if you want structured fields pre-extracted before the LLM
   stage)
3. Choose a region (e.g. `us`) — this becomes `DOCUMENT_AI_LOCATION`
4. Note the **Processor ID** shown after creation — this becomes `DOCUMENT_AI_PROCESSOR_ID`

### 3. Create a Service Account

1. Go to **IAM & Admin → Service Accounts → Create Service Account**
2. Grant it the **Document AI API User** role
3. Create a JSON key and download it
4. Save it somewhere outside the repo (never commit credentials)

### 4. Set Environment Variables

Add to `.env.local` (or `.env.production`):

```
DOCUMENT_PARSER_PROVIDER=google-document-ai
DOCUMENT_AI_PROJECT_ID=<your-gcp-project-id>
DOCUMENT_AI_LOCATION=<processor-region, e.g. us>
DOCUMENT_AI_PROCESSOR_ID=<processor-id-from-step-2>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### 5. Verify

Send yourself an email with a PDF or image attachment, then trigger processing
(`processEmails` mutation) and check:

```javascript
db.entities.find().sort({ createdAt: -1 }).limit(5)
```

Check server logs for `Document AI Error:` if parsing fails — the most common
issues are a mismatched `DOCUMENT_AI_LOCATION` (must match the processor's
actual region) or a service account missing the Document AI role.

## Falling Back to Mock

Set `DOCUMENT_PARSER_PROVIDER=mock` (or unset it) to go back to local-only
passthrough — useful when GCP credentials aren't available, e.g. in CI.
