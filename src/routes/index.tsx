import * as React from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getLastWorkspaceSlug } from "@/lib/last-workspace";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

import {
  Clock,
  CheckSquare,
  MessageSquare,
  BarChart3,
  Users,
  Shield,
  ArrowRight,
  Monitor,
  Download,
  Star,
  Sparkles,
  Briefcase,
  CalendarOff,
  Flag,
  BookOpen,
  Bell,
  ChevronRight,
} from "lucide-react";

const TIMEOUT_SENTINEL = Symbol("timeout");
const DOWNLOAD_URL = "https://github.com/An-israel/nexusshq/releases/latest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus HQ — All-in-One Workspace for Team Operations" },
      {
        name: "description",
        content:
          "Run attendance, tasks, standups, OKRs, KPIs and AI insights from one workspace built for modern teams.",
      },
      { property: "og:title", content: "Nexus HQ — All-in-One Workspace for Team Operations" },
      {
        property: "og:description",
        content:
          "Attendance, tasks, standups, OKRs, KPIs and AI insights — unified for modern teams.",
      },
      { property: "og:url", content: "https://nexus.skryveai.com/" },
    ],
    links: [{ rel: "canonical", href: "https://nexus.skryveai.com/" }],
  }),
  beforeLoad: async () => {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 3000),
      ),
    ]);
    if (result !== TIMEOUT_SENTINEL && result.data.session) {
      const userId = result.data.session.user.id;
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspaces(slug)")
        .eq("user_id", userId)
        .eq("is_active", true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slugs = (memberships ?? [])
        .map((m: any) => m?.workspaces?.slug)
        .filter(Boolean) as string[];

      if (slugs.length > 1) {
        // Prefer the user's last selected workspace if it's still valid.
        const last = getLastWorkspaceSlug();
        if (last && slugs.includes(last)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          throw redirect({ to: `/${last}/dashboard` as any });
        }
        throw redirect({ to: "/workspaces" });
      }

      if (slugs.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw redirect({ to: `/${slugs[0]}/dashboard` as any });
      }
      // No workspace yet — let them create one
      throw redirect({ to: "/create-workspace" });
    }
  },
  component: LandingPage,
});

const FEATURES = [
  {
    icon: Clock,
    title: "Attendance Tracking",
    desc: "One-tap clock in/out. Auto-clock-out at end of day. Real-time status visible to every manager.",
  },
  {
    icon: CheckSquare,
    title: "Task Management",
    desc: "Assign daily, weekly, monthly, or one-time tasks with priorities, deadlines, and progress tracking.",
  },
  {
    icon: MessageSquare,
    title: "Team Messaging",
    desc: "Direct messages and group channels built in. @mention teammates, share files, auto-link URLs.",
  },
  {
    icon: BarChart3,
    title: "Reports & KPIs",
    desc: "Visual dashboards for task completion, attendance trends, and team performance — exportable to CSV.",
  },
  {
    icon: Users,
    title: "Org Chart & Teams",
    desc: "Visualise your company structure. Manage roles, departments, and reporting lines easily.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    desc: "Admins, managers, and employees each see exactly what they need — nothing more, nothing less.",
  },
  {
    icon: Sparkles,
    title: "AI Intelligence",
    desc: "Claude AI writes task descriptions, analyses performance reviews, and flags burnout risk automatically.",
  },
  {
    icon: Briefcase,
    title: "Client Projects",
    desc: "Give clients a branded portal link to track project milestones — no login required on their end.",
  },
  {
    icon: CalendarOff,
    title: "Leave Management",
    desc: "Submit, approve, and track leave requests with automatic balance calculations per leave type.",
  },
  {
    icon: Flag,
    title: "Goals & OKRs",
    desc: "Set company-wide objectives and key results. Track progress with live indicators at every level.",
  },
  {
    icon: BookOpen,
    title: "Company Handbook",
    desc: "Publish policies, guides, and SOPs that every employee can access from any device.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    desc: "In-app and email alerts for every important event. Nothing slips through the cracks.",
  },
];

const STATS = [
  { value: "12+", label: "Modules in one platform" },
  { value: "< 5s", label: "Clock-in speed" },
  { value: "3-role", label: "Access control" },
  { value: "100%", label: "Web + desktop" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create your workspace",
    desc: "Sign up in seconds. Invite your team by email. Your manager assigns roles — admin, manager, or employee.",
  },
  {
    step: "02",
    title: "Set up your operations",
    desc: "Configure attendance rules, create task templates, add KPIs and OKRs. Nexus HQ adapts to how you work.",
  },
  {
    step: "03",
    title: "Run your team from one place",
    desc: "Clock-ins, daily standups, task updates, approvals, and reports — everything happens in one tab.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We replaced four separate apps with Nexus HQ. Attendance, tasks, messaging, and approvals all in one place. Our team actually uses it.",
    name: "Amara O.",
    role: "Operations Manager",
  },
  {
    quote:
      "The AI burnout detection caught an issue before it became a problem. That feature alone is worth the subscription.",
    name: "David K.",
    role: "HR Director",
  },
  {
    quote:
      "The client project portal is brilliant. Clients can see milestone progress without needing a login — they love it.",
    name: "Sarah M.",
    role: "Agency Owner",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Dot grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.35) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
          }}
        />
        {/* Aurora glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
          <div className="h-[500px] w-[900px] rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-24 text-center sm:pt-32">
          <a
            href="#features"
            className="group mb-8 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-1 text-[12px] font-medium text-muted-foreground backdrop-blur transition-colors hover:border-border hover:text-foreground"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Now with AI burnout detection
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </a>

          <h1 className="mx-auto max-w-4xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-[72px]">
            The operating system
            <br />
            <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              for modern teams
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Attendance, tasks, messaging, OKRs, KPIs and AI insights — engineered into one workspace
            so your team stops switching tabs and starts shipping.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-[14px] font-medium text-background shadow-lg shadow-foreground/10 transition-all hover:bg-foreground/90"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/40 px-5 py-2.5 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:border-border hover:bg-card"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            <span>Native desktop app for Windows —</span>
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          </div>

          {/* App preview mockup */}
          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="absolute -inset-x-8 -inset-y-4 rounded-[28px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
              {/* Faux window chrome */}
              <div className="flex items-center gap-1.5 border-b border-border/40 bg-card/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 text-[11px] font-mono text-muted-foreground">
                  nexus.app/dashboard
                </span>
              </div>
              {/* Faux dashboard */}
              <div className="grid grid-cols-12 gap-3 p-4">
                <div className="col-span-3 space-y-2">
                  {["Dashboard", "Tasks", "Attendance", "Messages", "Reports", "Team"].map(
                    (it, i) => (
                      <div
                        key={it}
                        className={`rounded-md px-2.5 py-1.5 text-[11px] ${i === 0 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                      >
                        {it}
                      </div>
                    ),
                  )}
                </div>
                <div className="col-span-9 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: "Present today", v: "24" },
                      { l: "Tasks due", v: "12" },
                      { l: "Overtime (wk)", v: "8.5h" },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="rounded-lg border border-border/50 bg-background/40 p-3"
                      >
                        <p className="text-[10px] text-muted-foreground">{s.l}</p>
                        <p className="mt-1 text-base font-semibold tabular-nums">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium">Activity</p>
                      <p className="text-[10px] text-muted-foreground">Live</p>
                    </div>
                    <div className="mt-2.5 flex h-20 items-end gap-1">
                      {[40, 55, 30, 72, 48, 90, 65, 80, 52, 68, 75, 88].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-gradient-to-t from-primary/70 to-primary/30"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logos / trust ────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            Built for teams that ship
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {STATS.map(({ value, label }) => (
              <div key={label} className="border-l border-border/50 pl-4">
                <p className="text-2xl font-semibold tracking-tight">{value}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-28" id="features">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Platform
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.1]">
              One workspace.
              <span className="text-muted-foreground">
                {" "}
                Twelve modules. Zero context switching.
              </span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group relative bg-background p-6 transition-colors hover:bg-card/40"
              >
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-primary transition-colors group-hover:border-primary/40">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mb-1.5 text-[14px] font-semibold tracking-tight">{title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-28" id="workflow">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Workflow
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.1]">
              Live in minutes.
              <span className="text-muted-foreground"> Not weeks.</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div
                key={step}
                className="relative rounded-xl border border-border/60 bg-card/40 p-6 backdrop-blur"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">{step}</span>
                  <span className="h-px flex-1 mx-3 bg-gradient-to-r from-border/60 to-transparent" />
                  <span className="text-[11px] text-muted-foreground">
                    {i === HOW_IT_WORKS.length - 1 ? "Done" : "Next →"}
                  </span>
                </div>
                <h3 className="mb-1.5 text-[15px] font-semibold tracking-tight">{title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Customers
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.1]">
              Teams that switched.
              <span className="text-muted-foreground"> Never looked back.</span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 md:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }) => (
              <div key={name} className="bg-background p-7">
                <div className="mb-4 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="h-3 w-3 fill-warning text-warning" />
                  ))}
                </div>
                <p className="mb-6 text-[14px] leading-relaxed text-foreground/90">"{quote}"</p>
                <div className="flex items-center gap-3 border-t border-border/40 pt-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-[12px] font-semibold text-primary">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{name}</p>
                    <p className="text-[11px] text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────── */}
      <PricingTeaser />

      {/* ── Desktop app ──────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/30 p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-semibold tracking-tight">
                  Native desktop app for Windows
                </h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Lives in your system tray. Launches faster than your browser. No tabs to lose.
                </p>
              </div>
              <a
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background/40 px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-background/80"
              >
                <Download className="h-3.5 w-3.5" /> Download .exe
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border/40 py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-[400px] w-[800px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-[44px] sm:leading-[1.05]">
            Stop juggling tabs.
            <br />
            <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
              Start shipping.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Spin up your workspace in under 2 minutes. Free for teams up to 10.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-foreground px-6 py-2.5 text-[14px] font-medium text-background shadow-lg shadow-foreground/10 transition-all hover:bg-foreground/90"
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/40 px-6 py-2.5 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:bg-card"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}

// Base prices in NGN (Naira)
const NGN_PRICES = { basic: 15000, enterprise: 25000, unlimited: 45000 };

// Map country code → currency code (common ones; falls back to NGN)
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CN: "CNY",
  IN: "INR",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  KE: "KES",
  GH: "GHS",
  EG: "EGP",
  AE: "AED",
  SA: "SAR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  TR: "TRY",
  RU: "RUB",
  KR: "KRW",
  SG: "SGD",
  HK: "HKD",
  PH: "PHP",
  ID: "IDR",
  MY: "MYR",
  TH: "THB",
  VN: "VND",
  NG: "NGN",
};

function PricingTeaser(): React.JSX.Element {
  const [currency, setCurrency] = React.useState<string>("NGN");
  const [rate, setRate] = React.useState<number>(1); // NGN → currency

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Detect country (free, no key)
        const geo = await fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .catch(() => null);
        const cc = geo?.country_code as string | undefined;
        const cur = (cc && COUNTRY_CURRENCY[cc]) || "NGN";
        if (cur === "NGN") return;
        // Get conversion rate from NGN base
        const fx = await fetch("https://open.er-api.com/v6/latest/NGN")
          .then((r) => r.json())
          .catch(() => null);
        const r = fx?.rates?.[cur];
        if (cancelled || !r) return;
        setCurrency(cur);
        setRate(r);
      } catch {
        /* keep NGN */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (ngn: number): string => {
    const value = ngn * rate;
    // Round nicely: whole numbers for big values, 2 decimals for small
    const fractionDigits = value >= 100 ? 0 : 2;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${value.toFixed(fractionDigits)} ${currency}`;
    }
  };

  const tiers = [
    {
      tier: "Basic",
      price: fmt(NGN_PRICES.basic),
      suffix: "/mo",
      users: "Up to 7 members",
      highlight: false,
    },
    {
      tier: "Enterprise",
      price: fmt(NGN_PRICES.enterprise),
      suffix: "/mo",
      users: "Up to 15 members",
      highlight: true,
    },
    {
      tier: "Unlimited",
      price: fmt(NGN_PRICES.unlimited),
      suffix: "/mo",
      users: "Unlimited members",
      highlight: false,
    },
  ];

  return (
    <section className="border-t border-border/40 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Pricing
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.1]">
            Fair pricing.
            <span className="text-muted-foreground"> No surprises.</span>
          </h2>
          {currency !== "NGN" && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Showing prices in {currency} (converted from ₦). Billed in NGN.
            </p>
          )}
        </div>
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {tiers.map(({ tier, price, suffix, users, highlight }) => (
            <div
              key={tier}
              className={`rounded-xl border p-5 transition-colors ${
                highlight
                  ? "border-primary/50 bg-gradient-to-b from-primary/[0.08] to-transparent"
                  : "border-border/60 bg-card/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tier}
                </p>
                {highlight && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{price}</span>
                {suffix && <span className="text-[12px] text-muted-foreground">{suffix}</span>}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">{users}</p>
            </div>
          ))}
        </div>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-primary"
        >
          See full pricing <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
