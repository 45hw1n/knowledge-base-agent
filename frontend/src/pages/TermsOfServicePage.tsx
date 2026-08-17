import { Link } from "react-router-dom";

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; Back to Fynverse
      </Link>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        Last updated: April 15, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Fynverse (&quot;the Service&quot;), you agree to
            be bound by these Terms of Service (&quot;Terms&quot;). If you do not
            agree to these Terms, you may not use the Service.
          </p>
          <p className="mt-2">
            Fynverse is a personal finance tracking application that connects to
            your Gmail account to automatically extract and organize financial
            transaction data from your emails.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Eligibility</h2>
          <p>
            You must be at least 18 years old and have a valid Google account to
            use Fynverse. By using the Service, you represent and warrant that you
            meet these requirements.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. Account and Authentication</h2>
          <p>
            Fynverse uses Google OAuth for authentication. You are responsible for
            maintaining the security of your Google account. You agree to:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Provide accurate and complete information.</li>
            <li>Keep your Google account credentials secure.</li>
            <li>
              Notify us immediately of any unauthorized access to your Fynverse
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
          <p>Fynverse grants you a limited, non-exclusive, non-transferable right to use the Service for your personal, non-commercial financial tracking purposes. You agree not to:</p>
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
            By granting Fynverse access to your Gmail, you acknowledge and agree
            that:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Fynverse accesses your Gmail in <strong>read-only</strong> mode. We
              cannot send, modify, or delete your emails.
            </li>
            <li>
              Only emails identified as potential financial transactions are
              processed. Non-financial emails are not stored.
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
          <h2 className="mb-3 text-xl font-semibold">6. Google Sheets Integration</h2>
          <p>
            Fynverse offers an optional feature to export your transaction data to
            a Google Sheet. By enabling this feature, you acknowledge that:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Fynverse will access and write to the specific Google Sheet you
              designate.
            </li>
            <li>
              You are responsible for managing the sharing and access permissions
              of your Google Sheet.
            </li>
            <li>
              Fynverse is not responsible for any unintended data exposure
              resulting from your Google Sheet sharing settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">
            7. Data Accuracy Disclaimer
          </h2>
          <p>
            <strong>
              Fynverse extracts transaction data from emails using automated
              heuristics and AI-assisted processing. While we strive for accuracy,
              you acknowledge and agree that:
            </strong>
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Extracted transaction amounts, merchant names, dates, categories, and
              other details may contain errors or inaccuracies.
            </li>
            <li>
              Fynverse is <strong>not</strong> a substitute for official bank
              statements, financial records, or professional accounting software.
            </li>
            <li>
              You should independently verify any financial data before relying on
              it for financial decisions, tax filings, or dispute resolution.
            </li>
            <li>
              Transaction categorization is automated and may not always reflect
              the true nature of a transaction.
            </li>
            <li>
              Not all transaction emails may be detected — email format variations
              across banks and financial institutions may cause some transactions
              to be missed.
            </li>
            <li>
              We are not responsible for any financial loss or incorrect financial
              decisions made based on data provided by Fynverse.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. Intellectual Property</h2>
          <p>
            The Service, including its code, design, features, and content, is
            owned by Fynverse and is protected by applicable intellectual property
            laws. Your transaction data belongs to you — we claim no ownership
            over your personal financial information.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Fynverse is provided on an &quot;AS IS&quot; and &quot;AS
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
              inaccurate transaction data, missed transactions, or incorrect
              categorization.
            </li>
            <li>
              Our total liability to you for any claims arising from or related to
              the Service shall not exceed the amount you paid us in the 12 months
              preceding the claim, or INR 1,000, whichever is greater.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">10. Indemnification</h2>
          <p>
            You agree to indemnify and hold Fynverse harmless from any claims,
            damages, losses, or expenses (including reasonable legal fees) arising
            from your use of the Service, your violation of these Terms, or your
            violation of any rights of another party.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">11. Service Availability</h2>
          <p>
            We strive to keep Fynverse available at all times, but we do not
            guarantee uninterrupted access. The Service may be temporarily
            unavailable due to maintenance, updates, or circumstances beyond our
            control (including changes to Google APIs or third-party service
            outages).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">12. Termination</h2>
          <p>
            You may stop using Fynverse at any time by revoking access through
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
          <h2 className="mb-3 text-xl font-semibold">13. Changes to These Terms</h2>
          <p>
            We may modify these Terms at any time. We will notify you of
            significant changes by posting the updated Terms on this page and
            updating the &quot;Last updated&quot; date. Your continued use of the
            Service after any changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the
            laws of India. Any disputes arising from these Terms or the Service
            shall be subject to the exclusive jurisdiction of the courts in
            Bengaluru, India.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">15. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
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
          <p className="mt-2">
            Fynverse is operated by an independent developer.
          </p>
        </section>
      </div>
    </div>
  );
}
