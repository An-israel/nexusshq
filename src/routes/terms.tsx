import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Nexxos HQ" },
      { name: "description", content: "Read Nexxos HQ's Terms of Service." },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  { id: "section-1", title: "1. Acceptance of Terms" },
  { id: "section-2", title: "2. Description of Service" },
  { id: "section-3", title: "3. User Accounts" },
  { id: "section-4", title: "4. Acceptable Use Policy" },
  { id: "section-5", title: "5. Subscription & Billing" },
  { id: "section-6", title: "6. Data & Privacy" },
  { id: "section-7", title: "7. Intellectual Property" },
  { id: "section-8", title: "8. Termination" },
  { id: "section-9", title: "9. Limitation of Liability" },
  { id: "section-10", title: "10. Governing Law" },
  { id: "section-11", title: "11. Changes to Terms" },
  { id: "section-12", title: "12. Contact Us" },
];

// Placeholder component
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-sm">{children}</span>
  );
}

function TermsPage() {
  const [activeSection, setActiveSection] = React.useState("section-1");

  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Admin warning banner */}
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <span>⚠</span>
          <span>
            This page has unfilled placeholders highlighted in amber. Replace them before
            publishing.
          </span>
        </div>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-gray-400">Last updated: May 2026</p>
          <p className="mt-4 text-[15px] text-gray-300 leading-relaxed max-w-3xl">
            These Terms of Service ("Terms") govern your access to and use of Nexxos HQ, a team
            operations platform provided by{" "}
            <Placeholder>[Nexxos HQ Ltd / Company Legal Name]</Placeholder>. By accessing or using
            the Service, you agree to be bound by these Terms. If you do not agree, please do not
            use the Service.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-10 items-start">
          {/* Sticky TOC */}
          <aside className="hidden lg:block w-56 shrink-0 sticky top-24">
            <div className="bg-[#111111] rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-3">
                Contents
              </p>
              <nav className="space-y-1">
                {SECTIONS.map(({ id, title }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`block text-[13px] py-1 transition-colors leading-snug ${
                      activeSection === id
                        ? "text-blue-500 font-semibold"
                        : "text-gray-500 hover:text-blue-400"
                    }`}
                  >
                    {title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 space-y-12">
            {/* 1 */}
            <section id="section-1">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                By creating an account, accessing, or using Nexxos HQ (the "Service"), you agree to
                these Terms of Service and our Privacy Policy. These Terms apply to all users of the
                Service, including workspace administrators, managers, and employees. If you are
                accepting these Terms on behalf of an organisation, you represent that you have the
                authority to bind that organisation to these Terms.
              </p>
            </section>

            {/* 2 */}
            <section id="section-2">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                2. Description of Service
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Nexxos HQ is a cloud-based team operations platform offering attendance tracking,
                task management, messaging, performance reviews, payslip management, leave
                management, OKRs, KPIs, AI-powered insights, and related tools. The Service is
                provided on a subscription basis. Features and pricing are subject to change with
                notice as described in Section 11.
              </p>
            </section>

            {/* 3 */}
            <section id="section-3">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                3. User Accounts
              </h2>
              <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                <p>
                  <span className="text-blue-400 font-semibold">3.1</span> You must provide
                  accurate, complete, and current information when creating an account. You are
                  responsible for maintaining the security and confidentiality of your login
                  credentials.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">3.2</span> You must be at least 18
                  years old to create a workspace. By registering, you confirm that you meet this
                  requirement.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">3.3</span> You are responsible for
                  all activity that occurs under your account. Notify us immediately at{" "}
                  <Placeholder>[support@nexxoshq.io]</Placeholder> if you suspect unauthorised
                  access.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">3.4</span> We reserve the right to
                  suspend or terminate accounts that violate these Terms or are associated with
                  fraudulent activity.
                </p>
              </div>
            </section>

            {/* 4 */}
            <section id="section-4">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                4. Acceptable Use Policy
              </h2>
              <p className="mb-3 text-[15px] text-gray-300 leading-relaxed">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300">
                <li>Violate any applicable law or regulation</li>
                <li>Upload or transmit malicious code, viruses, or harmful content</li>
                <li>Harass, abuse, threaten, or harm any individual or group</li>
                <li>Infringe upon any intellectual property rights</li>
                <li>Attempt to gain unauthorised access to any system or user account</li>
                <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
                <li>Resell or sublicense the Service without our prior written consent</li>
                <li>
                  Use the Service to store or transmit personal data in violation of applicable data
                  protection laws
                </li>
              </ul>
              <p className="mt-4 text-[15px] text-gray-300 leading-relaxed">
                We reserve the right to investigate and take appropriate action against any
                violation of this policy, including suspension or termination of accounts.
              </p>
            </section>

            {/* 5 */}
            <section id="section-5">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                5. Subscription & Billing
              </h2>
              <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                <p>
                  <span className="text-blue-400 font-semibold">5.1</span> Nexxos HQ offers several
                  subscription plans. Plan details, pricing, and features are listed at{" "}
                  <a href="/pricing" className="text-blue-400 hover:underline">
                    nexxoshq.io/pricing
                  </a>
                  . All prices are exclusive of applicable taxes unless stated otherwise.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">5.2</span> Subscriptions are billed
                  in advance on a monthly or annual basis. By providing a payment method, you
                  authorise us to charge the applicable fees.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">5.3</span> All fees are
                  non-refundable except as required by law or as expressly stated in these Terms. We
                  do not offer prorated refunds for downgrades or cancellations mid-cycle.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">5.4</span> We reserve the right to
                  modify pricing with at least 30 days' notice. Continued use of the Service after a
                  price change constitutes your acceptance of the new pricing.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">5.5</span> If payment fails, we may
                  suspend access to the Service until payment is received. We will make reasonable
                  attempts to notify you before suspension.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">5.6</span> All payments are
                  processed securely. We do not store your full payment card details. By
                  subscribing, you agree to our payment processor's terms of service.
                </p>
              </div>
            </section>

            {/* 6 */}
            <section id="section-6">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                6. Data & Privacy
              </h2>
              <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                <p>
                  <span className="text-blue-400 font-semibold">6.1</span> Your use of the Service
                  is subject to our{" "}
                  <a href="/privacy" className="text-blue-400 hover:underline">
                    Privacy Policy
                  </a>
                  , which is incorporated into these Terms by reference.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">6.2</span> You retain ownership of
                  all data you upload to or generate within the Service ("Your Content"). You grant
                  us a limited licence to process Your Content solely to provide the Service.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">6.3</span> We implement reasonable
                  technical and organisational measures to protect your data. However, no system is
                  completely secure, and we cannot guarantee absolute security.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">6.4</span> Upon account termination,
                  you may request an export of Your Content within 30 days. After that period, we
                  may delete your data in accordance with our data retention policy.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">6.5</span> We do not sell your
                  personal data to third parties. We may share data with service providers who
                  assist in delivering the Service, subject to appropriate data processing
                  agreements.
                </p>
              </div>
            </section>

            {/* 7 */}
            <section id="section-7">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                7. Intellectual Property
              </h2>
              <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                <p>
                  <span className="text-blue-400 font-semibold">7.1</span> All intellectual property
                  rights in and to the Service, including software, design, logos, and trademarks,
                  are owned by <Placeholder>[Nexxos HQ Ltd]</Placeholder> or its licensors.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">7.2</span> We grant you a limited,
                  non-exclusive, non-transferable, revocable licence to use the Service solely for
                  your internal business purposes during the subscription term.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">7.3</span> You may not copy,
                  reproduce, republish, modify, sell, or distribute any part of the Service without
                  our prior written consent.
                </p>
              </div>
            </section>

            {/* 8 */}
            <section id="section-8">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                8. Termination
              </h2>
              <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                <p>
                  <span className="text-blue-400 font-semibold">8.1</span> You may cancel your
                  subscription at any time from within your account settings. Cancellation takes
                  effect at the end of the current billing period.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">8.2</span> We may terminate or
                  suspend your account immediately, without prior notice or liability, if you breach
                  these Terms.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">8.3</span> We may terminate the
                  Service entirely with at least 60 days' written notice. In such an event, we will
                  provide a pro-rated refund of any prepaid fees.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">8.4</span> Upon termination, your
                  right to use the Service ceases immediately. Provisions of these Terms that by
                  their nature should survive termination will remain in effect.
                </p>
              </div>
            </section>

            {/* 9 */}
            <section id="section-9">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                9. Limitation of Liability
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                To the fullest extent permitted by applicable law, Nexxos HQ and its directors,
                employees, partners, and affiliates shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including loss of profits,
                data, or goodwill, arising from your use of or inability to use the Service. Our
                total liability for any claim arising out of or relating to these Terms or the
                Service shall not exceed the amount you paid to us in the 12 months preceding the
                claim.
              </p>
            </section>

            {/* 10 */}
            <section id="section-10">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                10. Governing Law
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of{" "}
                <Placeholder>[Federal Republic of Nigeria]</Placeholder>, without regard to its
                conflict of law provisions. Any disputes arising under these Terms shall be subject
                to the exclusive jurisdiction of the courts of{" "}
                <Placeholder>[Lagos State, Nigeria]</Placeholder>.
              </p>
            </section>

            {/* 11 */}
            <section id="section-11">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                11. Changes to Terms
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                We may update these Terms from time to time. When we make material changes, we will
                notify you via email to the address associated with your account or by a prominent
                notice within the Service at least 14 days before the changes take effect. Your
                continued use of the Service after the effective date constitutes your acceptance of
                the revised Terms. If you do not agree, you must stop using the Service before the
                effective date.
              </p>
            </section>

            {/* 12 */}
            <section id="section-12">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                12. Contact Us
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="mt-4 space-y-2 text-[15px] text-gray-300">
                <p>
                  Email: <Placeholder>[support@nexxoshq.io]</Placeholder>
                </p>
                <p>
                  Phone: <Placeholder>[+234 XXX XXX XXXX]</Placeholder>
                </p>
                <p>
                  Address: <Placeholder>[Company Address, Lagos, Nigeria]</Placeholder>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
