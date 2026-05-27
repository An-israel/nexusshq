/**
 * Vercel serverless function — handles all SSR and API requests.
 *
 * `vite build` compiles TanStack Start into:
 *   dist/client/   → static assets served by Vercel CDN
 *   dist/server/server.js → SSR handler (exports { default: { fetch } })
 *
 * This file wraps that fetch handler so Vercel can invoke it as a
 * Node.js serverless function. All page routes and /api/* routes pass
 * through here; Vercel serves static assets (JS, CSS, images) directly.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// Dynamically imported after build so TypeScript doesn't need to know the
// exact shape at compile time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _handler: ((req: Request) => Promise<Response>) | null = null;

async function getHandler() {
  if (!_handler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("../dist/server/server.js")) as any;
    _handler = mod.default.fetch as (req: Request) => Promise<Response>;
  }
  return _handler;
}

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appHandler = await getHandler();

  // Build the full URL from Vercel's forwarded headers
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string) || (req.headers.host as string) || "localhost";
  const url = `${protocol}://${host}${req.url ?? "/"}`;

  // Convert Node.js headers to web Headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  // Read request body for non-GET/HEAD requests
  let body: Buffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  // Call the TanStack Start fetch handler
  const request = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: body?.length ? body : undefined,
  });

  const response = await appHandler(request);

  // Forward status + headers
  res.status(response.status);
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }

  // Stream body back to the client
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
