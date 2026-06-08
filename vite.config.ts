import path from "node:path";
import { loadEnv, defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteTsconfigPaths from "vite-tsconfig-paths";

// Load all env vars (no prefix) into process.env so server routes can access
// non-VITE_ secrets like SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  plugins: [
    tailwindcss(),
    viteTsconfigPaths(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
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
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
