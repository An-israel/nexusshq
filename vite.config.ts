import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Load all env vars (no prefix) into process.env so server routes can access
// non-VITE_ secrets like SUPABASE_SERVICE_ROLE_KEY.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  // Point TanStack Start at our custom Cloudflare Worker entry so security
  // headers get stamped on every response (the default entry has no hook for
  // this; src/server-entry.ts wraps the default stream handler).
  tanstackStart: {
    server: { entry: "./server-entry" },
  },
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
