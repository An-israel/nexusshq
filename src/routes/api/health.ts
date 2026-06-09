import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        let dbStatus: "ok" | "error" = "ok";

        try {
          const { error } = await supabaseAdmin
            .from("workspaces")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) dbStatus = "error";
        } catch {
          dbStatus = "error";
        }

        const latency_ms = Date.now() - start;
        const status = dbStatus === "ok" ? "ok" : "degraded";

        return Response.json(
          {
            status,
            services: { database: dbStatus },
            latency_ms,
            timestamp: new Date().toISOString(),
          },
          { status: status === "ok" ? 200 : 503 },
        );
      },
    },
  },
});
