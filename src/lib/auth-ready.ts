import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForVerifiedUser({
  attempts = 8,
  delayMs = 250,
}: {
  attempts?: number;
  delayMs?: number;
} = {}): Promise<User | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) return user;

    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }

  return null;
}
