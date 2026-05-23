import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight, HelpCircle, Users, Headphones, Star } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

const FAQ_DATA = [
  {
    q: "Is there a free trial?",
    a: "Yes — every plan includes a 7-day free trial with no credit card required. You get full access to all features during the trial.",
  },
  {
    q: "What happens after the trial ends?",
    a: "You'll be prompted to choose a plan. Your data is safe — nothing is deleted. You can also contact us to extend the trial.",
  },
  {
    q: "Do all plans include the same features?",
    a: "Yes. Every plan includes all features. The only differences are the number of seats and the level of support you receive.",
  },
  {
    q: "How does the 30% annual discount work?",
    a: "Choose annual billing and pay upfront for 12 months at 30% off the monthly rate. You can switch back to monthly at renewal.",
  },
  {
    q: "What if my team grows beyond the seat limit?",
    a: "We'll notify you when you're close. You can upgrade to the next plan at any time — existing data is never lost.",
  },
  {
    q: "What does 'dedicated account manager' mean?",
    a: "Unlimited plan customers get a named contact at Nexxos HQ for onboarding, training, and ongoing support via phone or WhatsApp.",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Nexxos HQ Plans for Every Team Size" },
      {
        name: "description",
        content:
          "Transparent Nexxos HQ pricing: Basic, Enterprise and Unlimited plans with a 7-day free trial and 30% annual discount.",
      },
      { property: "og:title", content: "Pricing — Nexxos HQ Plans for Every Team Size" },
      {
        property: "og:description",
        content: "Transparent plans with a 7-day free trial and 30% annual discount.",
      },
      { property: "og:url", content: "https://nexus.skryveai.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://nexus.skryveai.com/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_DATA.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

type Billing = "monthly" | "annual";

const MONTHLY_PRICES = { basic: 15000, enterprise: 25000, unlimited: 45000 };
const DISCOUNT = 0.3;

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    seats: 7,
    seatLabel: "Up to 7 members",
    support: "Email support",
    supportIcon: Headphones,
    highlight: false,
    badge: null,
    cta: "Start 7-day free trial",
    colorClass: "text-muted-foreground",
    accentClass: "border-border",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    seats: 15,
    seatLabel: "Up to 15 members",
    support: "Priority support",
    supportIcon: Star,
    highlight: true,
    badge: "Most popular",
    cta: "Start 7-day free trial",
    colorClass: "text-primary",
    accentClass: "border-primary",
  },
  {
    id: "unlimited",
    name: "Unlimited",
    seats: null,
    seatLabel: "Unlimited members",
    support: "Dedicated account manager",
    supportIcon: Headphones,
    highlight: false,
    badge: null,
    cta: "Start 7-day free trial",
    colorClass: "text-amber-400",
    accentClass: "border-amber-500/60",
  },
] as const;

const ALL_FEATURES = [
  "Task management & assignment",
  "Attendance tracking & clock-in",
  "Daily standups",
  "Leave management",
  "Performance reviews",
  "Payslip management",
  "Team messaging & channels",
  "Company handbook",
  "Org chart",
  "Goals & OKRs",
  "KPIs dashboard",
  "Reports & analytics",
  "AI weekly task generator",
  "Client project tracking",
  "Recurring task automation",
  "Deliverable submissions & scoring",
  "Role-based access control",
  "Mobile app (PWA)",
  "In-app notifications",
];

const FAQ = FAQ_DATA;

function fmt(n: number): string {
  return "₦" + n.toLocaleString("en-NG");
}

function PricingPage() {
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mb-2 text-lg text-muted-foreground">
            Every plan includes every feature. Pay only for the seats you need.
          </p>
          <p className="mb-8 text-sm text-muted-foreground">
            7-day free trial on all plans · No credit card required
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                billing === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  billing === "annual"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-green-500/15 text-green-500"
                }`}
              >
                –30%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const monthly = MONTHLY_PRICES[plan.id];
              const price = billing === "annual" ? Math.round(monthly * (1 - DISCOUNT)) : monthly;
              const SupportIcon = plan.supportIcon;

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
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${plan.colorClass}`}
                    >
                      {plan.name}
                    </p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-3xl font-extrabold">{fmt(price)}</span>
                      <span className="mb-1 text-sm text-muted-foreground">/ mo</span>
                    </div>
                    {billing === "annual" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmt(price * 12)} billed annually
                        <span className="ml-1.5 font-medium text-green-500">
                          (save {fmt(monthly * 12 - price * 12)}/yr)
                        </span>
                      </p>
                    )}

                    {/* Seat count */}
                    <div className="mt-3 flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{plan.seatLabel}</span>
                    </div>

                    {/* Support level */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                      <SupportIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{plan.support}</span>
                    </div>
                  </div>

                  <a
                    href={`/signup?plan=${plan.id}&billing=${billing}`}
                    className={`mb-6 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {plan.cta} {plan.highlight && <ArrowRight className="h-4 w-4" />}
                  </a>

                  {/* All features included */}
                  <div className="flex-1">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      All features included
                    </p>
                    <div className="space-y-2">
                      {ALL_FEATURES.map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prices in Nigerian Naira (₦). All plans include SSL, automatic backups, and a 7-day free
            trial.
          </p>
        </div>
      </section>

      {/* ── Support comparison ────────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-card/20 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight">
            What's different between plans?
          </h2>
          <p className="mb-10 text-center text-sm text-muted-foreground">
            Every plan unlocks every feature. The only differences are team size and support.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 pl-5 pr-4 text-left font-medium text-muted-foreground"></th>
                  <th className="px-4 py-3 text-center font-semibold">Basic</th>
                  <th className="px-4 py-3 text-center font-semibold text-primary">Enterprise</th>
                  <th className="py-3 pl-4 pr-5 text-center font-semibold text-amber-400">
                    Unlimited
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Monthly price",
                    basic: "₦15,000",
                    enterprise: "₦25,000",
                    unlimited: "₦45,000",
                  },
                  {
                    label: "Annual price (per mo)",
                    basic: "₦10,500",
                    enterprise: "₦17,500",
                    unlimited: "₦31,500",
                  },
                  {
                    label: "Team members",
                    basic: "Up to 7",
                    enterprise: "Up to 15",
                    unlimited: "Unlimited",
                  },
                  { label: "All features", basic: "✓", enterprise: "✓", unlimited: "✓" },
                  {
                    label: "Support",
                    basic: "Email",
                    enterprise: "Priority",
                    unlimited: "Dedicated manager",
                  },
                  {
                    label: "Free trial",
                    basic: "7 days",
                    enterprise: "7 days",
                    unlimited: "7 days",
                  },
                ].map(({ label, basic, enterprise, unlimited }) => (
                  <tr
                    key={label}
                    className="border-b border-border/30 transition-colors hover:bg-accent/20"
                  >
                    <td className="py-3 pl-5 pr-4 font-medium">{label}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{basic}</td>
                    <td className="bg-primary/3 px-4 py-3 text-center">{enterprise}</td>
                    <td className="py-3 pl-4 pr-5 text-center text-muted-foreground">
                      {unlimited}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-accent/30"
                >
                  <span>{q}</span>
                  <HelpCircle
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      openFaq === i ? "text-primary" : ""
                    }`}
                  />
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
      <section className="relative overflow-hidden border-t border-border/40 py-20">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-xl px-6 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Try Nexxos HQ free for 7 days
          </h2>
          <p className="mb-8 text-muted-foreground">
            No credit card required. Full access to every feature. Cancel any time.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start your free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
