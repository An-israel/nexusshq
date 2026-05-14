#!/usr/bin/env node
/**
 * Tenant-isolation smoke test.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_PUBLISHABLE_KEY=... \
 *   node scripts/test-tenant-isolation.mjs
 *
 * Creates two throwaway users in two separate workspaces, signs in as each,
 * and verifies they cannot read or write data belonging to the other workspace.
 * Exits non-zero on any leak. Cleans up everything on success.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!URL || !SERVICE || !PUB) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const failures = [];
const cleanup = { users: [], workspaces: [] };

function fail(msg) { failures.push(msg); console.error("✗ " + msg); }
function ok(msg) { console.log("✓ " + msg); }

async function makeUser(label) {
  const email = `iso-${label}-${stamp}@example.test`;
  const password = "TestPassword!" + stamp;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.users.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function makeWorkspace(slug, ownerId) {
  const { data: ws, error } = await admin.from("workspaces").insert({ name: slug, slug, plan: "business" }).select("id, slug").single();
  if (error) throw error;
  cleanup.workspaces.push(ws.id);
  await admin.from("profiles").upsert({ id: ownerId, full_name: slug, email: `iso-${slug}@example.test` });
  await admin.from("workspace_members").insert({ workspace_id: ws.id, user_id: ownerId, role: "owner", is_active: true });
  return ws;
}

async function asUser(email, password) {
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

try {
  console.log("Setting up two tenants...");
  const userA = await makeUser("a");
  const userB = await makeUser("b");
  const wsA = await makeWorkspace(`iso-a-${stamp}`, userA.id);
  const wsB = await makeWorkspace(`iso-b-${stamp}`, userB.id);

  // Seed channels in each
  const { data: chA } = await admin.from("channels").insert({ workspace_id: wsA.id, name: "general-a", type: "public", created_by: userA.id }).select().single();
  const { data: chB } = await admin.from("channels").insert({ workspace_id: wsB.id, name: "general-b", type: "public", created_by: userB.id }).select().single();

  const cA = await asUser(userA.email, userA.password);
  const cB = await asUser(userB.email, userB.password);

  // 1. Workspaces visibility
  const { data: wsListA } = await cA.from("workspaces").select("id");
  if ((wsListA ?? []).some(w => w.id === wsB.id)) fail("User A can see workspace B"); else ok("Workspace isolation A");
  const { data: wsListB } = await cB.from("workspaces").select("id");
  if ((wsListB ?? []).some(w => w.id === wsA.id)) fail("User B can see workspace A"); else ok("Workspace isolation B");

  // 2. Channels
  const { data: chListA } = await cA.from("channels").select("id");
  if ((chListA ?? []).some(c => c.id === chB.id)) fail("User A can see channel B"); else ok("Channel isolation A");

  // 3. Cross-tenant write rejection
  const { error: insErr } = await cA.from("messages").insert({ workspace_id: wsB.id, sender_id: userA.id, body: "leak", channel_id: chB.id });
  if (!insErr) fail("User A could insert message into workspace B"); else ok("Cross-tenant message insert blocked");

  // 4. Member listing
  const { data: memList } = await cA.from("workspace_members").select("workspace_id");
  if ((memList ?? []).some(m => m.workspace_id === wsB.id)) fail("User A can see workspace B members"); else ok("Membership isolation");

} catch (e) {
  fail("Setup error: " + (e.message || e));
} finally {
  console.log("\nCleaning up...");
  for (const wid of cleanup.workspaces) await admin.from("workspaces").delete().eq("id", wid);
  for (const uid of cleanup.users) await admin.auth.admin.deleteUser(uid);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll tenant-isolation checks passed.");
