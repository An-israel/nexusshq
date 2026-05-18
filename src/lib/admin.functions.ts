import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertCallerIsAdmin,
  assertCallerIsManagerOrAdmin,
  createInvitation,
  inviteEmployee,
  redeemInvitation,
  removeWorkspaceMember,
  resolveFlag,
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
        role: roleEnum,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    if (data.role === "admin") {
      await assertCallerIsAdmin(context.userId, context.supabase);
    }
    await setEmployeeRole(data.userId, data.role, context.supabase);
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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    if (data.role === "admin") await assertCallerIsAdmin(context.userId, context.supabase);
    return createInvitation({ ...data, invitedBy: context.userId });
  });

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
