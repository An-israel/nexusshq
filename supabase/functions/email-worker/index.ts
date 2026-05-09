import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Processes the transactional_emails pgmq queue and delivers via Resend.
// Scheduled via Supabase cron every minute: * * * * *

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") ?? "Nexus HQ <noreply@nexushq.io>";
const QUEUE_NAME = "transactional_emails";
const BATCH_SIZE = 10;
// Visibility timeout: 60s — message reappears in queue if not deleted within this window
const VT_SECONDS = 60;

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: EmailPayload;
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

Deno.serve(async (_req) => {
  try {
    const { data: messages, error: readErr } = await supabase.rpc("read_email_batch", {
      queue_name: QUEUE_NAME,
      batch_size: BATCH_SIZE,
      vt: VT_SECONDS,
    }) as { data: QueueMessage[] | null; error: unknown };

    if (readErr) {
      console.error("Failed to read queue:", readErr);
      return new Response(JSON.stringify({ error: String(readErr) }), { status: 500 });
    }

    const batch = messages ?? [];
    const results = { sent: 0, failed: 0, dlq: 0 };

    for (const msg of batch) {
      const payload = msg.message;

      // Guard: skip messages that have been retried too many times
      if (msg.read_ct > 5) {
        console.warn(`msg ${msg.msg_id} exceeded retry limit (read_ct=${msg.read_ct}), moving to DLQ`);
        await supabase.rpc("move_to_dlq", { queue_name: QUEUE_NAME, msg_id: msg.msg_id }).catch(() => {});
        results.dlq++;
        continue;
      }

      try {
        await sendViaResend(payload);
        await supabase.rpc("delete_email", { queue_name: QUEUE_NAME, msg_id: msg.msg_id });
        results.sent++;
        console.log(`Sent email to ${payload.to} (msg ${msg.msg_id})`);
      } catch (err) {
        console.error(`Failed to send msg ${msg.msg_id} to ${payload.to}:`, err);
        // Message stays in queue (visibility timeout expires) for automatic retry.
        // After read_ct > 5 it will be moved to DLQ on next run.
        results.failed++;
      }
    }

    console.log("Email worker complete:", results);
    return new Response(JSON.stringify({ ok: true, processed: batch.length, ...results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
