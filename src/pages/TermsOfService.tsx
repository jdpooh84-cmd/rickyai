import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 flex items-center border-b border-border px-6 bg-card/50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="font-display font-bold ml-3">Terms of Service</span>
      </header>

      <main className="max-w-3xl mx-auto p-8 prose prose-invert prose-sm">
        <h1 className="text-2xl font-bold font-display text-foreground">RickyAI — Terms of Service & User Agreement</h1>
        <p className="text-muted-foreground text-xs">Effective Date: June 2025 &bull; Version 1.0</p>

        <p>
          By creating an account, accessing, or using the RickyAI platform ("Services"), you ("User," "you," or "your")
          agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Services.
        </p>

        <h2>1. Platform Overview</h2>
        <p>
          RickyAI provides AI-powered business strategy, content generation, video tools, lead scouting, and related services.
          The platform may integrate with third-party AI providers using API keys you supply.
        </p>

        <h2>2. API Key Responsibility</h2>
        <p>
          <strong>Your API keys are your responsibility.</strong> When you connect a third-party AI provider
          (e.g., OpenAI, Google Gemini, Anthropic), you supply your own API key. You acknowledge and agree that:
        </p>
        <ul>
          <li>You are solely responsible for the security, storage, and protection of your API keys.</li>
          <li>You must not share your API key with any other person or allow unauthorized access.</li>
          <li>RickyAI and its owners, operators, officers, directors, employees, and affiliates ("Company") shall not be
            liable for any loss, damage, unauthorized usage, financial charges, or other consequences arising from the
            compromise, theft, misuse, or exposure of your API key, whether caused by your action, inaction, or any third party.</li>
          <li>The Company stores your API key securely using industry-standard encryption practices but makes no guarantee
            against all possible security breaches.</li>
          <li>You agree to indemnify and hold harmless the Company from any claims, costs, or damages related to the
            use or misuse of your API key.</li>
        </ul>

        <h2>3. Social Media & Content Connections</h2>
        <p>
          You may connect your social media accounts and host content through the platform. By doing so, you represent
          that you have all necessary rights and permissions to the content you upload, and you grant RickyAI a limited,
          non-exclusive license to display and process your content solely for providing the Services.
        </p>

        <h2>4. Acceptable Use & Content Policy</h2>
        <p>You agree not to use the Services to create, upload, share, or distribute any content that:</p>
        <ul>
          <li>Is illegal under federal, state, or local law;</li>
          <li>Promotes violence, terrorism, or illegal activities;</li>
          <li>Contains hate speech, harassment, or threats;</li>
          <li>Contains sexually explicit, obscene, or exploitative material;</li>
          <li>Infringes on the intellectual property rights of any third party;</li>
          <li>Contains malware, phishing, or other harmful code;</li>
          <li>Violates the terms of any connected third-party service.</li>
        </ul>

        <h2>5. Content Moderation & Enforcement</h2>
        <p>
          The Company reserves the right to monitor, review, and remove any content that violates these Terms.
          Enforcement actions follow a progressive discipline system:
        </p>
        <div className="bg-card border border-border rounded-xl p-4 not-prose my-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">1st Offense</span>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">24-hour suspension</strong> — Your account will be temporarily
                restricted for 24 hours. You will receive a warning notification.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">2nd Offense</span>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Up to 30-day suspension</strong> — Your account will be suspended
                for up to 30 days. Access to all Services will be restricted.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded">3rd Offense</span>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Permanent ban</strong> — Your account will be permanently terminated.
                No refunds will be issued. You may not create a new account.
              </p>
            </div>
          </div>
        </div>

        <h2>6. Billing, Cancellation & No-Refund Policy</h2>
        <p>
          <strong>Billing Cycle.</strong> Your billing cycle begins on the date you subscribe. For monthly plans,
          you are billed on the same calendar day each month (e.g., if you subscribe on the 15th, your next payment
          is due the 15th of the following month). For annual plans, you are billed on the same date twelve months
          from your subscription start date.
        </p>
        <p>
          <strong>No Refunds.</strong> All subscription payments are non-refundable. If you cancel your subscription,
          you will retain access to all features through the end of your current paid billing period. No partial
          refunds, prorated refunds, or credits will be issued for any reason, including but not limited to early
          cancellation, non-use, dissatisfaction, or account termination due to policy violations.
        </p>
        <p>
          <strong>Cancellation.</strong> You may cancel your subscription at any time through the account management
          portal. Upon cancellation, your subscription will not renew at the end of the current billing period, and
          your access will end at that time. You are responsible for cancelling before your next billing date to avoid
          additional charges.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE COMPANY SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS,
          DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
        </p>
        <ul>
          <li>Your use of or inability to use the Services;</li>
          <li>Any unauthorized access to or use of your account, API keys, or data;</li>
          <li>Any third-party conduct or content on the Services;</li>
          <li>Any content obtained from the Services;</li>
          <li>Unauthorized access, use, or alteration of your transmissions or content.</li>
        </ul>
        <p>
          IN NO EVENT SHALL THE COMPANY'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE AMOUNT YOU HAVE PAID
          TO THE COMPANY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>

        <h2>8. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless the Company and its officers, directors, employees,
          contractors, agents, licensors, and suppliers from and against any claims, actions, demands, damages,
          obligations, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from
          your use of the Services, your violation of these Terms, or your violation of any third-party rights.
        </p>

        <h2>9. Results Disclaimer</h2>
        <p>
          THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. THE COMPANY MAKES NO WARRANTIES,
          EXPRESS OR IMPLIED, REGARDING THE ACCURACY, RELIABILITY, COMPLETENESS, OR SUITABILITY OF ANY STRATEGIES,
          RECOMMENDATIONS, CONTENT, OR OUTPUTS GENERATED BY THE PLATFORM.
        </p>
        <p>
          <strong>Results are not guaranteed.</strong> The strategies, content plans, video scripts, lead generation
          suggestions, grant recommendations, and all other outputs provided by RickyAI are generated by artificial
          intelligence and are intended as guidance only. What works for one business may not work for another.
          Individual results will vary based on, but not limited to:
        </p>
        <ul>
          <li>Your industry, niche, and competitive landscape;</li>
          <li>Your geographic location and target market;</li>
          <li>Your level of effort, consistency, and execution quality;</li>
          <li>Current market conditions, algorithm changes, and platform policies;</li>
          <li>The quality and completeness of information you provide to the platform.</li>
        </ul>
        <p>
          The Company does not guarantee any specific outcomes, including but not limited to increased revenue,
          followers, engagement, leads, funding, or business growth. You acknowledge that you use the outputs
          of the Services at your own risk and discretion.
        </p>

        <h2>10. Location & Posting Time Disclaimer</h2>
        <p>
          Suggested posting times, content schedules, and distribution strategies are generated based on general
          best practices and the information you provide about your business, location, and target audience.
          <strong> Optimal posting times may differ significantly based on your geographic location, time zone,
          target audience demographics, industry niche, and platform-specific algorithm behavior.</strong>
        </p>
        <p>
          The Company does not guarantee that any suggested posting schedule will produce optimal results for
          your specific audience. You are responsible for testing, adjusting, and optimizing your content
          schedule based on your own analytics and audience engagement data. The platform's recommendations
          should be treated as a starting point, not a definitive strategy.
        </p>

        <h2>11. No Professional Advice</h2>
        <p>
          Nothing provided through the Services constitutes legal, financial, tax, medical, or other professional
          advice. The Company is not a law firm, accounting firm, financial advisory firm, or marketing agency.
          All outputs are AI-generated suggestions. You should consult qualified professionals before making
          business decisions based on information provided by the platform. The Company shall not be liable for
          any decisions you make based on the platform's outputs.
        </p>

        <h2>12. Dispute Resolution — Binding Arbitration & Class Action Waiver</h2>
        <p>
          To the fullest extent permitted by applicable law, you and Company agree that any and all claims, disputes,
          or controversies arising out of or relating to these Terms, the Services, or any relationship between you
          and Company (whether based in contract, tort, statute, fraud, misrepresentation, or any other legal theory,
          and whether such claims arise during or after the termination of such relationship) shall be resolved
          exclusively through final and binding individual arbitration, rather than in court, except that either party
          may bring an individual action in a court of competent jurisdiction within the Commonwealth of Virginia for
          claims that fall within that court's small-claims jurisdiction.
        </p>
        <p>
          <strong>You and Company expressly waive any right to a trial by jury.</strong>
        </p>
        <p>
          The arbitration shall be administered pursuant to the Federal Arbitration Act and conducted by a reputable
          arbitration provider under its applicable consumer arbitration rules as modified by this Section, with the
          seat and venue of arbitration in the Commonwealth of Virginia, unless you and Company agree otherwise in writing.
        </p>
        <p>
          <strong>CLASS ACTION WAIVER:</strong> You and Company agree that each may bring claims against the other only
          in your or its individual capacity, and not as a plaintiff or class member in any purported class, collective,
          representative, or consolidated proceeding, and that no arbitration or court proceeding shall be joined,
          consolidated, or combined with any other proceeding without the prior written consent of all parties to such
          proceeding.
        </p>
        <p>
          If, and only if, a court of competent jurisdiction determines that the foregoing class, collective,
          representative, or consolidated action waiver is unenforceable as to a particular claim, then the arbitration
          agreement set forth in this Section shall be unenforceable as to that claim, which shall proceed exclusively
          in the state or federal courts located in the Commonwealth of Virginia, and you and Company hereby consent
          to the personal jurisdiction and venue of such courts for that limited purpose, while the arbitration
          agreement shall remain in full force and effect for all other claims.
        </p>
        <p>
          These Terms, and the interpretation and enforcement of this Section, shall be governed by and construed in
          accordance with the laws of the Commonwealth of Virginia and, where applicable, the Federal Arbitration Act,
          without giving effect to any choice-of-law or conflict-of-laws rules that would result in the application
          of the laws of any other jurisdiction.
        </p>

        <h2>13. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Virginia,
          without regard to its conflict of law provisions.
        </p>

        <h2>14. Changes to Terms</h2>
        <p>
          The Company reserves the right to modify these Terms at any time. Material changes will be communicated
          through the platform. Your continued use after changes constitutes acceptance of the revised Terms.
        </p>

        <h2>15. Contact</h2>
        <p>
          For questions about these Terms, contact us at <span className="text-primary">support@rickyai.com</span>.
        </p>

        <div className="border-t border-border pt-6 mt-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} RickyAI. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
