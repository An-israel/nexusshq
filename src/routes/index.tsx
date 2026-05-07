import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock, CheckSquare, MessageSquare, BarChart3, Users, Shield,
  ArrowRight, Zap, Monitor, Download, Star, Sparkles, Briefcase,
  CalendarOff, Flag, BookOpen, Bell, ChevronRight,
} from "lucide-react";

const TIMEOUT_SENTINEL = Symbol("timeout");
const DOWNLOAD_URL = "https://github.com/An-israel/nexusshq/releases/latest";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 3000),
      ),
    ]);
    if (result !== TIMEOUT_SENTINEL && result.data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

const FEATURES = [
  { icon: Clock, title: "Attendance Tracking", desc: "One-tap clock in/out. Auto-clock-out at end of day. Real-time status visible to every manager." },
  { icon: CheckSquare, title: "Task Management", desc: "Assign daily, weekly, monthly, or one-time tasks with priorities, deadlines, and progress tracking." },
  { icon: MessageSquare, title: "Team Messaging", desc: "Direct messages and group channels built in. @mention teammates, share files, auto-link URLs." },
  { icon: BarChart3, title: "Reports & KPIs", desc: "Visual dashboards for task completion, attendance trends, and team performance — exportable to CSV." },
  { icon: Users, title: "Org Chart & Teams", desc: "Visualise your company structure. Manage roles, departments, and reporting lines easily." },
  { icon: Shield, title: "Role-Based Access", desc: "Admins, managers, and employees each see exactly what they need — nothing more, nothing less." },
  { icon: Sparkles, title: "AI Intelligence", desc: "Claude AI writes task descriptions, analyses performance reviews, and flags burnout risk automatically." },
  { icon: Briefcase, title: "Client Projects", desc: "Give clients a branded portal link to track project milestones — no login required on their end." },
  { icon: CalendarOff, title: "Leave Management", desc: "Submit, approve, and track leave requests with automatic balance calculations per leave type." },
  { icon: Flag, title: "Goals & OKRs", desc: "Set company-wide objectives and key results. Track progress with live indicators at every level." },
  { icon: BookOpen, title: "Company Handbook", desc: "Publish policies, guides, and SOPs that every employee can access from any device." },
  { icon: Bell, title: "Smart Notifications", desc: "In-app and email alerts for every important event. Nothing slips through the cracks." },
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
    quote: "We replaced four separate apps with Nexus HQ. Attendance, tasks, messaging, and approvals all in one place. Our team actually uses it.",
    name: "Amara O.",
    role: "Operations Manager",
  },
  {
    quote: "The AI burnout detection caught an issue before it became a problem. That feature alone is worth the subscription.",
    name: "David K.",
    role: "HR Director",
  },
  {
    quote: "The client project portal is brilliant. Clients can see milestone progress without needing a login — they love it.",
    name: "Sarah M.",
    role: "Agency Owner",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Nexus HQ</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link to="/" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Built for growing teams · AI-powered
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Your entire team
            <br />
            <span className="text-primary">runs from here</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Nexus HQ replaces your scattered HR tools with one unified workspace — attendance, tasks, messaging, KPIs, leave, and AI insights all in one place.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Sign in to workspace
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Monitor className="h-4 w-4 shrink-0" />
            <span>Also available as a desktop app —</span>
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Download for Windows
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-extrabold text-primary">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-24" id="features">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything your team needs</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              12 purpose-built modules that replace a dozen separate apps — and they all talk to each other.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-24 bg-card/30">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Up and running in minutes</h2>
            <p className="mt-3 text-muted-foreground">Three steps and your whole team is inside.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="relative flex flex-col items-start">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-xl font-extrabold text-primary">
                  {step}
                </div>
                <h3 className="mb-2 font-semibold text-lg">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Loved by teams</h2>
            <div className="mt-2 flex items-center justify-center gap-0.5">
              {[1,2,3,4,5].map((n) => <Star key={n} className="h-4 w-4 fill-warning text-warning" />)}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }) => (
              <div key={name} className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20 bg-card/30">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mb-8 text-muted-foreground">
            Start free with up to 10 users. Scale as your team grows — no surprise fees.
          </p>
          <div className="mb-8 grid gap-4 sm:grid-cols-3 text-left">
            {[
              { tier: "Starter", price: "Free", users: "Up to 10 users", highlight: false },
              { tier: "Growth", price: "$49 /mo", users: "Up to 100 users", highlight: true },
              { tier: "Enterprise", price: "Custom", users: "Unlimited users", highlight: false },
            ].map(({ tier, price, users, highlight }) => (
              <div
                key={tier}
                className={`rounded-2xl border p-5 ${highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tier}</p>
                <p className={`mt-1 text-2xl font-extrabold ${highlight ? "text-primary" : ""}`}>{price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{users}</p>
              </div>
            ))}
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            See full pricing <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Desktop app ──────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 text-center sm:flex-row sm:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Monitor className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Desktop App for Windows</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Install Nexus HQ as a native Windows app. Lives in your system tray, works offline-friendly — no browser needed.
              </p>
            </div>
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Download .exe
            </a>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-24 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to bring order to your team?
          </h2>
          <p className="mb-8 text-muted-foreground leading-relaxed">
            Get your workspace live in minutes. Invite your team, assign roles, and start running operations from one place.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-3.5 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold">Nexus HQ</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Download
              </a>
            </nav>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nexus HQ. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
