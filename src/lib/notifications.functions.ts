import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { notifyUserWhatsApp } from "@/server/notifications.server";

export const sendWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        message: z.string().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await notifyUserWhatsApp(data.userId, data.message);
    return { ok: true };
  });
