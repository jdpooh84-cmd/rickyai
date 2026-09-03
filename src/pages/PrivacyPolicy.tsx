import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "September 3, 2026";
const COMPANY = "Ricky AI, LLC";
const EMAIL = "privacy@rickyai.com";
const SITE = "https://rickyai.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <Section title="1. Who we are">
            <p>
              {COMPANY} ("<strong>Ricky AI</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") operates the Ricky AI platform
              available at <a href={SITE} target="_blank" rel="noreferrer">{SITE}</a> and associated mobile applications and APIs
              (collectively, the "<strong>Service</strong>"). This Privacy Policy explains how we collect, use, share, and
              protect information about you when you use the Service.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <h3 className="font-semibold mt-4 mb-2">2.1 Information you provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account registration data: name, email address, password</li>
              <li>Business profile data: business name, address, phone, website, industry</li>
              <li>Payment information (processed by Stripe — we do not store card numbers)</li>
              <li>Content you create: scripts, videos, campaign copy, business knowledge</li>
              <li>Contacts and customers you import or enter into the CRM</li>
              <li>Communications you send through the messaging features</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">2.2 Information collected automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Usage data: features accessed, steps completed, timestamps</li>
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Error logs and performance metrics</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">2.3 Information from third parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>OAuth data when you connect Google, Facebook, or other platforms</li>
              <li>Stripe: subscription status and billing events</li>
              <li>Twilio: call logs and SMS delivery receipts for numbers you configure</li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, operate, and improve the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (account, billing, security alerts)</li>
              <li>To provide customer support</li>
              <li>To enforce our Terms of Service and prevent abuse</li>
              <li>To generate aggregate, anonymized analytics that improve the AI models powering the Service</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal information to third parties. We do not use your contact
              list or CRM data to train AI models without your explicit consent.
            </p>
          </Section>

          <Section title="4. How we share your information">
            <h3 className="font-semibold mt-4 mb-2">4.1 Service providers</h3>
            <p>
              We share data with vendors who help us deliver the Service, including Supabase (infrastructure),
              Stripe (payments), Twilio (telephony and SMS), SendGrid (email), Creatomate (video rendering),
              OpenAI and Anthropic (AI language models), and Vercel (hosting). Each provider processes data
              only as directed by us and is bound by contractual data protection obligations.
            </p>

            <h3 className="font-semibold mt-4 mb-2">4.2 Legal requirements</h3>
            <p>
              We may disclose information if required by law, regulation, or valid legal process, or to
              protect the rights, property, or safety of Ricky AI, our users, or the public.
            </p>

            <h3 className="font-semibold mt-4 mb-2">4.3 Business transfers</h3>
            <p>
              If Ricky AI is acquired, merged, or otherwise transferred, your information may be transferred
              as part of that transaction. We will notify you before your information is subject to a different
              privacy policy.
            </p>
          </Section>

          <Section title="5. Data retention">
            <p>
              We retain your account data for as long as your account is active. After account closure, we
              retain data for up to 90 days to allow reactivation, then delete it unless longer retention is
              required by law. Aggregated, anonymized analytics data may be retained indefinitely. Webhook
              receipts and audit logs are retained for 30–90 days.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We implement technical and organizational safeguards appropriate to the sensitivity of the data
              we process, including encryption in transit (TLS) and at rest (AES-256), role-based access
              controls, row-level security in the database, and API key encryption. No system is perfectly
              secure. If you suspect unauthorized access to your account, contact us immediately at{" "}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>Depending on your jurisdiction, you may have rights to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability (where technically feasible)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with the
              subject line "Privacy Request." We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Cookies and tracking">
            <p>
              We use essential cookies required for authentication and session management. We do not use
              third-party advertising cookies. You may disable cookies in your browser settings, but the
              Service will not function without session cookies.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              The Service is not directed to children under 13. We do not knowingly collect personal
              information from children. If you believe a child has provided us personal information, contact
              us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users by email
              and update the "Last updated" date at the top. Continued use of the Service after the effective
              date constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="11. Contact us">
            <p>
              For privacy questions or requests, contact us at:{" "}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 border-b border-border pb-2">{title}</h2>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
