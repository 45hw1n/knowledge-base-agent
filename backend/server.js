const config = require('./src/config');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { createApolloServer, expressMiddleware } = require('./src/graphql');
const cors = require('cors');
const express = require('express');
const { graphqlUploadExpress } = require('graphql-upload-minimal');
const { registerGmailWatchRenewalJob } = require('./src/jobs/gmailWatchRenewal');

function validateEnv() {
  const required = [
    'MONGO_URI',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'EMAIL_ENCRYPTION_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'PUBSUB_AUDIENCE',
    'PUBSUB_SERVICE_ACCOUNT_EMAIL',
  ];
  const missing = required.filter((key) => !process.env[key]);

  // Storage config is provider-specific, so required keys depend on config.storage.provider
  if (config.storage.provider === 'cloudflare-r2') {
    const r2Required = {
      R2_ACCOUNT_ID: config.storage.accountId,
      R2_ACCESS_KEY_ID: config.storage.accessKeyId,
      R2_SECRET_ACCESS_KEY: config.storage.secretAccessKey,
      R2_BUCKET_NAME: config.storage.bucketName,
    };
    missing.push(...Object.keys(r2Required).filter((key) => !r2Required[key]));
  }

  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const startServer = async () => {
  try {
    // 0. Validate required environment variables before doing anything else
    validateEnv();

    // 1. Connect to database
    await connectDB();

    // 2. Schedule background jobs (requires DB to be ready)
    registerGmailWatchRenewalJob();

    // 2b. Verify Document AI credentials/connectivity when that provider is enabled.
    // Non-fatal: logs success/failure so it's visible in the deploy logs without
    // blocking startup (the mock provider path keeps working either way).
    if (process.env.DOCUMENT_PARSER_PROVIDER === 'google-document-ai') {
      const googleDocumentAIClient = require('./src/documentParsing/client/googleDocumentAI.client');
      await googleDocumentAIClient.verifyConnection();
    }

    // 3. Initialize Apollo Server
    const apolloServer = await createApolloServer();

    // 4. Plug GraphQL into Express
    app.use(
      '/graphql',
      // Must run before the JSON body parser: parses multipart/form-data
      // GraphQL requests (file uploads) and leaves other content types
      // untouched, so it never affects the existing JSON-only operations.
      graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 10 }),
      express.json({ limit: "10mb" }),
      (req, res, next) => {
        if (!req.body) Object.defineProperty(req, 'body', { value: {}, writable: true });
        next();
      },
      expressMiddleware(apolloServer, {
        context: async ({ req, res }) => ({
          req,
          res,
          user: req.user,
          session: req.session,
        })
      })
    );

    const PORT = config.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
      console.log(`REST API ready at http://localhost:${PORT}`);
      console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });


  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
