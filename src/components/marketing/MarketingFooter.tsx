import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Zap, ChevronDown } from "lucide-react";
import nexxosGlyph from "@/assets/brand/nexxos-glyph-light.svg.asset.json";
import { openWhatsApp, comingSoon, WHATSAPP_URL } from "@/lib/marketing";

// ── Footer column data ────────────────────────────────────────────────────────

type FooterLink = {
  label: string;
  href: string;
  internal?: boolean;
  whatsapp?: boolean;
};

const COLUMNS: { id: string; title: string; links: FooterLink[] }[] = [
  {
    id: "product",
    title: "Product",
    links: [
      { label: "Watch Demo", href: WHATSAPP_URL, whatsapp: true },
      { label: "Pricing", href: "/pricing", internal: true },
      { label: "Free vs Paid", href: "/pricing", internal: true },
      { label: "What's New", href: comingSoon("whats-new") },
      { label: "Changelog", href: comingSoon("changelog") },
      { label: "System Status", href: comingSoon("system-status") },
      { label: "Accessibility", href: comingSoon("accessibility") },
    ],
  },
  {
    id: "features",
    title: "Features",
    links: [
      { label: "Task Management", href: comingSoon("task-management") },
      { label: "Attendance Tracking", href: comingSoon("attendance") },
      { label: "Performance Scoring", href: comingSoon("performance-tracking") },
      { label: "Payslips & HR", href: comingSoon("payslips-hr") },
      { label: "Team Messaging", href: comingSoon("team-messaging") },
      { label: "Deliverable Approvals", href: comingSoon("deliverable-approvals") },
      { label: "Client Portal", href: comingSoon("client-portal") },
      { label: "AI Features", href: comingSoon("ai-insights") },
    ],
  },
  {
    id: "solutions",
    title: "Solutions",
    links: [
      { label: "For Agencies", href: comingSoon("creative-agencies") },
      { label: "For Startups", href: comingSoon("startups") },
      { label: "For Operations Teams", href: comingSoon("operations-teams") },
      { label: "For Remote Teams", href: comingSoon("remote-teams") },
      { label: "For HR Managers", href: comingSoon("hr-professionals") },
      { label: "For CEOs & Founders", href: comingSoon("ceo-founders") },
      { label: "Enterprise", href: comingSoon("enterprise") },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    links: [
      { label: "Help Centre", href: comingSoon("help-centre") },
      { label: "Blog", href: comingSoon("blog") },
      { label: "API Documentation", href: comingSoon("api-docs") },
      { label: "Community", href: comingSoon("community") },
      { label: "Customer Stories", href: comingSoon("customer-stories") },
      { label: "Webinars", href: comingSoon("webinars") },
      { label: "Partner Programme", href: comingSoon("partner-programme") },
      { label: "Developers", href: comingSoon("developers") },
    ],
  },
  {
    id: "company",
    title: "Company",
    links: [
      { label: "About Us", href: comingSoon("about") },
      { label: "Careers", href: comingSoon("careers") },
      { label: "Press & Media", href: comingSoon("press") },
      { label: "Contact Us", href: WHATSAPP_URL, whatsapp: true },
      { label: "Brand Assets", href: comingSoon("brand") },
      { label: "Affiliate Programme", href: comingSoon("affiliates") },
      { label: "Terms of Service", href: "/terms", internal: true },
      { label: "Privacy Policy", href: "/privacy", internal: true },
      { label: "Cookie Policy", href: "/cookies", internal: true },
    ],
  },
];

// ── Language selector ─────────────────────────────────────────────────────────

function LanguageSelector() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[#1E1E1E] px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
      >
        <span>🌍</span>
        <span>English</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-40 bg-[#111111] border border-[#1E1E1E] rounded-xl shadow-2xl overflow-hidden">
          {["English", "Français", "Português"].map((label) => (
            <button
              key={label}
              className="block w-full text-left px-4 py-2.5 text-[13px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setOpen(false)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Social icons (inline SVG) ─────────────────────────────────────────────────

// TODO: replace href values with real social profile URLs
const SOCIALS = [
  {
    name: "X (Twitter)",
    href: comingSoon("twitter"),
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.252 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: comingSoon("linkedin"),
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: comingSoon("instagram"),
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: comingSoon("youtube"),
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    href: WHATSAPP_URL,
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    ),
  },
];

// ── Link renderer helper ──────────────────────────────────────────────────────

function FooterLinkItem({ link, className }: { link: FooterLink; className: string }) {
  if (link.internal) {
    return (
      <Link to={link.href as "/terms" | "/privacy" | "/cookies" | "/pricing"} className={className}>
        {link.label}
      </Link>
    );
  }
  if (link.whatsapp) {
    return (
      <button onClick={openWhatsApp} className={className}>
        {link.label}
      </button>
    );
  }
  return (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  );
}

// ── Accordion column (mobile) ─────────────────────────────────────────────────

interface AccordionColumnProps {
  column: (typeof COLUMNS)[number];
}

function AccordionColumn({ column }: AccordionColumnProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-[#1E1E1E]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400">
          {column.title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-4 space-y-2.5">
          {column.links.map((link) => (
            <FooterLinkItem
              key={link.label}
              link={link}
              className="block text-sm text-gray-500 hover:text-white transition-colors"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main MarketingFooter ──────────────────────────────────────────────────────

export function MarketingFooter() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-[#1E1E1E] pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6">
        {/* Desktop: 5-column grid */}
        <div className="hidden md:grid md:grid-cols-5 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.id}>
              <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem
                      link={link}
                      className="text-sm text-gray-500 hover:text-white transition-colors"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile: accordion */}
        <div className="md:hidden space-y-0">
          {COLUMNS.map((col) => (
            <AccordionColumn key={col.id} column={col} />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#1E1E1E] my-8" />

        {/* Bottom bar */}
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between flex-wrap gap-4">
          {/* Left: logo + copyright */}
          <div className="flex flex-col gap-1">
            <Link to="/" className="flex items-center gap-2">
              <img src={nexxosGlyph.url} alt="" className="h-5 w-5" />
              <span className="text-[13px] font-semibold text-white tracking-tight">Nexxos HQ</span>
            </Link>
            <p className="text-xs text-gray-500">© 2026 Nexxos HQ. All rights reserved.</p>
            <p className="text-xs text-gray-500">Built for African teams.</p>
          </div>

          {/* Center: language selector */}
          <LanguageSelector />

          {/* Right: social icons */}
          <div className="flex items-center gap-4">
            {SOCIALS.map(({ name, href, svg }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="text-gray-500 hover:text-white transition-colors"
              >
                {svg}
              </a>
            ))}
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden flex flex-col items-center gap-4 text-center">
          <Link to="/" className="flex items-center gap-2">
            <img src={nexxosGlyph.url} alt="" className="h-5 w-5" />
            <span className="text-[13px] font-semibold text-white tracking-tight">Nexxos HQ</span>
          </Link>
          <p className="text-xs text-gray-500">© 2026 Nexxos HQ. All rights reserved.</p>
          <p className="text-xs text-gray-500">Built for African teams.</p>
          <LanguageSelector />
          <div className="flex items-center gap-4">
            {SOCIALS.map(({ name, href, svg }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="text-gray-500 hover:text-white transition-colors"
              >
                {svg}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
