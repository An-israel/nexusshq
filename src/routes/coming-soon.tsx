import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ArrowLeft, Sparkles } from "lucide-react";

const searchSchema = z.object({
  page: z.string().optional(),
});

export const Route = createFileRoute("/coming-soon")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Coming Soon — Nexxos HQ" }],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  const { page } = Route.useSearch();
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  const pageName = page
    ? page.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("waitlist_emails").insert({
      email: email.trim().toLowerCase(),
      page: page ?? null,
    });

    if (error) {
      if (error.code === "23505") {
        // Unique violation — already on the list
        setStatus("success");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      }
      return;
    }

    setStatus("success");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-white flex flex-col items-center justify-center px-6">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.62 0.19 259) 0%, transparent 70%)",
            animation: "pulse 6s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.72 0.16 162) 0%, transparent 70%)",
            animation: "pulse 8s ease-in-out infinite 2s",
          }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
          50% { transform: translateX(-50%) scale(1.08); opacity: 0.28; }
        }
      `}</style>

      {/* Back link */}
      <div className="absolute top-6 left-6">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>

      {/* Logo */}
      <div className="relative flex flex-col items-center text-center max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight">Nexxos HQ</span>
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] text-gray-400 backdrop-blur">
          <Sparkles className="h-3 w-3 text-blue-400" />
          {pageName ? `${pageName} is coming soon` : "This feature is coming soon"}
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          We&apos;re building
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #60a5fa 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            something great
          </span>
        </h1>

        <p className="mb-10 text-[15px] leading-relaxed text-gray-400">
          {pageName
            ? `${pageName} is under active development. Drop your email and we'll notify you the moment it's ready.`
            : "This page is under active development. Drop your email and we'll notify you the moment it's ready."}
        </p>

        {status === "success" ? (
          <div className="w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-8 text-center">
            <div className="mb-3 text-3xl">🎉</div>
            <p className="text-base font-semibold text-green-400">You're on the list!</p>
            <p className="mt-1 text-[13px] text-gray-400">
              We'll email you as soon as this is ready.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:bg-white/8 transition-colors"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-6 py-3 text-[14px] font-medium text-white transition-colors"
              >
                {status === "loading" ? "Joining…" : "Notify me"}
              </button>
            </div>
            {status === "error" && <p className="mt-2 text-[13px] text-red-400">{errorMsg}</p>}
            <p className="mt-3 text-[11px] text-gray-600">No spam. Unsubscribe any time.</p>
          </form>
        )}

        <div className="mt-12 flex items-center gap-4 text-[13px] text-gray-500">
          <Link to="/pricing" className="hover:text-white transition-colors">
            View pricing
          </Link>
          <span className="h-1 w-1 rounded-full bg-gray-700" />
          <Link to="/login" className="hover:text-white transition-colors">
            Sign in
          </Link>
          <span className="h-1 w-1 rounded-full bg-gray-700" />
          <Link to="/signup" className="hover:text-white transition-colors">
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
