import * as React from "react";
import { Link } from "@tanstack/react-router";
import nexxosGlyph from "@/assets/brand/nexxos-glyph-light.svg.asset.json";
import {
  Zap,
  ChevronDown,
  Menu,
  X,
  CheckSquare,
  Clock,
  BarChart3,
  FileText,
  UserCheck,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  Building2,
  Rocket,
  Globe,
  Settings,
} from "lucide-react";
import { comingSoon, DEMO_MAILTO_URL } from "@/lib/marketing";

// ── Product mega-dropdown data ───────────────────────────────────────────────

const FEATURES_LIST = [
  {
    icon: CheckSquare,
    label: "Task Management",
    desc: "Assign, track, and complete tasks daily",
    href: comingSoon("task-management"),
  },
  {
    icon: Clock,
    label: "Attendance & Clock In",
    desc: "One-tap clock-in with real-time status",
    href: comingSoon("attendance"),
  },
  {
    icon: BarChart3,
    label: "Performance Tracking",
    desc: "KPIs, OKRs and review scoring",
    href: comingSoon("performance-tracking"),
  },
  {
    icon: FileText,
    label: "Payslips & HR",
    desc: "Manage payslips and HR records in one place",
    href: comingSoon("payslips-hr"),
  },
  {
    icon: UserCheck,
    label: "Employee Onboarding",
    desc: "Structured onboarding flows for new hires",
    href: comingSoon("employee-onboarding"),
  },
  {
    icon: MessageSquare,
    label: "Team Messaging",
    desc: "Channels, DMs and @mentions built in",
    href: comingSoon("team-messaging"),
  },
  {
    icon: ThumbsUp,
    label: "Deliverable Approvals",
    desc: "Submit and score work deliverables",
    href: comingSoon("deliverable-approvals"),
  },
  {
    icon: Sparkles,
    label: "AI Insights",
    desc: "Claude AI detects burnout and generates tasks",
    href: comingSoon("ai-insights"),
  },
];

const USE_CASES_LIST = [
  {
    icon: Building2,
    label: "Creative Agencies",
    desc: "Manage client work and creative teams",
    href: comingSoon("creative-agencies"),
  },
  {
    icon: Rocket,
    label: "Startups & SMEs",
    desc: "Move fast without losing accountability",
    href: comingSoon("startups"),
  },
  {
    icon: Globe,
    label: "Remote Teams",
    desc: "Keep distributed teams aligned daily",
    href: comingSoon("remote-teams"),
  },
  {
    icon: Settings,
    label: "Operations Teams",
    desc: "Streamline workflows and approvals",
    href: comingSoon("operations-teams"),
  },
];

// ── Solutions dropdown data ──────────────────────────────────────────────────

const BY_ROLE = [
  { label: "CEO & Founders", href: comingSoon("ceo-founders") },
  { label: "Operations Managers", href: comingSoon("operations-managers") },
  { label: "Team Leads & Managers", href: comingSoon("team-leads") },
  { label: "HR Professionals", href: comingSoon("hr-professionals") },
];

const BY_INDUSTRY = [
  { label: "Digital Agencies", href: comingSoon("digital-agencies") },
  { label: "Tech Startups", href: comingSoon("tech-startups") },
  { label: "Consulting Firms", href: comingSoon("consulting-firms") },
  { label: "Media & Content", href: comingSoon("media-content") },
];

// ── Resources dropdown data ──────────────────────────────────────────────────

const RESOURCES_LIST = [
  { label: "Blog", href: "/blog", disabled: false },
  { label: "Help Centre", href: "/help-centre", disabled: false },
  { label: "Changelog", href: "/changelog", disabled: false },
  { label: "API Docs", href: comingSoon("api-docs"), disabled: true, badge: "Coming soon" },
  { label: "System Status", href: "/system-status", disabled: false },
];

// ── Nav item with hover dropdown ─────────────────────────────────────────────

interface NavItemProps {
  label: string;
  children: React.ReactNode;
}

function NavItem({ label, children }: NavItemProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 80);
  }

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-white transition-colors py-2"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Invisible bridge so mouse can move from button to dropdown */}
      {open && <div className="absolute left-0 top-full h-2 w-full" />}

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2">
          {/* Top arrow */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-0 w-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-[#1E1E1E]" />
          {children}
        </div>
      )}
    </div>
  );
}

// ── Product mega dropdown ─────────────────────────────────────────────────────

function ProductDropdown() {
  return (
    <div className="w-[640px] bg-[#111111] border border-[#1E1E1E] rounded-xl shadow-2xl p-6">
      <div className="grid grid-cols-2 gap-8">
        {/* Features column */}
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400 mb-3">
            Features
          </p>
          <div className="space-y-1">
            {FEATURES_LIST.map(({ icon: Icon, label, desc, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors group"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-gray-400 group-hover:text-blue-400 transition-colors">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white/90 leading-tight">{label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Use Cases column */}
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400 mb-3">
            Use Cases
          </p>
          <div className="space-y-1">
            {USE_CASES_LIST.map(({ icon: Icon, label, desc, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors group"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-gray-400 group-hover:text-blue-400 transition-colors">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white/90 leading-tight">{label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Solutions dropdown ────────────────────────────────────────────────────────

function SolutionsDropdown() {
  return (
    <div className="w-72 bg-[#111111] border border-[#1E1E1E] rounded-xl shadow-2xl p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400 mb-2">
          By Role
        </p>
        <div className="space-y-0.5">
          {BY_ROLE.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-[#1E1E1E] pt-4">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400 mb-2">
          By Industry
        </p>
        <div className="space-y-0.5">
          {BY_INDUSTRY.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Resources dropdown ────────────────────────────────────────────────────────

function ResourcesDropdown() {
  return (
    <div className="w-56 bg-[#111111] border border-[#1E1E1E] rounded-xl shadow-2xl p-3">
      <div className="space-y-0.5">
        {RESOURCES_LIST.map(({ label, href, disabled, badge }) => (
          <a
            key={label}
            href={disabled ? undefined : href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors ${
              disabled
                ? "text-gray-600 cursor-default"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {label}
            {badge && (
              <span className="ml-2 rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-400">
                {badge}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main MarketingNav ─────────────────────────────────────────────────────────

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY >= 60);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  React.useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-[#0A0A0A] border-b border-[#1E1E1E]"
            : "bg-transparent border-b border-transparent"
        }`}
        style={{ height: 64 }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          {/* LEFT: Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={nexxosGlyph.url} alt="" className="h-7 w-7" />
            <span className="text-[15px] font-semibold text-white tracking-tight">Nexxos HQ</span>
          </Link>

          {/* CENTER: Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem label="Product">
              <ProductDropdown />
            </NavItem>
            <NavItem label="Solutions">
              <SolutionsDropdown />
            </NavItem>
            <Link
              to="/pricing"
              className="px-3 py-2 text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <NavItem label="Resources">
              <ResourcesDropdown />
            </NavItem>
          </nav>

          {/* RIGHT: CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <a
              href={DEMO_MAILTO_URL}
              className="rounded-lg border border-white/20 px-4 py-1.5 text-[13px] text-white hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              Request a Demo
            </a>
            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-[13px] font-medium text-white transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* MOBILE: Get Started + Hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile overlay menu ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
            <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
              <img src={nexxosGlyph.url} alt="" className="h-7 w-7" />
              <span className="text-[15px] font-semibold text-white tracking-tight">Nexxos HQ</span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 px-6 py-6 space-y-1">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-500 mb-3">
              Product
            </p>
            {FEATURES_LIST.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="block py-2.5 text-[15px] text-gray-300 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </a>
            ))}

            <div className="pt-4 pb-1 border-t border-[#1E1E1E] mt-4">
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-500 mb-3">
                Solutions
              </p>
              {[...BY_ROLE, ...BY_INDUSTRY].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block py-2.5 text-[15px] text-gray-300 hover:text-white transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="pt-4 pb-1 border-t border-[#1E1E1E] mt-4">
              <Link
                to="/pricing"
                className="block py-2.5 text-[15px] text-gray-300 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
              {RESOURCES_LIST.map(({ label, href, disabled }) => (
                <a
                  key={label}
                  href={disabled ? undefined : href}
                  className={`block py-2.5 text-[15px] transition-colors ${
                    disabled ? "text-gray-600" : "text-gray-300 hover:text-white"
                  }`}
                  onClick={disabled ? undefined : () => setMobileOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <div className="border-t border-[#1E1E1E] px-6 py-6 space-y-3">
            <a
              href={DEMO_MAILTO_URL}
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center rounded-lg border border-white/20 py-2.5 text-[14px] text-white hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              Request a Demo
            </a>
            <Link
              to="/login"
              className="block w-full text-center rounded-lg border border-[#1E1E1E] py-2.5 text-[14px] text-gray-300 hover:text-white hover:border-white/20 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="block w-full text-center rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-[14px] font-medium text-white transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
