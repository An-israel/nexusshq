import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";

const startFetch = createStartHandler(defaultStreamHandler);

// Security headers that browsers only honor when sent as real HTTP response
// headers (a <meta http-equiv> in the document <head> can't deliver these).
// Applied to every response from the Worker, including HTML, assets and API routes.
const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["X-Frame-Options", "SAMEORIGIN"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
];

export default createServerEntry({
  fetch: async (request, opts) => {
    const response = await startFetch(request, opts);
    const headers = new Headers(response.headers);
    for (const [name, value] of SECURITY_HEADERS) {
      if (!headers.has(name)) headers.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
