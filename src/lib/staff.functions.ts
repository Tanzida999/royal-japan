import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["owner", "staff"]),
  shop_id: z.string().uuid(),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    if (!isOwner) throw new Error("Only the owner can add staff");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const id = created.user.id;
    const { data: prof, error: pe } = await supabaseAdmin
      .from("profiles")
      .insert({ id, name: data.name, shop_id: data.shop_id })
      .select("id, name, staff_code, shop_id")
      .single();
    if (pe) throw new Error(pe.message);
    const { error: re } = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    if (re) throw new Error(re.message);
    return { ...prof, role: data.role };
  });
