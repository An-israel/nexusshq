import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Nexus HQ" },
      { name: "description", content: "Read Nexus HQ's Privacy Policy." },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  { id: "section-1", title: "1. Who We Are" },
  { id: "section-2", title: "2. Information We Collect" },
  { id: "section-3", title: "3. How We Use Your Information" },
  { id: "section-4", title: "4. Legal Basis for Processing" },
  { id: "section-5", title: "5. Sharing Your Information" },
  { id: "section-6", title: "6. Data Retention" },
  { id: "section-7", title: "7. Your Rights" },
  { id: "section-8", title: "8. Cookies" },
  { id: "section-9", title: "9. International Transfers" },
  { id: "section-10", title: "10. Security" },
  { id: "section-11", title: "11. Contact Us" },
];

// Placeholder component
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-sm">{children}</span>
  );
}

function PrivacyPage() {
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
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-gray-400">Last updated: May 2026</p>
          <p className="mt-4 text-[15px] text-gray-300 leading-relaxed max-w-3xl">
            At Nexus HQ, we are committed to protecting your privacy and handling your personal data
            with transparency and care. This Privacy Policy explains how{" "}
            <Placeholder>[Nexus HQ Ltd]</Placeholder> ("we", "us", or "our") collects, uses, stores,
            and shares information when you use our Service.
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
                1. Who We Are
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                <Placeholder>[Nexus HQ Ltd]</Placeholder> is the data controller responsible for
                your personal data. We are registered at{" "}
                <Placeholder>[Company Address, Lagos, Nigeria]</Placeholder>. If you have questions
                about how we handle your data, please contact our team at{" "}
                <Placeholder>[privacy@nexushq.io]</Placeholder>.
              </p>
            </section>

            {/* 2 */}
            <section id="section-2">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                2. Information We Collect
              </h2>
              <p className="mb-3 text-[15px] text-gray-300 leading-relaxed">
                We collect information you provide directly and information generated through your
                use of the Service:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300 mb-4">
                <li>Account information: name, email address, job title, company name</li>
                <li>Workspace data: tasks, attendance records, messages, payslips, documents</li>
                <li>
                  Payment information: billing details (processed securely by our payment provider)
                </li>
                <li>
                  Usage data: log files, IP addresses, browser type, pages visited, time spent
                </li>
                <li>Device information: operating system, device identifiers</li>
                <li>Communications: any messages sent to our support team</li>
              </ul>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                We do not intentionally collect sensitive personal data (such as health information
                or biometric data) unless you explicitly provide it as part of your workspace
                content.
              </p>
            </section>

            {/* 3 */}
            <section id="section-3">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                3. How We Use Your Information
              </h2>
              <p className="mb-3 text-[15px] text-gray-300 leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300">
                <li>Provide, operate, and improve the Service</li>
                <li>Process transactions and send billing communications</li>
                <li>Respond to customer support requests</li>
                <li>Send product updates, security alerts, and administrative messages</li>
                <li>Analyse usage trends to improve features and user experience</li>
                <li>Detect and prevent fraud, abuse, and security incidents</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* 4 */}
            <section id="section-4">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                4. Legal Basis for Processing
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Where applicable data protection law requires a legal basis for processing, we rely
                on the following:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300 mt-3">
                <li>
                  <strong className="text-white">Contract performance:</strong> Processing necessary
                  to deliver the Service you signed up for
                </li>
                <li>
                  <strong className="text-white">Legitimate interests:</strong> Improving our
                  product, preventing fraud, and ensuring security
                </li>
                <li>
                  <strong className="text-white">Legal obligation:</strong> Complying with
                  applicable laws and regulations
                </li>
                <li>
                  <strong className="text-white">Consent:</strong> For optional communications such
                  as marketing emails (which you may withdraw at any time)
                </li>
              </ul>
            </section>

            {/* 5 */}
            <section id="section-5">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                5. Sharing Your Information
              </h2>
              <p className="mb-3 text-[15px] text-gray-300 leading-relaxed">
                We do not sell your personal data. We may share it in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300">
                <li>
                  <strong className="text-white">Service providers:</strong> Third-party vendors who
                  help us operate the Service (e.g. hosting, payment processing, email delivery)
                  under appropriate data processing agreements
                </li>
                <li>
                  <strong className="text-white">Workspace administrators:</strong> Your workspace
                  admin can see activity data for members within their workspace
                </li>
                <li>
                  <strong className="text-white">Legal compliance:</strong> When required by law,
                  court order, or to protect the safety of our users
                </li>
                <li>
                  <strong className="text-white">Business transfers:</strong> In the event of a
                  merger, acquisition, or sale of assets, your data may be transferred with
                  appropriate notice
                </li>
              </ul>
            </section>

            {/* 6 */}
            <section id="section-6">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                6. Data Retention
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                We retain your personal data for as long as your account is active or as needed to
                provide the Service. Workspace data is retained for the duration of your
                subscription. After account cancellation or termination, we retain data for up to 90
                days to allow for reactivation and to fulfil legal obligations, after which it is
                securely deleted or anonymised. You may request earlier deletion as described in
                Section 7.
              </p>
            </section>

            {/* 7 */}
            <section id="section-7">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                7. Your Rights
              </h2>
              <p className="mb-3 text-[15px] text-gray-300 leading-relaxed">
                Depending on your location, you may have the following rights regarding your
                personal data:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[15px] text-gray-300">
                <li>Right to access the personal data we hold about you</li>
                <li>Right to correct inaccurate or incomplete data</li>
                <li>Right to request deletion of your data ("right to be forgotten")</li>
                <li>Right to restrict or object to certain types of processing</li>
                <li>Right to data portability (receive your data in a machine-readable format)</li>
                <li>Right to withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-4 text-[15px] text-gray-300 leading-relaxed">
                To exercise any of these rights, please contact us at{" "}
                <Placeholder>[privacy@nexushq.io]</Placeholder>. We will respond within 30 days. We
                may need to verify your identity before processing your request.
              </p>
            </section>

            {/* 8 */}
            <section id="section-8">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                8. Cookies
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                We use essential cookies to keep the Service functioning. We do not use tracking or
                advertising cookies. For full details of the cookies we use, see our{" "}
                <a href="/cookies" className="text-blue-400 hover:underline">
                  Cookie Policy
                </a>
                . You can manage your cookie preferences at any time using the banner at the bottom
                of any public page.
              </p>
            </section>

            {/* 9 */}
            <section id="section-9">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                9. International Transfers
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Nexus HQ is operated from <Placeholder>[Nigeria]</Placeholder>. If you access the
                Service from outside Nigeria, your data may be transferred to and processed in
                Nigeria or other countries where our service providers operate. We take steps to
                ensure that any such transfers comply with applicable data protection laws and that
                your data is afforded an adequate level of protection.
              </p>
            </section>

            {/* 10 */}
            <section id="section-10">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                10. Security
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                We implement industry-standard technical and organisational security measures to
                protect your data, including encryption in transit (TLS), encrypted storage, access
                controls, and regular security reviews. However, no method of transmission or
                storage is 100% secure. If you discover a security vulnerability, please disclose it
                responsibly by contacting <Placeholder>[security@nexushq.io]</Placeholder>.
              </p>
            </section>

            {/* 11 */}
            <section id="section-11">
              <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
                11. Contact Us
              </h2>
              <p className="text-[15px] text-gray-300 leading-relaxed">
                If you have questions, concerns, or requests regarding this Privacy Policy or our
                data practices, please contact us:
              </p>
              <div className="mt-4 space-y-2 text-[15px] text-gray-300">
                <p>
                  Email: <Placeholder>[privacy@nexushq.io]</Placeholder>
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
