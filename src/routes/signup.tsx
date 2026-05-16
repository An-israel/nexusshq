import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getLastWorkspaceSlug } from "@/lib/last-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap,
  Check,
  X,
  Loader2,
  Building2,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — Start Your Free Nexus HQ Workspace" },
      { name: "description", content: "Create your Nexus HQ workspace in minutes and start a 7-day free trial — no credit card required." },
      { property: "og:title", content: "Sign Up — Start Your Free Nexus HQ Workspace" },
      { property: "og:description", content: "Create a workspace and start a 7-day free trial — no credit card required." },
      { property: "og:url", content: "https://nexus.skryveai.com/signup" },
    ],
    links: [{ rel: "canonical", href: "https://nexus.skryveai.com/signup" }],
  }),
  component: SignupPage,
});

// ── Constants ────────────────────────────────────────────────────────────────

const COMPANY_SIZES = [
  { value: "1-5", label: "1–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "21-50", label: "21–50 people" },
  { value: "50+", label: "50+ people" },
] as const;

type PlanId = "starter" | "growth" | "business";

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  priceNote: string;
  seats: number | null;
  seatsLabel: string;
  features: string[];
  highlight: boolean;
  trial: string | null;
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    priceNote: "",
    seats: 5,
    seatsLabel: "5 seats",
    features: [
      "Attendance tracking",
      "Task management",
      "Direct messages",
      "Company handbook",
      "Org chart",
    ],
    highlight: false,
    trial: "Start 14-day free trial",
  },
  {
    id: "growth",
    name: "Growth",
    price: "₦49,000",
    priceNote: "/mo",
    seats: 25,
    seatsLabel: "25 seats",
    features: [
      "Everything in Starter",
      "AI intelligence (Claude AI)",
      "KPIs & OKRs",
      "Reports & analytics",
      "Client portal",
    ],
    highlight: true,
    trial: null,
  },
  {
    id: "business",
    name: "Business",
    price: "₦120,000",
    priceNote: "/mo",
    seats: null,
    seatsLabel: "Unlimited seats",
    features: [
      "Everything in Growth",
      "Custom branding",
      "SSO / SAML",
      "Dedicated onboarding",
      "SLA guarantee",
    ],
    highlight: false,
    trial: null,
  },
];

const PLAN_SEATS: Record<PlanId, number | null> = {
  starter: 5,
  growth: 25,
  business: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug) || /^[a-z0-9]{3,30}$/.test(slug);
}

// ── Main Page ────────────────────────────────────────────────────────────────

function SignupPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  // Redirect already-signed-in users to their workspace
  React.useEffect(() => {
    if (!session) return;
    void (async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", session.user.id)
        .eq("is_active", true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slugs = (data ?? []).map((m: any) => m?.workspaces?.slug).filter(Boolean) as string[];
      if (slugs.length > 1) {
        const last = getLastWorkspaceSlug();
        if (last && slugs.includes(last)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          navigate({ to: `/${last}/dashboard` as any });
          return;
        }
        navigate({ to: "/workspaces" });
        return;
      }
      const slug = slugs[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: slug ? `/${slug}/dashboard` as any : "/create-workspace" });
    })();
  }, [session, navigate]);

  const [step, setStep] = React.useState<1 | 2>(1);
  const [submitting, setSubmitting] = React.useState(false);

  // Step 1 fields
  const [companyName, setCompanyName] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [companySize, setCompanySize] = React.useState<string>("1-5");

  // Step 2 fields
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugChecking, setSlugChecking] = React.useState(false);
  const [slugAvailable, setSlugAvailable] = React.useState<boolean | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<PlanId>("starter");

  // Auto-populate slug from company name
  React.useEffect(() => {
    if (!slugTouched && companyName) {
      setSlug(slugify(companyName));
      setSlugAvailable(null);
    }
  }, [companyName, slugTouched]);

  // Debounced availability check
  React.useEffect(() => {
    if (!slug || !isValidSlug(slug)) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }
    setSlugChecking(true);
    setSlugAvailable(null);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setSlugChecking(false);
      if (error) {
        setSlugAvailable(null);
        return;
      }
      setSlugAvailable(data === null);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  function handleSlugChange(raw: string) {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);
    setSlug(cleaned);
    setSlugTouched(true);
    setSlugAvailable(null);
  }

  function validateStep1(): string | null {
    if (!companyName.trim()) return "Company name is required";
    if (!fullName.trim()) return "Your full name is required";
    if (!email.trim()) return "Work email is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    return null;
  }

  function goToStep2() {
    const err = validateStep1();
    if (err) { toast.error(err); return; }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidSlug(slug)) {
      toast.error("Workspace URL must be 3–30 lowercase letters, numbers, or hyphens");
      return;
    }
    if (slugAvailable === false) {
      toast.error("That workspace URL is already taken");
      return;
    }
    if (slugChecking) {
      toast.error("Still checking slug availability — please wait a moment");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (signUpError) throw signUpError;
      const user = signUpData.user;
      if (!user) throw new Error("Signup did not return a user");

      const now = new Date();
      const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // 2. Create workspace
      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({
          name: companyName.trim(),
          slug,
          plan: selectedPlan,
          plan_seats: PLAN_SEATS[selectedPlan],
        })
        .select("id")
        .single();

      if (wsError) throw wsError;

      // 3. Upsert profile (handle_new_user trigger may have already created it)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
          },
          { onConflict: "id" },
        );

      if (profileError) throw profileError;

      // 4. Add as workspace owner
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      // 5. Create subscription
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          workspace_id: workspace.id,
          plan: selectedPlan,
          status: selectedPlan === "starter" ? "trialing" : "active",
          current_period_start: now.toISOString(),
          current_period_end: thirtyDaysOut.toISOString(),
          ...(selectedPlan === "starter"
            ? { trial_ends_at: fourteenDaysOut.toISOString() }
            : {}),
        });

      if (subError) throw subError;

      toast.success("Workspace created! Let's get you set up…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void navigate({ to: `/${slug}/onboarding` as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandMark size="md" />
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center gap-3">
          <StepDot n={1} active={step === 1} done={step === 2} label="Company info" />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          <StepDot n={2} active={step === 2} done={false} label="Workspace setup" />
        </div>

        <div className="w-full max-w-xl">
          {step === 1 ? (
            <Step1
              companyName={companyName}
              setCompanyName={setCompanyName}
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              companySize={companySize}
              setCompanySize={setCompanySize}
              onNext={goToStep2}
            />
          ) : (
            <Step2
              slug={slug}
              onSlugChange={handleSlugChange}
              slugChecking={slugChecking}
              slugAvailable={slugAvailable}
              isValidSlug={isValidSlug(slug)}
              selectedPlan={selectedPlan}
              onPlanSelect={setSelectedPlan}
              submitting={submitting}
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have a workspace?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Step dot ────────────────────────────────────────────────────────────────

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
          done
            ? "bg-primary text-primary-foreground"
            : active
              ? "bg-primary/20 text-primary ring-2 ring-primary"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </div>
      <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

interface Step1Props {
  companyName: string;
  setCompanyName: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  companySize: string;
  setCompanySize: (v: string) => void;
  onNext: () => void;
}

function Step1({
  companyName,
  setCompanyName,
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  companySize,
  setCompanySize,
  onNext,
}: Step1Props) {
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tell us about your company and set up your account.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onNext(); }}
        className="space-y-5 rounded-2xl border border-border bg-card p-7 shadow-xl"
      >
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input
            id="company_name"
            type="text"
            autoComplete="organization"
            required
            placeholder="Acme Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="bg-input text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name">Your full name</Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            required
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="bg-input text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="work_email">Work email</Label>
          <Input
            id="work_email"
            type="email"
            autoComplete="email"
            required
            placeholder="jane@acme.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-input text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-input text-base md:text-sm"
          />
          {password.length > 0 && password.length < 8 && (
            <p className="text-xs text-destructive">Must be at least 8 characters</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_size">Company size</Label>
          <Select value={companySize} onValueChange={setCompanySize}>
            <SelectTrigger id="company_size" className="bg-input">
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

interface Step2Props {
  slug: string;
  onSlugChange: (v: string) => void;
  slugChecking: boolean;
  slugAvailable: boolean | null;
  isValidSlug: boolean;
  selectedPlan: PlanId;
  onPlanSelect: (p: PlanId) => void;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function Step2({
  slug,
  onSlugChange,
  slugChecking,
  slugAvailable,
  isValidSlug,
  selectedPlan,
  onPlanSelect,
  submitting,
  onBack,
  onSubmit,
}: Step2Props) {
  const slugStatus = (() => {
    if (!slug || !isValidSlug) return null;
    if (slugChecking) return "checking";
    if (slugAvailable === true) return "available";
    if (slugAvailable === false) return "taken";
    return null;
  })();

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Zap className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Set up your workspace</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose your workspace URL and pick a plan.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-8 rounded-2xl border border-border bg-card p-7 shadow-xl"
      >
        {/* Workspace URL */}
        <div className="space-y-3">
          <Label htmlFor="workspace_slug">Workspace URL</Label>
          <div className="flex items-center rounded-lg border border-border bg-input focus-within:ring-2 focus-within:ring-ring overflow-hidden">
            <span className="shrink-0 border-r border-border bg-muted/50 px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              nexus.skryveai.com/
            </span>
            <input
              id="workspace_slug"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {/* Availability indicator */}
            <div className="shrink-0 pr-3">
              {slugStatus === "checking" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {slugStatus === "available" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {slugStatus === "taken" && (
                <X className="h-4 w-4 text-destructive" />
              )}
            </div>
          </div>

          {/* Feedback text */}
          {slug && !isValidSlug && (
            <p className="text-xs text-muted-foreground">
              3–30 characters, lowercase letters, numbers and hyphens only
            </p>
          )}
          {slugStatus === "available" && (
            <p className="text-xs text-green-500 font-medium">Available!</p>
          )}
          {slugStatus === "taken" && (
            <p className="text-xs text-destructive font-medium">That URL is already taken</p>
          )}
        </div>

        {/* Plan selection */}
        <div className="space-y-3">
          <Label>Choose a plan</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan === plan.id}
                onSelect={() => onPlanSelect(plan.id)}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            type="submit"
            className="flex-1 gap-2"
            disabled={
              submitting ||
              !isValidSlug ||
              slugStatus === "taken" ||
              slugStatus === "checking"
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating workspace…
              </>
            ) : (
              <>
                Create workspace <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: (typeof PLANS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "border-primary bg-primary/8 shadow-sm shadow-primary/20"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent/30"
      }`}
    >
      {/* Selected check */}
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {plan.name}
      </p>

      <div className="mt-1.5 flex items-end gap-0.5">
        <span className={`text-xl font-extrabold ${selected ? "text-primary" : ""}`}>
          {plan.price}
        </span>
        {plan.priceNote && (
          <span className="mb-0.5 text-xs text-muted-foreground">{plan.priceNote}</span>
        )}
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">{plan.seatsLabel}</p>

      {plan.trial && (
        <Badge className="mt-2 w-fit bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0">
          {plan.trial}
        </Badge>
      )}

      <ul className="mt-3 space-y-1">
        {plan.features.slice(0, 3).map((f) => (
          <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Check className="h-3 w-3 shrink-0 text-green-500" />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}
