# Gmail Pub/Sub Setup Guide

This guide will help you complete the Gmail Pub/Sub integration for your expense tracker.

## What We've Built

The backend now has:
- ✅ Gmail API watch setup (automatically starts when user logs in)
- ✅ Webhook endpoint to receive email notifications
- ✅ Email parser for Indian banks (HDFC, ICICI, SBI, Axis) and generic transactions
- ✅ Transaction storage in MongoDB
- ✅ Encrypted token storage for security

## Next Steps to Make It Work

### 1. Generate a Strong Encryption Key

**IMPORTANT**: Update the `ENCRYPTION_KEY` in `.env.local`:

```bash
# Generate a random 32-character key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Copy the output and update `.env.local`:
```
ENCRYPTION_KEY=<paste-the-generated-key-here>
```

### 2. Re-authenticate with Google

Since we changed from bcrypt to encryption, you need to log in again:

1. Clear your user from the database:
   ```bash
   # In MongoDB shell
   use expense-tracker-local
   db.users.deleteMany({})
   ```

2. Go to `http://localhost:5000/auth/google` and complete OAuth login

3. Check the server logs - you should see:
   ```
   Gmail watch set up successfully for user: your-email@gmail.com
   ```

### 3. Set Up Webhook for Local Testing (Option A: ngrok)

Gmail Pub/Sub needs to reach your local server. Use ngrok:

1. Install ngrok: `brew install ngrok` (on Mac)

2. Start ngrok on port 5000:
   ```bash
   ngrok http 5000
   ```

3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. Create a Pub/Sub **Push Subscription** in Google Cloud Console:
   - Go to: Pub/Sub → Subscriptions → Create Subscription
   - Name: `mail-listener-push`
   - Topic: `mail-listener`
   - Delivery type: **Push**
   - Endpoint URL: `https://abc123.ngrok.io/webhook/gmail`
   - Click Create

### 3. Set Up Webhook for Local Testing (Option B: Pull Subscription)

If you don't want to use ngrok, you can manually pull messages:

1. Create a **Pull Subscription** in Google Cloud Console:
   - Go to: Pub/Sub → Subscriptions → Create Subscription
   - Name: `mail-listener-pull`
   - Topic: `mail-listener`
   - Delivery type: **Pull**
   - Click Create

2. You'll need to manually pull and process messages (we can add this later)

### 4. Test the Integration

#### Test Authentication & Watch Setup
1. After logging in, check MongoDB:
   ```javascript
   db.users.findOne()
   ```
   - Verify `gmailWatchExpiry` is set (7 days in the future)
   - Verify `historyId` is set

#### Test Email Processing
1. Send yourself a test transaction email, or forward a bank transaction email to your Gmail
2. Check server logs for:
   - "Gmail notification received"
   - "Transaction saved"
3. Check MongoDB:
   ```javascript
   db.transactions.find()
   ```

### 5. Service Account (For Production)

For production deployment, you'll need a Google Cloud service account:

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a service account
3. Grant it "Pub/Sub Subscriber" role
4. Download the JSON key file
5. Add to `.env.production`:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

## Troubleshooting

### "Access Token has expired" Error
- The watch setup will automatically refresh tokens
- If it still fails, re-authenticate via `/auth/google`

### "User not found for email" in Logs
- Make sure the email in the notification matches your user's email in MongoDB
- Check: `db.users.findOne({}, {email: 1})`

### Webhook Not Receiving Notifications
- Verify ngrok is running and URL is correct in Pub/Sub subscription
- Test webhook: `curl https://your-ngrok-url.ngrok.io/webhook/gmail`
- Should return: `{"status":"ok","message":"Gmail webhook endpoint is active"}`

### No Transactions Being Saved
- Check server logs for "No transaction data found"
- The email might not match our parsing patterns
- Forward the email subject to us so we can add support

## API Routes

- `GET /auth/google` - Authenticate with Google
- `GET /auth/current_user` - Get current user info
- `POST /webhook/gmail` - Pub/Sub webhook (internal use)
- `GET /webhook/gmail` - Webhook health check

## What Happens When a Transaction Email Arrives

1. Gmail sends notification to Pub/Sub topic `mail-listener`
2. Pub/Sub pushes to your webhook: `POST /webhook/gmail`
3. Webhook fetches recent unread emails
4. Parser checks if email is from a bank
5. Parser extracts transaction details (amount, merchant, date)
6. Transaction is saved to `transactions` collection
7. Email processing completes

## Watch Expiration

Gmail watches expire after 7 days. The system will:
- Store the expiry time in `user.gmailWatchExpiry`
- TODO: Add a cron job to renew watches before expiry

For now, you'll need to re-authenticate every 7 days to renew the watch.
