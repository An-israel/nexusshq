import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertCallerIsAdmin,
  assertCallerIsManagerOrAdmin,
  createInvitation,
  inviteEmployee,
  markInviteEmailResult,
  redeemInvitation,
  removeWorkspaceMember,
  requestNewInvite,
  resendInvitation,
  resolveFlag,
  sendInviteEmail,
  setEmployeeActive,
  setEmployeeRole,
} from "@/server/admin.server";

const departmentEnum = z.enum([
  "management",
  "customer_success",
  "growth",
  "marketing",
  "design",
  "video_editing",
  "operations",
  "other",
]);
const roleEnum = z.enum(["admin", "manager", "employee"]);

export const inviteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        full_name: z.string().min(1),
        job_title: z.string().nullable().optional(),
        department: departmentEnum.nullable().optional(),
        phone: z.string().nullable().optional(),
        role: roleEnum,
        redirectTo: z.string().url().optional(),
        workspaceId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    if (data.role === "admin") {
      await assertCallerIsAdmin(context.userId, context.supabase);
    }
    return inviteEmployee(data);
  });

export const setEmployeeActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId, context.supabase);
    await setEmployeeActive(data.userId, data.isActive, context.supabase);
    return { ok: true };
  });

export const removeWorkspaceMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // RPC enforces owner/admin check via SECURITY DEFINER; this is just defense in depth.
    await removeWorkspaceMember(data.workspaceId, data.userId, context.supabase);
    return { ok: true };
  });

export const setEmployeeRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        role: roleEnum,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    if (data.role === "admin") {
      await assertCallerIsAdmin(context.userId, context.supabase);
    }
    await setEmployeeRole(data.userId, data.workspaceId, data.role, context.supabase);
    return { ok: true };
  });

export const resolveFlagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ flagId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    await resolveFlag(data.flagId, context.supabase);
    return { ok: true };
  });

export const createInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        workspaceName: z.string().min(1),
        email: z.string().email(),
        full_name: z.string().min(1),
        job_title: z.string().nullable().optional(),
        department: z
          .enum([
            "management",
            "customer_success",
            "growth",
            "marketing",
            "design",
            "video_editing",
            "operations",
            "other",
          ])
          .nullable()
          .optional(),
        phone: z.string().nullable().optional(),
        role: z.enum(["admin", "manager", "employee"]),
        siteUrl: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    if (data.role === "admin") await assertCallerIsAdmin(context.userId, context.supabase);

    const result = await createInvitation({
      workspaceId: data.workspaceId,
      email: data.email,
      full_name: data.full_name,
      job_title: data.job_title,
      department: data.department,
      phone: data.phone,
      role: data.role,
      invitedBy: context.userId,
    });

    let emailSent = false;
    let emailError: string | null = null;
    const appUrl = data.siteUrl ?? process.env.APP_URL ?? "https://nexus.skryveai.com";
    const joinUrl = `${appUrl}/join?token=${result.token}`;
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    try {
      await sendInviteEmail({
        toEmail: data.email,
        toName: data.full_name,
        workspaceName: data.workspaceName,
        inviterName: profile?.full_name ?? "Your workspace admin",
        joinUrl,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Invite email could not be sent.";
    }
    await markInviteEmailResult(result.invitationId, emailSent, emailError);

    return { ...result, emailSent, emailError };
  });

export const resendInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        invitationId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        workspaceName: z.string().min(1),
        siteUrl: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);

    const fresh = await resendInvitation({
      invitationId: data.invitationId,
      workspaceId: data.workspaceId,
    });

    let emailSent = false;
    let emailError: string | null = null;
    const appUrl = data.siteUrl ?? process.env.APP_URL ?? "https://nexus.skryveai.com";
    const joinUrl = `${appUrl}/join?token=${fresh.token}`;
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    try {
      await sendInviteEmail({
        toEmail: fresh.email,
        toName: fresh.full_name,
        workspaceName: data.workspaceName,
        inviterName: profile?.full_name ?? "Your workspace admin",
        joinUrl,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Invite email could not be sent.";
    }
    await markInviteEmailResult(data.invitationId, emailSent, emailError);

    return {
      token: fresh.token,
      passcode: fresh.passcode,
      email: fresh.email,
      emailSent,
      emailError,
    };
  });

export const requestNewInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ tokenOrPasscode: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => requestNewInvite(data.tokenOrPasscode));

export const redeemInvitationFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        tokenOrPasscode: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data }) => redeemInvitation(data));
