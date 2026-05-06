import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Zap, ArrowRight, HelpCircle, Users, X } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

type Billing = "monthly" | "annual";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    desc: "Perfect for small teams getting started.",
    monthly: 0,
    annual: 0,
    userLimit: "Up to 10 users",
    cta: "Start for free",
    ctaTo: "/login",
    highlight: false,
    badge: null,
    features: [
      "Attendance tracking",
      "Task management",
      "Direct messages",
      "Daily standups",
      "Leave requests",
      "Company handbook",
      "Org chart",
      "Mobile app (PWA)",
      "Email notifications",
    ],
    missing: [
      "AI intelligence layer",
      "KPIs & OKRs",
      "Reports & analytics",
      "Client portal",
      "Recurring tasks",
      "Deliverable reviews",
      "Priority support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    desc: "For growing teams that need the full picture.",
    monthly: 49,
    annual: 39,
    userLimit: "Up to 100 users",
    cta: "Start free trial",
    ctaTo: "/login",
    highlight: true,
    badge: "Most popular",
    features: [
      "Everything in Starter",
      "AI intelligence (Claude AI)",
      "KPIs & OKRs tracking",
      "Reports & analytics",
      "Client portal with tracking",
      "Recurring task automation",
      "Deliverable reviews + scoring",
      "Payslip management",
      "Performance reviews",
      "Task board (Kanban)",
      "Email digest & alerts",
      "Desktop app (Windows)",
    ],
    missing: [
      "Custom branding",
      "SSO / SAML",
      "Dedicated onboarding",
      "SLA guarantee",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "For large organisations with custom needs.",
    monthly: null,
    annual: null,
    userLimit: "Unlimited users",
    cta: "Contact us",
    ctaTo: "/login",
    highlight: false,
    badge: null,
    features: [
      "Everything in Growth",
      "Custom branding & domain",
      "SSO / SAML authentication",
      "Dedicated onboarding",
      "Priority 24/7 support",
      "SLA guarantee",
      "Custom integrations",
      "Data export & backup",
      "Audit logs",
    ],
    missing: [],
  },
];

const COMPARISON = [
  {
    category: "Core HR",
    rows: [
      { feature: "Attendance tracking", starter: true, growth: true, enterprise: true },
      { feature: "Leave management", starter: true, growth: true, enterprise: true },
      { feature: "Daily standups", starter: true, growth: true, enterprise: true },
      { feature: "Performance reviews", starter: false, growth: true, enterprise: true },
      { feature: "Payslip management", starter: false, growth: true, enterprise: true },
    ],
  },
  {
    category: "Tasks & Projects",
    rows: [
      { feature: "Task assignment & tracking", starter: true, growth: true, enterprise: true },
      { feature: "Recurring task automation", starter: false, growth: true, enterprise: true },
      { feature: "Kanban task board", starter: false, growth: true, enterprise: true },
      { feature: "Deliverable submissions", starter: true, growth: true, enterprise: true },
      { feature: "Deliverable scoring", starter: false, growth: true, enterprise: true },
      { feature: "Client portal", starter: false, growth: true, enterprise: true },
    ],
  },
  {
    category: "Communication",
    rows: [
      { feature: "Direct messages", starter: true, growth: true, enterprise: true },
      { feature: "Group channels", starter: true, growth: true, enterprise: true },
      { feature: "File & image attachments", starter: true, growth: true, enterprise: true },
      { feature: "Announcements", starter: true, growth: true, enterprise: true },
      { feature: "Company handbook", starter: true, growth: true, enterprise: true },
    ],
  },
  {
    category: "Intelligence & Insights",
    rows: [
      { feature: "AI task descriptions", starter: false, growth: true, enterprise: true },
      { feature: "AI performance insights", starter: false, growth: true, enterprise: true },
      { feature: "Burnout risk detection", starter: false, growth: true, enterprise: true },
      { feature: "KPIs dashboard", starter: false, growth: true, enterprise: true },
      { feature: "Goals & OKRs", starter: false, growth: true, enterprise: true },
      { feature: "Reports & analytics", starter: false, growth: true, enterprise: true },
    ],
  },
  {
    category: "Admin & Security",
    rows: [
      { feature: "Role-based access control", starter: true, growth: true, enterprise: true },
      { feature: "Org chart", starter: true, growth: true, enterprise: true },
      { feature: "Custom branding", starter: false, growth: false, enterprise: true },
      { feature: "SSO / SAML", starter: false, growth: false, enterprise: true },
      { feature: "Audit logs", starter: false, growth: false, enterprise: true },
      { feature: "SLA guarantee", starter: false, growth: false, enterprise: true },
    ],
  },
];

const FAQ = [
  {
    q: "Is the Starter plan really free forever?",
    a: "Yes. The Starter plan is free for up to 10 users with no time limit. You only pay if you need more users or advanced features.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Absolutely. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades take effect at the next billing cycle.",
  },
  {
    q: "What happens if my team exceeds the user limit?",
    a: "We'll notify you when you're close to the limit. You can upgrade at any time — existing data is never deleted.",
  },
  {
    q: "How does annual billing work?",
    a: "You pay upfront for 12 months and save 20% compared to monthly billing. You can switch back to monthly at renewal.",
  },
  {
    q: "Do you offer a free trial for Growth?",
    a: "Yes — Growth comes with a 14-day free trial, no credit card required.",
  },
  {
    q: "Can I self-host Nexus HQ?",
    a: "Enterprise customers can request a self-hosted deployment. Contact us for details on the on-premise option.",
  },
];

function PricingPage() {
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Nexus HQ</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link to="/" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-foreground font-medium">Pricing</Link>
          </nav>
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
      <section className="py-20 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Start free. Scale as you grow. No hidden fees, no per-feature add-ons.
          </p>
          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                billing === "annual" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-success/15 text-success"
              }`}>
                –20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const price = billing === "annual" ? plan.annual : plan.monthly;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-7 ${
                    plan.highlight
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
                    <div className="mt-2 flex items-end gap-1.5">
                      {price === null ? (
                        <span className="text-3xl font-extrabold">Custom</span>
                      ) : price === 0 ? (
                        <span className="text-3xl font-extrabold">Free</span>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold">${price}</span>
                          <span className="mb-1 text-sm text-muted-foreground">/ mo</span>
                        </>
                      )}
                    </div>
                    {price !== null && price > 0 && billing === "annual" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Billed annually (${price * 12}/yr)
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1 text-xs">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{plan.userLimit}</span>
                    </div>
                  </div>

                  <Link
                    to={plan.ctaTo}
                    className={`mb-6 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {plan.cta} {plan.highlight && <ArrowRight className="h-4 w-4" />}
                  </Link>

                  <div className="flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </div>
                    ))}
                    {plan.missing.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                        <X className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            All plans include SSL, Supabase-backed database, and automatic backups. No credit card required for Starter.
          </p>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20 bg-card/20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">Full feature comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 pl-5 pr-4 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground">Starter</th>
                  <th className="py-3 px-4 text-center font-medium text-primary">Growth</th>
                  <th className="py-3 pl-4 pr-5 text-center font-medium text-muted-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(({ category, rows }) => (
                  <React.Fragment key={category}>
                    <tr className="border-b border-border/50">
                      <td colSpan={4} className="bg-muted/20 py-2.5 pl-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {category}
                      </td>
                    </tr>
                    {rows.map(({ feature, starter, growth, enterprise }) => (
                      <tr key={feature} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                        <td className="py-3 pl-5 pr-4">{feature}</td>
                        <td className="py-3 px-4 text-center">
                          {starter ? <Check className="mx-auto h-4 w-4 text-success" /> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center bg-primary/3">
                          {growth ? <Check className="mx-auto h-4 w-4 text-success" /> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="py-3 pl-4 pr-5 text-center">
                          {enterprise ? <Check className="mx-auto h-4 w-4 text-success" /> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-accent/30 transition-colors"
                >
                  <span>{q}</span>
                  <HelpCircle className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "text-primary" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="border-t border-border/50 px-5 py-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-xl px-6 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Start free today
          </h2>
          <p className="mb-8 text-muted-foreground">
            No credit card required. Up and running in under 5 minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create your workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold">Nexus HQ</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            </nav>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nexus HQ. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
