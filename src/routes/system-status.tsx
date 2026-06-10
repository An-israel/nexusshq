import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export const Route = createFileRoute("/system-status")({
  head: () => ({
    meta: [
      { title: "System Status — Nexxos HQ" },
      {
        name: "description",
        content: "Current operational status of Nexxos HQ services and infrastructure.",
      },
    ],
  }),
  component: SystemStatusPage,
});

interface Service {
  name: string;
  description: string;
}

const SERVICES: Service[] = [
  { name: "Web Application", description: "Core app — dashboards, tasks, and workspace pages" },
  { name: "Authentication", description: "Sign in, sign up, and session management" },
  { name: "Realtime & Messaging", description: "Live presence, channels, and direct messages" },
  { name: "Attendance & GPS Clock-In", description: "Clock-in/out and location verification" },
  { name: "Notifications & Email", description: "In-app notifications and email delivery" },
  { name: "Billing & Payments", description: "Subscription management and payment processing" },
  { name: "File Storage", description: "Document uploads, avatars, and attachments" },
  { name: "AI Insights", description: "Burnout detection and AI-generated suggestions" },
];

interface HistoryEntry {
  date: string;
  title: string;
  status: "resolved";
  description: string;
}

const HISTORY: HistoryEntry[] = [
  {
    date: "May 30, 2026",
    title: "Delayed email notifications",
    status: "resolved",
    description:
      "Some users experienced delays of up to 30 minutes in receiving task and mention email notifications. Resolved by scaling the email queue worker.",
  },
  {
    date: "May 14, 2026",
    title: "Realtime messaging reconnect issues",
    status: "resolved",
    description:
      "A subset of users on the Messages page experienced dropped realtime connections requiring a manual refresh. Resolved by patching the realtime channel subscription logic.",
  },
  {
    date: "April 22, 2026",
    title: "Slow dashboard load times",
    status: "resolved",
    description:
      "Workspace dashboards were loading slower than usual during peak hours due to a database query regression. Resolved after optimising the affected queries.",
  },
];

function SystemStatusPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">System Status</h1>
          <p className="mt-3 text-[15px] text-gray-300 leading-relaxed">
            Live status of Nexxos HQ services. This page is updated whenever an incident is detected
            or resolved.
          </p>
        </div>

        {/* Overall status banner */}
        <div className="mb-10 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
          <div>
            <p className="text-[15px] font-semibold text-emerald-400">All Systems Operational</p>
            <p className="text-[13px] text-emerald-400/70">
              Last checked: June 10, 2026 at 09:00 WAT
            </p>
          </div>
        </div>

        {/* Services list */}
        <div className="mb-12 rounded-xl border border-[#1E1E1E] bg-[#111111]">
          {SERVICES.map((service, i) => (
            <div
              key={service.name}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${
                i !== SERVICES.length - 1 ? "border-b border-[#1E1E1E]" : ""
              }`}
            >
              <div>
                <p className="text-[14px] font-medium text-white">{service.name}</p>
                <p className="text-[12px] text-gray-500">{service.description}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Operational
              </span>
            </div>
          ))}
        </div>

        {/* Past incidents */}
        <h2 className="mb-4 text-xl font-bold text-white border-b border-[#1E1E1E] pb-2">
          Past Incidents
        </h2>
        <div className="space-y-4">
          {HISTORY.map((entry) => (
            <div key={entry.title} className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-full bg-gray-700/50 px-2.5 py-1 text-[11px] font-semibold text-gray-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Resolved
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                  <Clock className="h-3 w-3" />
                  {entry.date}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-white">{entry.title}</h3>
              <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">{entry.description}</p>
            </div>
          ))}
        </div>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
