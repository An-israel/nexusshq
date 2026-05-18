// Server-only helpers for WhatsApp/SMS notifications. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Sends a WhatsApp message via Africa's Talking API (or falls back to logging)
// Set WHATSAPP_API_KEY and WHATSAPP_USERNAME env vars to enable
export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const username = process.env.WHATSAPP_USERNAME ?? "sandbox";

  if (!apiKey) {
    // Log in dev mode — no API key configured
    console.log(`[WhatsApp] TO: ${phone} | MSG: ${message}`);
    return;
  }

  // Africa's Talking SMS API (widely used in Nigeria/Africa)
  const params = new URLSearchParams({
    username,
    to: phone,
    message,
    from: process.env.WHATSAPP_SENDER_ID ?? "NexusHQ",
  });

  const resp = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey: apiKey,
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    console.error("[WhatsApp] Failed:", await resp.text());
  }
}

// Send notification to user if they have WhatsApp opt-in
export async function notifyUserWhatsApp(userId: string, message: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone, whatsapp_opt_in, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.whatsapp_opt_in || !profile?.phone) return;

  const phone = profile.phone.startsWith("+")
    ? profile.phone
    : `+234${profile.phone.replace(/^0/, "")}`;
  await sendWhatsAppMessage(phone, message);
}
