import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  badge?: string;
}

const CHANGELOG: ChangelogEntry[] = [
  {
    id: "v0.9.0",
    date: "Jun 9, 2026",
    title: "Analytics & support chat",
    body: "Product analytics, in-app support via chat widget, and polished empty states across the app.",
    badge: "New",
  },
  {
    id: "v0.8.0",
    date: "Jun 9, 2026",
    title: "Observability & monitoring",
    body: "Real-time status page at /status, Sentry error tracking, and a health endpoint.",
    badge: "New",
  },
  {
    id: "v0.7.0",
    date: "Jun 9, 2026",
    title: "Invoices & billing",
    body: "Download VAT-compliant invoices. Payment failure alerts and subscription dunning.",
    badge: "New",
  },
  {
    id: "v0.6.0",
    date: "Jun 8, 2026",
    title: "Security hardening",
    body: "Two-factor authentication, GDPR data export & deletion, audit logs, and rate limiting.",
    badge: "Security",
  },
  {
    id: "v0.5.0",
    date: "May 2026",
    title: "GPS clock-in enforcement",
    body: "Enforce clock-ins from the office with a configurable radius. Set coordinates in Settings.",
  },
];

const STORAGE_KEY = "nexus_whats_new_last_id";
const LATEST_ID = CHANGELOG[0].id;

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    setHasNew(localStorage.getItem(STORAGE_KEY) !== LATEST_ID);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, LATEST_ID);
      setHasNew(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="What's new"
        >
          <Sparkles className="h-4 w-4" />
          {hasNew && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">What's new</h3>
          <p className="text-xs text-muted-foreground">Latest updates to Nexxos HQ</p>
        </div>
        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {CHANGELOG.map((entry) => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-foreground leading-snug">
                  {entry.title}
                </span>
                {entry.badge && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {entry.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{entry.body}</p>
              <span className="mt-1.5 block text-[10px] text-muted-foreground/50">{entry.date}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
