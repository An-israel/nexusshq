import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";

interface HealthData {
  status: "ok" | "degraded";
  services: { database: "ok" | "error" };
  latency_ms: number;
  timestamp: string;
}

export const Route = createFileRoute("/status")({
  component: StatusPage,
});

function StatusIndicator({ status }: { status: "ok" | "error" | "loading" }) {
  if (status === "loading") {
    return (
      <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40 animate-pulse" />
    );
  }
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${status === "ok" ? "bg-green-500" : "bg-red-500"}`}
    />
  );
}

function StatusRow({ label, status }: { label: string; status: "ok" | "error" | "loading" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <StatusIndicator status={status} />
        <span className="text-xs text-muted-foreground capitalize">
          {status === "loading" ? "Checking…" : status === "ok" ? "Operational" : "Degraded"}
        </span>
      </div>
    </div>
  );
}

function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data: HealthData = await res.json();
      setHealth(data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    void checkHealth();
    const interval = setInterval(() => void checkHealth(), 30_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const overallOk = !fetchError && health?.status === "ok";
  const dbStatus = fetchError ? "error" : health ? health.services.database : "loading";
  const apiStatus: "ok" | "error" | "loading" = fetchError ? "error" : health ? "ok" : "loading";

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-16">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-foreground">Nexxos HQ Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time system health for all services
          </p>
        </div>

        {/* Overall banner */}
        <div
          className={`mb-8 rounded-xl border px-6 py-5 text-center ${
            health === null && !fetchError
              ? "border-border bg-card"
              : overallOk
                ? "border-green-500/30 bg-green-500/10"
                : "border-red-500/30 bg-red-500/10"
          }`}
        >
          {health === null && !fetchError ? (
            <p className="text-sm text-muted-foreground">Checking system status…</p>
          ) : overallOk ? (
            <>
              <p className="text-lg font-semibold text-green-400">All systems operational</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Response time: {health?.latency_ms ?? "—"}ms
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-red-400">Service disruption detected</p>
          )}
        </div>

        {/* Service rows */}
        <div className="space-y-3">
          <StatusRow label="API" status={apiStatus} />
          <StatusRow label="Database" status={dbStatus} />
        </div>

        {/* Last checked */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {lastChecked
            ? `Last checked ${lastChecked.toLocaleTimeString()} · auto-refreshes every 30s`
            : "Checking…"}
        </p>
      </div>
    </div>
  );
}
