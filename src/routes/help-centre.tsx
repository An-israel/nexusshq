import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  CheckSquare,
  Clock,
  CreditCard,
  Users,
  MessageSquare,
  Settings,
  Mail,
  ChevronRight,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { comingSoon, DEMO_EMAIL } from "@/lib/marketing";

export const Route = createFileRoute("/help-centre")({
  head: () => ({
    meta: [
      { title: "Help Centre — Nexxos HQ" },
      {
        name: "description",
        content:
          "Find answers to common questions about Nexxos HQ, or get in touch with our support team.",
      },
    ],
  }),
  component: HelpCentrePage,
});

const CATEGORIES = [
  {
    icon: CheckSquare,
    title: "Tasks & Projects",
    desc: "Creating, assigning, and tracking tasks and recurring work",
    articles: [
      "How to assign a task to a team member",
      "Setting up recurring tasks",
      "Understanding task statuses and priorities",
      "Using the team board (Kanban view)",
    ],
  },
  {
    icon: Clock,
    title: "Attendance & Clock In",
    desc: "Clock-in/out, GPS verification, and attendance reports",
    articles: [
      "How GPS clock-in works",
      "What to do if clock-in is blocked by location",
      "Viewing your attendance history",
      "Setting your office location as an admin",
    ],
  },
  {
    icon: Users,
    title: "Team & Roles",
    desc: "Managing members, roles, and permissions",
    articles: [
      "Inviting new team members",
      "Understanding owner, admin, manager and employee roles",
      "Removing or deactivating a member",
      "Setting up your org chart",
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & Plans",
    desc: "Subscriptions, seats, invoices, and upgrades",
    articles: [
      "Choosing the right plan for your team",
      "How seat-based billing works",
      "Updating your payment method",
      "Cancelling or downgrading your subscription",
    ],
  },
  {
    icon: MessageSquare,
    title: "Messaging & Notifications",
    desc: "Channels, direct messages, and notification settings",
    articles: [
      "Setting up channels for your workspace",
      "Managing notification preferences",
      "Using @mentions effectively",
      "Turning on daily digest emails",
    ],
  },
  {
    icon: Settings,
    title: "Workspace Settings",
    desc: "General configuration, branding, and integrations",
    articles: [
      "Customising your workspace branding",
      "Setting up automations",
      "Managing feature flags and modules",
      "Exporting your workspace data",
    ],
  },
];

function HelpCentrePage() {
  const [query, setQuery] = React.useState("");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      {/* Hero / search */}
      <div className="border-b border-[#1E1E1E] bg-gradient-to-b from-blue-600/10 to-transparent">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight">How can we help?</h1>
          <p className="mt-3 text-[15px] text-gray-300">
            Search our help articles or browse by category below.
          </p>
          <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-lg border border-[#1E1E1E] bg-[#111111] px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for articles, e.g. 'clock in', 'invoices', 'roles'..."
              className="w-full bg-transparent text-[14px] text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-6 text-xl font-bold text-white border-b border-[#1E1E1E] pb-2">
          Browse by category
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ icon: Icon, title, desc, articles }) => (
            <div key={title} className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-[16px] font-bold text-white">{title}</h3>
              <p className="mt-1 text-[13px] text-gray-400">{desc}</p>
              <ul className="mt-4 space-y-2">
                {articles.map((article) => (
                  <li key={article}>
                    <a
                      href={comingSoon("help-article")}
                      className="flex items-center justify-between gap-2 text-[13px] text-gray-300 hover:text-blue-400 transition-colors"
                    >
                      <span>{article}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-600" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="border-t border-[#1E1E1E]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">Still need help?</h2>
          <p className="mt-2 text-[15px] text-gray-300">
            Can't find what you're looking for? Our support team is happy to help.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`mailto:${DEMO_EMAIL}?subject=${encodeURIComponent("Support Request — Nexxos HQ")}`}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-[14px] font-medium text-white transition-colors"
            >
              Email Support
            </a>
            <Link
              to="/system-status"
              className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] text-white hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              Check System Status
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
