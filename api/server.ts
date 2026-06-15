/**
 * Vercel serverless function — handles all SSR and API requests.
 *
 * `vite build` compiles TanStack Start into:
 *   dist/client/             → static assets served by Vercel CDN
 *   dist/server/server-entry.js → SSR handler (default export = { fetch })
 *
 * This file wraps that fetch handler so Vercel can invoke it as a
 * Node.js serverless function. All page routes and /api/* routes pass
 * through here; Vercel serves static assets (JS, CSS, images) directly.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

// Vercel's Node serverless request/response extend Node's http primitives.
// We type them locally so this file does not depend on `@vercel/node` being
// installed (it isn't a project dependency, and Vercel type-checks this file).
type VercelRequest = IncomingMessage;
type VercelResponse = ServerResponse & {
  status: (statusCode: number) => VercelResponse;
};

// The compiled SSR entry only exists after `vite build`, so it can't be
// resolved at type-check time. Using a non-literal specifier keeps TypeScript
// from trying to resolve the module statically; Vercel includes the real file
// via `includeFiles` in vercel.json, so the relative import resolves at runtime.
const SERVER_ENTRY = "../dist/server/server-entry.js";

let _handler: ((req: Request) => Promise<Response>) | null = null;

async function getHandler(): Promise<(req: Request) => Promise<Response>> {
  if (!_handler) {
    const mod = (await import(SERVER_ENTRY)) as {
      default: { fetch: (req: Request) => Promise<Response> };
    };
    _handler = mod.default.fetch;
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
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // Read request body for non-GET/HEAD requests. A Buffer/Uint8Array is a valid
  // fetch body at runtime; the cast just bridges Node's Buffer generic to the
  // DOM `BodyInit` type Vercel type-checks against.
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buffer = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
    if (buffer.length > 0) body = new Uint8Array(buffer) as unknown as BodyInit;
  }

  // Call the TanStack Start fetch handler
  const request = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body,
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
