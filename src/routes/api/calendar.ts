import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";

// Token = base64url(userId) + "." + HMAC-SHA256(userId, secret)[0:32]
// Stateless — no DB column needed.

function makeToken(userId: string, secret: string): string {
  const encoded = Buffer.from(userId).toString("base64url");
  const sig = createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
  return `${encoded}.${sig}`;
}

export function verifyCalendarToken(token: string, secret: string): string | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let userId: string;
  try {
    userId = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
  if (expected.length !== sig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

// POST /api/calendar — returns the caller's personal iCal token + feed URL
export const Route = createFileRoute("/api/calendar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const secret = process.env.CALENDAR_SECRET;
        if (!secret) {
          return Response.json({ error: "Calendar feature not configured" }, { status: 503 });
        }

        const token = makeToken(user.id, secret);
        const origin = new URL(request.url).origin;
        return Response.json({ token, url: `${origin}/api/calendar/${token}.ics` });
      },
    },
  },
});
