import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { installSupabaseDiagnostics } from "@/lib/supabase-diagnostics";

import appCss from "../styles.css?url";

// Document-level CSP, delivered via <meta http-equiv> since this is the only
// directive subset that can be expressed without a custom HTTP response layer.
// Clickjacking/MIME-sniffing/HSTS protections (X-Frame-Options,
// X-Content-Type-Options, Strict-Transport-Security) are sent as real response
// headers from src/server-entry.ts instead — meta tags can't deliver those.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ipapi.co https://open.er-api.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { httpEquiv: "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      {
        name: "google-site-verification",
        content: "a7Et3UPOwggV8QhWsn9Ia-4i38Ql1spAbuH2WqIBHG8",
      },
      { title: "Nexxos HQ — Unified Workspace for Team Operations" },
      {
        name: "description",
        content:
          "Nexxos HQ is the all-in-one workspace for team operations — attendance, tasks, standups, OKRs, KPIs and AI-powered insights for modern teams.",
      },
      { name: "robots", content: "index,follow" },
      { property: "og:site_name", content: "Nexxos HQ" },
      { name: "theme-color", content: "#0F0F0F" },
      { property: "og:title", content: "Nexxos HQ — Unified Workspace for Team Operations" },
      { name: "twitter:title", content: "Nexxos HQ — Unified Workspace for Team Operations" },
      {
        property: "og:description",
        content:
          "All-in-one workspace for attendance, tasks, standups, OKRs, KPIs and AI insights.",
      },
      {
        name: "twitter:description",
        content:
          "All-in-one workspace for attendance, tasks, standups, OKRs, KPIs and AI insights.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/afa32301-7082-4dd2-8c0e-9cf686ba64f7/id-preview-e4c67354--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app-1777587824959.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/afa32301-7082-4dd2-8c0e-9cf686ba64f7/id-preview-e4c67354--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app-1777587824959.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nexus.skryveai.com/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Nexxos HQ",
          url: "https://nexus.skryveai.com/",
          logo: "https://nexus.skryveai.com/icons/icon.svg",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Nexxos HQ",
          url: "https://nexus.skryveai.com/",
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    installSupabaseDiagnostics();

    if (typeof document !== "undefined") {
      document.body.setAttribute("data-app-hydrated", "true");
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  }, []);

  return (
    <AuthProvider>
      <main id="main">
        <Outlet />
      </main>
      <Toaster theme="dark" position="top-right" />
    </AuthProvider>
  );
}
