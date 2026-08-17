const path = require('path');

/**
 * One-off infra provisioning script: configures the CORS policy on a
 * Cloudflare R2 bucket so browsers are allowed to GET directly via the
 * presigned URLs issued by storageService.getSignedDownloadUrl (see
 * backend/src/services/storage). Uploads no longer go through the browser
 * (the backend uploads to R2 itself), so PUT no longer needs to be allowed
 * here for that purpose — kept for any other direct-to-browser GET use.
 *
 * Bucket-level CORS is an infrastructure/provisioning concern, not a
 * per-request business operation — it does NOT belong in
 * cloudflareR2StorageProvider.js (which stays scoped to object operations
 * used at runtime). This script is the one deliberate, intentional
 * exception to "only cloudflareR2StorageProvider.js touches the AWS SDK" —
 * it is bucket administration, not business logic, and is meant to be run
 * by a developer/operator, not by the app itself.
 *
 * PutBucketCors fully REPLACES the existing policy, so this is safe/idempotent
 * to rerun any time — in particular:
 *   - after creating a brand-new R2 bucket (dev or prod)
 *   - after adding a new frontend origin that needs to upload/download
 *
 * Usage:
 *   node scripts/configureR2Cors.js                 # uses .env.local
 *   node scripts/configureR2Cors.js --env=production # uses .env.production
 */

const envArg = process.argv.find((arg) => arg.startsWith('--env='));
const envName = envArg ? envArg.split('=')[1] : 'local';
require('dotenv').config({ path: path.resolve(__dirname, `../.env.${envName}`) });

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const config = require('../src/config');

const ALLOWED_ORIGINS = [
    config.CLIENT_URL,
    'http://localhost:5173',
    'https://localhost:5173'
].filter(Boolean);

async function run() {
    if (config.storage.provider !== 'cloudflare-r2') {
        console.error(`❌ STORAGE_PROVIDER is "${config.storage.provider}", expected "cloudflare-r2".`);
        process.exit(1);
    }

    const { accountId, accessKeyId, secretAccessKey, bucketName, endpoint } = config.storage;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        console.error('❌ Missing R2 credentials/bucket name in the loaded environment.');
        process.exit(1);
    }

    const client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });

    console.log(`📦 Env: .env.${envName}`);
    console.log(`📦 Bucket: ${bucketName}`);
    console.log(`🌐 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

    await client.send(new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedOrigins: ALLOWED_ORIGINS,
                    AllowedMethods: ['PUT', 'GET', 'HEAD'],
                    AllowedHeaders: ['*'],
                    ExposeHeaders: ['ETag'],
                    MaxAgeSeconds: 3600
                }
            ]
        }
    }));

    console.log('✅ CORS policy applied.');

    const { CORSRules } = await client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
    console.log('🔎 Current policy:', JSON.stringify(CORSRules, null, 2));
}

run().catch((err) => {
    console.error('❌ Failed to configure CORS:', err);
    process.exit(1);
});
