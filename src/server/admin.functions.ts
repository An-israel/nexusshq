import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertCallerIsAdmin,
  assertCallerIsManagerOrAdmin,
  inviteEmployee,
  resolveFlag,
  setEmployeeActive,
  setEmployeeRole,
} from "./admin.server";

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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Managers can invite employees/managers; only admins can invite admins
    await assertCallerIsManagerOrAdmin(context.userId);
    if (data.role === "admin") {
      await assertCallerIsAdmin(context.userId);
    }
    return inviteEmployee(data);
  });

export const setEmployeeActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    await setEmployeeActive(data.userId, data.isActive);
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
    // Managers can set employee/manager; only admins can grant admin
    await assertCallerIsManagerOrAdmin(context.userId);
    if (data.role === "admin") {
      await assertCallerIsAdmin(context.userId);
    }
    await setEmployeeRole(data.userId, data.role);
    return { ok: true };
  });

export const resolveFlagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ flagId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId);
    await resolveFlag(data.flagId);
    return { ok: true };
  });
