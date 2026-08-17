import { Link } from "react-router-dom";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; Back to Fynverse
      </Link>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        Last updated: April 15, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
          <p>
            Fynverse (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a personal finance
            tracking application that helps you understand your spending by
            automatically extracting transaction information from your email. This
            Privacy Policy explains what information we collect, how we use it, and
            the choices you have.
          </p>
          <p className="mt-2">
            By using Fynverse, you agree to the collection and use of information
            in accordance with this policy. If you do not agree, please do not use
            the service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Information We Collect</h2>

          <h3 className="mb-2 mt-4 font-medium">2.1 Account Information</h3>
          <p>
            When you sign in with Google, we receive and store the following from
            your Google profile:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Display name, first name, and last name</li>
            <li>Email address</li>
            <li>Profile picture URL</li>
            <li>Google account identifier</li>
          </ul>

          <h3 className="mb-2 mt-4 font-medium">2.2 Gmail Data</h3>
          <p>
            With your explicit consent, we access your Gmail inbox in{" "}
            <strong>read-only</strong> mode. Fynverse processes only emails that
            are automatically identified as likely financial transaction
            notifications (such as bank alerts, payment confirmations, or UPI
            receipts). Emails that are not identified as financial transactions
            are not processed or stored.
          </p>
          <p className="mt-2">
            From qualifying transaction emails, we extract:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Sender address</li>
            <li>Email subject line</li>
            <li>Date of the email</li>
            <li>Email body text (used for transaction extraction, stored in encrypted form)</li>
            <li>Gmail message ID and thread ID</li>
          </ul>

          <h3 className="mb-2 mt-4 font-medium">2.3 Extracted Transaction Data</h3>
          <p>
            From qualifying emails, we extract and store structured financial data
            including:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Transaction amount and currency</li>
            <li>Merchant name</li>
            <li>Transaction date and time</li>
            <li>Payment mode (UPI, credit card, debit card, etc.)</li>
            <li>Transaction category and subcategory</li>
            <li>Reference or transaction IDs from the email</li>
          </ul>

          <h3 className="mb-2 mt-4 font-medium">2.4 User-Provided Financial Information</h3>
          <p>
            You may optionally add your own financial instruments for better
            transaction matching:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Bank account details (name, bank, last 4 digits of account number, UPI IDs, debit card last 4 digits)</li>
            <li>Credit card details (name, bank, last 4 digits, billing cycle day)</li>
          </ul>
          <p className="mt-2">
            We never ask for or store full account numbers, card numbers, CVVs, PINs,
            or passwords.
          </p>

          <h3 className="mb-2 mt-4 font-medium">2.5 Preferences</h3>
          <p>
            We store user preferences such as salary cycle day, monthly budget,
            email sync start date, and Google Sheet integration settings.
          </p>

          <h3 className="mb-2 mt-4 font-medium">2.6 Authentication Tokens</h3>
          <p>
            We store Google OAuth access and refresh tokens to maintain your
            session and access your Gmail on your behalf. These tokens are
            encrypted at rest using industry-standard encryption.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">
            3. Use of Google User Data
          </h2>
          <p>
            Fynverse&apos;s use and transfer of information received from Google
            APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p className="mt-2">
            Fynverse strictly adheres to Google&apos;s Limited Use requirements.
            Data obtained from Google APIs is used solely to provide user-facing
            features within the application, specifically automated transaction
            tracking. This data is not used for advertising, marketing, or any
            secondary purposes, and is never sold or shared with third parties.
          </p>

          <h3 className="mb-2 mt-4 font-medium">3.1 Why We Need Gmail Access</h3>
          <p>
            Fynverse requires read-only access to your Gmail to automatically
            detect and extract transaction-related emails (bank alerts, payment
            confirmations, UPI notifications, etc.) so you don&apos;t have to
            manually enter every expense.
          </p>

          <h3 className="mb-2 mt-4 font-medium">3.2 What Data Is Extracted</h3>
          <p>
            We only process emails that our heuristic system identifies as likely
            financial transactions. From those emails, we extract transaction
            details such as amount, merchant, date, and payment method. The
            processed email body text is stored in AES-256-GCM encrypted form and
            automatically deleted after 30 days.
          </p>

          <h3 className="mb-2 mt-4 font-medium">3.3 What We Do NOT Do</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>We do <strong>not</strong> use your Gmail data for advertising or marketing purposes.</li>
            <li>We do <strong>not</strong> sell, rent, or trade your Gmail data to any third party.</li>
            <li>We do <strong>not</strong> use your Gmail data to build user profiles for advertising.</li>
            <li>We do <strong>not</strong> allow humans to read your emails, except where necessary for security purposes, to comply with applicable law, or with your explicit consent.</li>
            <li>We do <strong>not</strong> read or store non-financial emails.</li>
          </ul>

          <h3 className="mb-2 mt-4 font-medium">3.4 Google Scopes Requested</h3>
          <p>We request the following Google OAuth scopes:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              <strong>Profile &amp; Email</strong> — to create and manage your
              account.
            </li>
            <li>
              <strong>Gmail (read-only)</strong> — to read transaction-related
              emails from your inbox.
            </li>
            <li>
              <strong>Google Sheets</strong> — to optionally export your
              transactions to a Google Sheet you designate.
            </li>
          </ul>

          <h3 className="mb-2 mt-4 font-medium">3.5 Gmail Push Notifications</h3>
          <p>
            We use Google Cloud Pub/Sub to receive real-time push notifications
            when new emails arrive in your inbox. These notifications contain only
            your email address and a history identifier — no email content is
            included in the push notification itself. We then use the Gmail API to
            fetch and evaluate new messages.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. How We Use Your Information</h2>
          <ul className="list-inside list-disc space-y-1 pl-4">
            <li>To create and manage your Fynverse account.</li>
            <li>To identify and extract financial transactions from your email.</li>
            <li>To categorize and organize your transactions automatically.</li>
            <li>To optionally sync your transactions to a Google Sheet.</li>
            <li>To provide you with personal spending insights.</li>
            <li>To improve the accuracy of our transaction detection and extraction.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. AI-Assisted Processing</h2>
          <p>
            Fynverse uses third-party AI services (currently OpenAI and/or Google
            Gemini) to extract structured transaction data from email content. When
            processing an email, the following information may be sent to the AI
            provider:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Email subject, sender, date, and body text of transaction emails.</li>
            <li>Your configured spending categories.</li>
            <li>
              Partial payment instrument information (bank names, last 4 digits,
              UPI IDs) for matching purposes.
            </li>
          </ul>
          <p className="mt-2">
            We use third-party AI providers that operate under strict data
            protection agreements. These providers do not use your data for model
            training or advertising purposes. We ensure that any data shared with
            such providers is limited to what is necessary for transaction
            extraction.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">6. Data Storage and Security</h2>
          <ul className="list-inside list-disc space-y-1 pl-4">
            <li>All data is stored in a MongoDB database hosted on MongoDB Atlas with encryption at rest.</li>
            <li>OAuth tokens are encrypted using industry-standard algorithms before storage.</li>
            <li>Sensitive email fields (sender, subject, body) are encrypted with AES-256-GCM.</li>
            <li>All connections use HTTPS/TLS encryption in transit.</li>
            <li>Session cookies are configured with <code>httpOnly</code>, <code>secure</code>, and <code>sameSite</code> flags.</li>
          </ul>
          <p className="mt-2">
            While we implement reasonable security measures, no method of electronic
            storage or transmission is 100% secure. We cannot guarantee absolute
            security.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">7. Data Retention</h2>
          <ul className="list-inside list-disc space-y-1 pl-4">
            <li>
              <strong>Processed email data</strong> (encrypted email body and
              metadata used for extraction) is automatically deleted after{" "}
              <strong>30 days</strong>.
            </li>
            <li>
              <strong>Extracted transaction records</strong> are retained for as
              long as your account is active, so you can view your historical
              spending data.
            </li>
            <li>
              <strong>Account data</strong> is retained for as long as your
              account is active. You can request deletion at any time (see
              Section 9).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. Third-Party Services</h2>
          <p>
            Fynverse integrates with the following third-party services:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              <strong>Google APIs</strong> — for authentication, Gmail access,
              Sheets export, and Pub/Sub notifications.
            </li>
            <li>
              <strong>OpenAI / Google Gemini</strong> — for AI-powered transaction
              extraction from email content.
            </li>
            <li>
              <strong>MongoDB Atlas</strong> — for database hosting.
            </li>
            <li>
              <strong>Vercel</strong> — for frontend hosting.
            </li>
          </ul>
          <p className="mt-2">
            We do not share your personal data with any other third parties. We do
            not sell your data to anyone, for any reason, ever.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              <strong>Access</strong> — Request a copy of all personal data we hold
              about you.
            </li>
            <li>
              <strong>Correction</strong> — Request correction of any inaccurate
              data.
            </li>
            <li>
              <strong>Deletion</strong> — Request deletion of your account and all
              associated data. We will delete your account data, transaction
              records, and any stored email data.
            </li>
            <li>
              <strong>Revoke Access</strong> — You can revoke Fynverse&apos;s
              access to your Google account at any time through your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Google Account permissions
              </a>
              .
            </li>
            <li>
              <strong>Export</strong> — You can export your transaction data to
              Google Sheets at any time through the app.
            </li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, please contact us at the email address
            listed below.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">10. Children&apos;s Privacy</h2>
          <p>
            Fynverse is not intended for use by anyone under the age of 18. We do
            not knowingly collect personal information from children. If you
            believe a child has provided us with personal data, please contact us
            and we will promptly delete it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you
            of any changes by posting the new Privacy Policy on this page and
            updating the &quot;Last updated&quot; date. Your continued use of the
            service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">12. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or your data,
            please contact us at:
          </p>
          <p className="mt-2">
            <strong>Email:</strong>{" "}
            <a
              href="mailto:ashwin.fynverse@gmail.com"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ashwin.fynverse@gmail.com
            </a>
          </p>
          <p className="mt-1">
            <strong>Website:</strong>{" "}
            <a
              href="https://fynverse.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              https://fynverse.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
