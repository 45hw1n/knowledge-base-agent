const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

/**

* Environment loading priority:
* 1. If ENV_FILE is explicitly provided → use it
* 2. If NODE_ENV is set → use .env.NODE_ENV
* 3. Fallback → .env.local
     */

// 1️⃣ Explicit file override (useful for CI/CD or special servers)
let envFile = process.env.ENV_FILE;

// 2️⃣ If not provided, use NODE_ENV
if (!envFile) {
  const env = process.env.NODE_ENV;
  if (env) {
    envFile = `.env.${env}`;
  }
}

// 3️⃣ Final fallback
if (!envFile) {
  envFile = '.env.local';
}

// Resolve full path
const envPath = path.resolve(process.cwd(), envFile);

// Load only if file exists
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
  console.log(`✅ Loaded environment variables from ${envFile}`);
} else {
  console.warn(`⚠️ ${envFile} not found. Falling back to process.env only.`);
}

// Derive a default R2 endpoint from the account id when one isn't provided explicitly
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2Endpoint = process.env.R2_ENDPOINT
  || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'local',
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  PUBSUB_PROJECT_ID: process.env.PUBSUB_PROJECT_ID,
  PUBSUB_TOPIC_NAME: process.env.PUBSUB_TOPIC_NAME,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_BASE_URL: process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  // WhatsApp Cloud API (Milestone 1 webhook + echo reply). Optional at boot —
  // verification/reply fail gracefully when unset.
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,

  // Provider-agnostic storage config (currently backed by Cloudflare R2;
  // additional providers such as AWS S3 can be added here later without
  // changing the `config.storage` shape consumers rely on).
  storage: {
    provider: process.env.STORAGE_PROVIDER,
    accountId: r2AccountId,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint: r2Endpoint,
  },

  // Chat feature. pollIntervalMs/maxPollAttempts describe the contract the
  // frontend's short-polling loop follows (3s * 20 = 60s) — the frontend
  // keeps its own copy of these two values (client-side setInterval timing
  // must keep working even if a runtime config fetch failed), kept equal by
  // convention/comment, not a shared runtime call. historyTurnLimit is the
  // only one of the three actually enforced here, bounding how much
  // conversation history is fetched into the orchestrator's prompt.
  chat: {
    pollIntervalMs: Number(process.env.CHAT_POLL_INTERVAL_MS) || 3000,
    maxPollAttempts: Number(process.env.CHAT_MAX_POLL_ATTEMPTS) || 20,
    historyTurnLimit: Number(process.env.CHAT_HISTORY_TURN_LIMIT) || 10,
  },
};
