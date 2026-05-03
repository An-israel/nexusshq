import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        full_name: z.string().min(1, "Full name is required"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createConfirmedUser } = await import("./auth.server");
    await createConfirmedUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      full_name: data.full_name.trim(),
    });
    return { ok: true };
  });
