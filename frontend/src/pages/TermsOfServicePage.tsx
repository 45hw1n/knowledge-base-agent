import { Link } from "react-router-dom";

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; Back to Cortex
      </Link>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        Last updated: April 15, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Cortex (&quot;the Service&quot;), you agree to
            be bound by these Terms of Service (&quot;Terms&quot;). If you do not
            agree to these Terms, you may not use the Service.
          </p>
          <p className="mt-2">
            Cortex is a personal knowledge base application that connects to
            your Gmail account to ingest emails and their attachments, extract
            structured entities from them, and let you search and query that
            knowledge later.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Eligibility</h2>
          <p>
            You must be at least 18 years old and have a valid Google account to
            use Cortex. By using the Service, you represent and warrant that you
            meet these requirements.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. Account and Authentication</h2>
          <p>
            Cortex uses Google OAuth for authentication. You are responsible for
            maintaining the security of your Google account. You agree to:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Provide accurate and complete information.</li>
            <li>Keep your Google account credentials secure.</li>
            <li>
              Notify us immediately of any unauthorized access to your Cortex
              account.
            </li>
            <li>
              Accept responsibility for all activity that occurs under your
              account.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. Use of the Service</h2>
          <p>Cortex grants you a limited, non-exclusive, non-transferable right to use the Service for your personal, non-commercial knowledge management purposes. You agree not to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to reverse-engineer, decompile, or disassemble the Service.</li>
            <li>Interfere with or disrupt the Service or its infrastructure.</li>
            <li>Use automated systems (bots, scrapers) to access the Service beyond its intended functionality.</li>
            <li>Share your account access with others.</li>
            <li>Use the Service to process emails belonging to someone else without their explicit consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. Gmail Access and Google API Usage</h2>
          <p>
            By granting Cortex access to your Gmail, you acknowledge and agree
            that:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Cortex accesses your Gmail in <strong>read-only</strong> mode. We
              cannot send, modify, or delete your emails.
            </li>
            <li>
              Emails and their attachments are processed to extract structured
              entities for your own knowledge base. What counts as relevant
              content, and how it is processed, may evolve as the Service does.
            </li>
            <li>
              You can revoke Gmail access at any time through your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Google Account settings
              </a>
              .
            </li>
            <li>
              Our use of Google API data complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">6. Data Accuracy Disclaimer</h2>
          <p>
            <strong>
              Cortex extracts structured entities from your emails and
              attachments using automated document processing and AI-assisted
              extraction. While we strive for accuracy, you acknowledge and
              agree that:
            </strong>
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Extracted entities and their fields may contain errors, omissions,
              or misclassifications.
            </li>
            <li>
              Cortex is <strong>not</strong> a substitute for the original
              source documents or professional recordkeeping.
            </li>
            <li>
              You should independently verify any extracted information before
              relying on it for important decisions.
            </li>
            <li>
              Not all emails or attachments may be processed — format
              variations across senders and document types may cause some
              content to be missed or misread.
            </li>
            <li>
              We are not responsible for any loss or incorrect decisions made
              based on data provided by Cortex.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">7. Intellectual Property</h2>
          <p>
            The Service, including its code, design, features, and content, is
            owned by Cortex and is protected by applicable intellectual property
            laws. Your data belongs to you — we claim no ownership over the
            content of your emails or the knowledge extracted from them.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Cortex is provided on an &quot;AS IS&quot; and &quot;AS
              AVAILABLE&quot; basis, without warranties of any kind, either express
              or implied.
            </li>
            <li>
              We do not warrant that the Service will be uninterrupted,
              error-free, or completely secure.
            </li>
            <li>
              We shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              Service.
            </li>
            <li>
              We shall not be liable for any loss or damage resulting from
              inaccurate, incomplete, or missed entity extraction.
            </li>
            <li>
              Our total liability to you for any claims arising from or related to
              the Service shall not exceed the amount you paid us in the 12 months
              preceding the claim, or INR 1,000, whichever is greater.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Indemnification</h2>
          <p>
            You agree to indemnify and hold Cortex harmless from any claims,
            damages, losses, or expenses (including reasonable legal fees) arising
            from your use of the Service, your violation of these Terms, or your
            violation of any rights of another party.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">10. Service Availability</h2>
          <p>
            We strive to keep Cortex available at all times, but we do not
            guarantee uninterrupted access. The Service may be temporarily
            unavailable due to maintenance, updates, or circumstances beyond our
            control (including changes to Google APIs or third-party service
            outages).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">11. Termination</h2>
          <p>
            You may stop using Cortex at any time by revoking access through
            your Google Account settings and contacting us to request account
            deletion.
          </p>
          <p className="mt-2">
            We reserve the right to suspend or terminate your access to the
            Service at any time, with or without notice, for any reason, including
            but not limited to:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Violation of these Terms.</li>
            <li>Fraudulent or abusive use of the Service.</li>
            <li>Extended inactivity.</li>
            <li>Requests by law enforcement or government agencies.</li>
          </ul>
          <p className="mt-2">
            Upon termination, we will delete your account data in accordance with
            our Privacy Policy. Provisions that by their nature should survive
            termination (including liability limitations, indemnification, and
            dispute resolution) will remain in effect.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">12. Changes to These Terms</h2>
          <p>
            We may modify these Terms at any time. We will notify you of
            significant changes by posting the updated Terms on this page and
            updating the &quot;Last updated&quot; date. Your continued use of the
            Service after any changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">13. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the
            laws of India. Any disputes arising from these Terms or the Service
            shall be subject to the exclusive jurisdiction of the courts in
            Bengaluru, India.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">14. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="mt-2">
            {/* TODO: replace with real contact */}
            <strong>Email:</strong>{" "}
            <a
              href="mailto:support@cortex.app"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              support@cortex.app
            </a>
          </p>
          <p className="mt-1">
            <strong>Website:</strong>{" "}
            <a
              href="https://cortex.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              https://cortex.app
            </a>
          </p>
          <p className="mt-2">
            Cortex is operated by an independent developer.
          </p>
        </section>
      </div>
    </div>
  );
}
