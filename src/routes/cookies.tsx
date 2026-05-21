import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Nexus HQ" },
      { name: "description", content: "Learn about the cookies Nexus HQ uses." },
    ],
  }),
  component: CookiesPage,
});

const COOKIES_TABLE = [
  {
    name: "nexus_session",
    purpose: "Authentication session token",
    type: "Essential",
    duration: "Session",
  },
  {
    name: "nexus_auth_token",
    purpose: "Keeps you signed in",
    type: "Essential",
    duration: "7 days",
  },
  {
    name: "nexus_cookie_consent",
    purpose: "Remembers your cookie preference",
    type: "Functional",
    duration: "1 year",
  },
];

function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <h1 className="text-4xl font-bold tracking-tight">Cookie Policy</h1>
        <p className="mt-2 text-gray-400">Last updated: May 2026</p>

        {/* What are cookies */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
            What are cookies?
          </h2>
          <p className="text-[15px] text-gray-300 leading-relaxed">
            Cookies are small text files that websites place on your device when you visit them.
            They are widely used to make websites work efficiently, remember your preferences, and
            provide useful information to site owners. Cookies are not harmful — they cannot execute
            code or carry viruses.
          </p>
        </section>

        {/* Cookies we use */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-6">
            Cookies we use
          </h2>
          <p className="mb-6 text-[15px] text-gray-300 leading-relaxed">
            Nexus HQ uses only essential and functional cookies. We do not use tracking cookies,
            advertising cookies, or analytics cookies that report to third parties.
          </p>

          {/* Cookie table */}
          <div className="overflow-x-auto rounded-xl border border-[#1E1E1E]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E] bg-[#111111]">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                    Cookie Name
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                    Purpose
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {COOKIES_TABLE.map(({ name, purpose, type, duration }, i) => (
                  <tr
                    key={name}
                    className={`border-b border-[#1E1E1E] transition-colors hover:bg-white/3 ${
                      i === COOKIES_TABLE.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <code className="text-blue-400 text-[13px] font-mono">{name}</code>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-gray-300">{purpose}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          type === "Essential"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        {type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-gray-400">{duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How to disable cookies */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white border-b border-[#1E1E1E] pb-2 mb-4">
            How to disable cookies
          </h2>
          <p className="mb-6 text-[15px] text-gray-300 leading-relaxed">
            You can control cookies through your browser settings. Note that disabling essential
            cookies may prevent Nexus HQ from functioning correctly — in particular, you will not be
            able to stay signed in.
          </p>

          <div className="space-y-6">
            {/* Chrome */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
              <h3 className="text-[15px] font-semibold text-white mb-2">Google Chrome</h3>
              <ol className="list-decimal list-inside space-y-1 text-[14px] text-gray-300">
                <li>Open Chrome and click the three-dot menu (⋮) in the top right</li>
                <li>Go to Settings → Privacy and security → Cookies and other site data</li>
                <li>Choose your preferred cookie setting</li>
              </ol>
            </div>

            {/* Firefox */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
              <h3 className="text-[15px] font-semibold text-white mb-2">Mozilla Firefox</h3>
              <ol className="list-decimal list-inside space-y-1 text-[14px] text-gray-300">
                <li>Open Firefox and click the menu button (☰) in the top right</li>
                <li>Go to Settings → Privacy & Security</li>
                <li>
                  Under "Cookies and Site Data", choose your preferred setting or click Manage Data
                </li>
              </ol>
            </div>

            {/* Safari */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
              <h3 className="text-[15px] font-semibold text-white mb-2">Apple Safari</h3>
              <ol className="list-decimal list-inside space-y-1 text-[14px] text-gray-300">
                <li>Open Safari and go to Safari → Settings (or Preferences)</li>
                <li>Click the Privacy tab</li>
                <li>
                  Under "Cookies and website data", choose "Block all cookies" or manage per site
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Link to Privacy Policy */}
        <section className="mt-12">
          <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
            <p className="text-[15px] text-gray-300">
              For more information about how we handle your personal data, please read our{" "}
              <Link
                to="/privacy"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              . If you have questions about cookies or your privacy, contact us at{" "}
              <a
                href="mailto:privacy@nexushq.io"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                privacy@nexushq.io
              </a>
              .
            </p>
          </div>
        </section>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
