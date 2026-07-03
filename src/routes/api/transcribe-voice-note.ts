import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiUser } from "@/server/api-auth.server";
import { checkRateLimit, clientKey, tooManyRequests } from "@/server/rate-limit.server";

// Server-side handler: downloads the voice note from Supabase Storage and
// sends it to OpenAI Whisper for transcription. OPENAI_API_KEY must be set
// in the server environment — never expose it client-side.
export const Route = createFileRoute("/api/transcribe-voice-note")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const rl = checkRateLimit(clientKey(request, "transcribe", user.id), 20, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

        const apiKey = process.env.OPENAI_API_KEY ?? "";
        if (!apiKey) {
          return Response.json(
            { error: "OPENAI_API_KEY is not configured in server environment variables." },
            { status: 500 },
          );
        }

        let body: { voiceNoteId: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { voiceNoteId } = body;
        if (!voiceNoteId) {
          return Response.json({ error: "voiceNoteId is required" }, { status: 400 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: vnRow } = await (supabaseAdmin as any)
          .from("voice_notes")
          .select("storage_path")
          .eq("id", voiceNoteId)
          .single();

        if (!vnRow?.storage_path) {
          return Response.json({ error: "Voice note not found" }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: signedData } = await (supabaseAdmin as any).storage
          .from("voice-notes")
          .createSignedUrl(vnRow.storage_path, 120);

        if (!signedData?.signedUrl) {
          return Response.json({ error: "Failed to generate signed URL" }, { status: 500 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
          .from("voice_notes")
          .update({ transcription_status: "processing" })
          .eq("id", voiceNoteId);

        try {
          const audioResp = await fetch(signedData.signedUrl);
          if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);
          const audioBuffer = await audioResp.arrayBuffer();

          const ext = vnRow.storage_path.split(".").pop()?.split("?")[0] ?? "webm";
          const mimeMap: Record<string, string> = {
            webm: "audio/webm",
            ogg: "audio/ogg",
            mp4: "audio/mp4",
            wav: "audio/wav",
            mp3: "audio/mpeg",
          };
          const mimeType = mimeMap[ext] ?? "audio/webm";

          const formData = new FormData();
          formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
          formData.append("model", "whisper-1");

          const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          });

          if (!whisperResp.ok) {
            const errText = await whisperResp.text();
            throw new Error(`Whisper API error ${whisperResp.status}: ${errText}`);
          }

          const whisperData = (await whisperResp.json()) as { text?: string };
          const transcription = whisperData.text ?? "";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseAdmin as any)
            .from("voice_notes")
            .update({ transcription, transcription_status: "completed" })
            .eq("id", voiceNoteId);

          return Response.json({ ok: true, transcription });
        } catch (err) {
          console.error("transcribe-voice-note error:", err);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseAdmin as any)
            .from("voice_notes")
            .update({ transcription_status: "failed" })
            .eq("id", voiceNoteId);
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
