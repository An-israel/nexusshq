import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function requireAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Self-signup requires SUPABASE_SERVICE_ROLE_KEY. Add it to Lovable Secrets, or ask your admin to invite you instead.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function createConfirmedUser(input: {
  email: string;
  password: string;
  full_name: string;
}) {
  const admin = requireAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      throw new Error("An account with this email already exists.");
    }
    throw new Error(error.message);
  }
}
