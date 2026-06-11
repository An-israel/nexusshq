import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Wrench, Bug, ArrowUpCircle } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — Nexxos HQ" },
      {
        name: "description",
        content: "See what's new in Nexxos HQ — product updates, improvements, and fixes.",
      },
    ],
  }),
  component: ChangelogPage,
});

type EntryType = "new" | "improved" | "fixed";

interface Entry {
  type: EntryType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  entries: Entry[];
}

const TYPE_META: Record<EntryType, { label: string; icon: typeof Sparkles; className: string }> = {
  new: { label: "New", icon: Sparkles, className: "bg-blue-500/10 text-blue-400" },
  improved: {
    label: "Improved",
    icon: ArrowUpCircle,
    className: "bg-emerald-500/10 text-emerald-400",
  },
  fixed: { label: "Fixed", icon: Bug, className: "bg-amber-500/10 text-amber-400" },
};

const RELEASES: Release[] = [
  {
    version: "2026.6.1",
    date: "June 9, 2026",
    entries: [
      {
        type: "new",
        text: "Super admins can now view and manage all platform users from a dedicated Users tab.",
      },
      {
        type: "new",
        text: "Added a universal email notification system covering task assignments, mentions, and weekly summaries.",
      },
      {
        type: "improved",
        text: "Reorganised the workspace sidebar into five collapsible categories for faster navigation.",
      },
      {
        type: "fixed",
        text: "Resolved an issue where assigning a task to a teammate could be blocked by a row-level security error.",
      },
    ],
  },
  {
    version: "2026.5.4",
    date: "May 26, 2026",
    entries: [
      {
        type: "new",
        text: "Introduced AI-powered burnout detection based on attendance, task load, and check-in sentiment.",
      },
      {
        type: "improved",
        text: "Tightened workspace data isolation across announcements, wiki pages, OKRs, and KPIs.",
      },
      {
        type: "improved",
        text: "Realtime presence and messaging channels are now scoped strictly to your workspace.",
      },
    ],
  },
  {
    version: "2026.5.1",
    date: "May 12, 2026",
    entries: [
      {
        type: "new",
        text: "Launched recurring tasks, so repetitive work is automatically recreated on schedule.",
      },
      {
        type: "new",
        text: "Added GPS-based clock-in with configurable office radius for attendance accuracy.",
      },
      {
        type: "fixed",
        text: "Fixed a bug where document uploads could be placed outside a manager's own workspace folder.",
      },
    ],
  },
  {
    version: "2026.4.2",
    date: "April 21, 2026",
    entries: [
      {
        type: "new",
        text: "Added OKRs and KPI dashboards for tracking objectives and key results across teams.",
      },
      {
        type: "improved",
        text: "Improved performance review scoring with clearer breakdowns by category.",
      },
      {
        type: "fixed",
        text: "Fixed timezone handling in standup reminders for teams spanning multiple regions.",
      },
    ],
  },
  {
    version: "2026.4.0",
    date: "April 7, 2026",
    entries: [
      {
        type: "new",
        text: "Introduced Kudos — a way for team members to publicly recognise each other's work.",
      },
      {
        type: "new",
        text: "Added client project tracking with deliverable approvals and feedback rounds.",
      },
      {
        type: "improved",
        text: "Reworked the org chart view for clearer reporting lines in larger teams.",
      },
    ],
  },
];

function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
          <p className="mt-3 text-[15px] text-gray-300 leading-relaxed">
            New features, improvements, and fixes — shipped continuously to help your team run
            smoother.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-12">
          {RELEASES.map((release) => (
            <div key={release.version} className="relative border-l border-[#1E1E1E] pl-8">
              <div className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full border-2 border-blue-500 bg-[#0A0A0A]" />
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-bold text-white">{release.version}</h2>
                <span className="text-[13px] text-gray-500">{release.date}</span>
              </div>
              <ul className="mt-4 space-y-3">
                {release.entries.map((entry, i) => {
                  const meta = TYPE_META[entry.type];
                  const Icon = meta.icon;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <span className="text-[14px] text-gray-300 leading-relaxed">
                        {entry.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 flex items-center gap-3 rounded-xl border border-[#1E1E1E] bg-[#111111] p-5">
          <Wrench className="h-5 w-5 shrink-0 text-gray-500" />
          <p className="text-[13px] text-gray-400">
            We ship updates regularly. Major releases are announced in-app and via email to
            workspace owners and admins.
          </p>
        </div>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
