import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeStaffCode, STAFF_CODE_RE } from "@/lib/accounts";

const roleEnum = z.enum(["owner", "manager", "staff"]);
type Role = z.infer<typeof roleEnum>;

function reqInfo() {
  const r = getRequest();
  const origin = r?.headers.get("origin") || (r ? new URL(r.url).origin : "");
  return { origin, device: (r?.headers.get("user-agent") ?? "").slice(0, 300) };
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function assertOwner(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "owner" });
  if (!data) throw new Error("Only the owner can manage staff");
}

async function log(actor: string | null, email: string | null, action: string, recordId: string | null, details: Record<string, unknown> = {}) {
  const a = await admin();
  await a.rpc("log_admin_event", { _actor: actor as string, _email: email as string, _action: action, _record_id: recordId as string, _details: details as never, _device: reqInfo().device });
}

/** Roles stored for a chosen role; a manager also holds staff rights so every staff rule applies. */
function rolesFor(role: Role) {
  return role === "manager" ? (["staff", "manager"] as const) : ([role] as const);
}

async function targetEmail(id: string) {
  const a = await admin();
  const { data, error } = await a.auth.admin.getUserById(id);
  if (error || !data.user?.email) throw new Error("Account not found");
  return data.user.email;
}

const inviteInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  role: roleEnum,
  shop_id: z.string().uuid(),
  staff_code: z.string().transform(normalizeStaffCode).refine((s) => STAFF_CODE_RE.test(s), "Staff code: 3–20 letters, numbers or -"),
});

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const a = await admin();
    const { data: taken } = await a.from("profiles").select("id").eq("staff_code", data.staff_code).maybeSingle();
    if (taken) throw new Error("That staff code is already used");
    const { data: inv, error } = await a.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${reqInfo().origin}/reset-password`, data: { name: data.name } });
    if (error || !inv.user) throw new Error(error?.message ?? "Could not send invite");
    const id = inv.user.id;
    const { error: pe } = await a.from("profiles").insert({ id, name: data.name, shop_id: data.shop_id, staff_code: data.staff_code, email: data.email });
    if (pe) throw new Error(pe.message);
    const { error: re } = await a.from("user_roles").insert(rolesFor(data.role).map((role) => ({ user_id: id, role })));
    if (re) throw new Error(re.message);
    await log(context.userId, null, "invite_sent", id, { email: data.email, role: data.role, shop_id: data.shop_id });
    return { id, name: data.name, staff_code: data.staff_code, shop_id: data.shop_id, role: data.role };
  });

const idInput = z.object({ id: z.string().uuid() });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const a = await admin();
    const email = await targetEmail(data.id);
    const { error } = await a.auth.admin.inviteUserByEmail(email, { redirectTo: `${reqInfo().origin}/reset-password` });
    if (error) throw new Error(/registered|exists/i.test(error.message) ? "This person already set a password — send a password reset instead" : error.message);
    await log(context.userId, null, "invite_sent", data.id, { email, resend: true });
    return { ok: true };
  });

export const sendStaffReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const a = await admin();
    const email = await targetEmail(data.id);
    const { error } = await a.auth.resetPasswordForEmail(email, { redirectTo: `${reqInfo().origin}/reset-password` });
    if (error) throw new Error(error.message);
    await log(context.userId, email, "password_reset_requested", data.id, { by_owner: true });
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), shop_id: z.string().uuid(), role: roleEnum }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.id === context.userId && data.role !== "owner") throw new Error("You cannot remove your own owner role");
    const a = await admin();
    const { data: before } = await a.from("user_roles").select("role").eq("user_id", data.id);
    const { error: pe } = await a.from("profiles").update({ shop_id: data.shop_id }).eq("id", data.id);
    if (pe) throw new Error(pe.message);
    const want = rolesFor(data.role) as readonly string[];
    const have = (before ?? []).map((r) => r.role as string);
    const remove = have.filter((r) => !want.includes(r));
    const add = want.filter((r) => !have.includes(r));
    if (remove.length) await a.from("user_roles").delete().eq("user_id", data.id).in("role", remove as never);
    if (add.length) await a.from("user_roles").insert(add.map((role) => ({ user_id: data.id, role: role as never })));
    if (remove.length || add.length) await log(context.userId, null, "role_changed", data.id, { old_roles: have, new_roles: want });
    return { ok: true };
  });

export const setStaffDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.id === context.userId) throw new Error("You cannot disable your own account");
    const a = await admin();
    const { error: be } = await a.auth.admin.updateUserById(data.id, { ban_duration: data.disabled ? "876000h" : "none" });
    if (be) throw new Error(be.message);
    const { error } = await a.from("profiles").update({ disabled: data.disabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.userId, null, data.disabled ? "account_disabled" : "account_enabled", data.id);
    return { ok: true };
  });

// ---- public (signed-out) events: only record, never reveal whether an account exists ----
const emailInput = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailInput.parse(d))
  .handler(async ({ data }) => {
    await log(null, data.email, "failed_login", null);
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailInput.parse(d))
  .handler(async ({ data }) => {
    const a = await admin();
    await a.auth.resetPasswordForEmail(data.email, { redirectTo: `${reqInfo().origin}/reset-password` });
    await log(null, data.email, "password_reset_requested", null);
    return { ok: true };
  });
