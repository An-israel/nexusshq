import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  CheckSquare,
  MessageSquare,
  BarChart3,
  Users,
  Shield,
  ArrowRight,
  Zap,
  Monitor,
  Download,
} from "lucide-react";

const TIMEOUT_SENTINEL = Symbol("timeout");

// Update this URL after publishing a GitHub Release
const DOWNLOAD_URL =
  "https://github.com/An-israel/nexusshq/releases/latest";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 3000),
      ),
    ]);
    // Already logged in — skip landing page
    if (result !== TIMEOUT_SENTINEL && result.data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

const FEATURES = [
  {
    icon: Clock,
    title: "Attendance Tracking",
    desc: "Clock in and out with one tap. Automatic clock-out at 5 PM WAT. Real-time status visible to managers.",
  },
  {
    icon: CheckSquare,
    title: "Task Management",
    desc: "Assign tasks, set deadlines, and track progress across your entire team from a single view.",
  },
  {
    icon: MessageSquare,
    title: "Team Messaging",
    desc: "Direct messages and group chats built in. Get notified in-app and by email when messages arrive.",
  },
  {
    icon: BarChart3,
    title: "KPI Dashboard",
    desc: "Define and monitor key performance indicators per department. Stay on top of what matters.",
  },
  {
    icon: Users,
    title: "Org Chart & Teams",
    desc: "Visualise your company structure. Manage roles, departments, and reporting lines easily.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    desc: "Admins, managers, and employees each see exactly what they need. Nothing more.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Nexus HQ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Subtle glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Internal operations platform
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Run your team
            <br />
            <span className="text-primary">from one place</span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
            Nexus HQ brings attendance, tasks, messaging, KPIs, and team
            management into a single, seamless workspace built for your company.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Sign in to your workspace
            </Link>
          </div>

          {/* Desktop download strip */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Monitor className="h-4 w-4 shrink-0" />
            <span>Also available as a native desktop app —</span>
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

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything your team needs
            </h2>
            <p className="mt-3 text-muted-foreground">
              Purpose-built tools that replace a dozen separate apps.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-accent/30"
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

      {/* ── Desktop app download ─────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 text-center sm:flex-row sm:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Monitor className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Desktop App for Windows</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Install Nexus HQ as a native Windows app. Lives in your system
                tray, works like a regular desktop app — no browser needed.
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

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            Ready to get organised?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Sign up in seconds — no email verification, no waiting. Your manager
            will assign your role and you're ready to go.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">Nexus HQ</span>
          </div>
          <span>© {new Date().getFullYear()} SkryveAI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
