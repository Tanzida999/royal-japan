import { pageMeta } from "@/lib/metadata";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, shopsQuery } from "@/lib/app";
import { inviteStaff, resendInvite, sendStaffReset, setStaffDisabled, updateStaff } from "@/lib/staff.functions";
import { normalizeStaffCode, STAFF_CODE_RE } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Barcode } from "@/components/Barcode";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => pageMeta("Staff — Mobile Shop Manager", "Invite and manage shop staff and print barcode ID cards."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: StaffPage,
});

type Role = "owner" | "manager" | "staff";
type StaffRow = { id: string; name: string; email: string | null; staff_code: string; shop_id: string | null; disabled: boolean; role: Role | "—" };

function StaffPage() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);
  const resend = useServerFn(resendInvite);
  const reset = useServerFn(sendStaffReset);
  const update = useServerFn(updateStaff);
  const disable = useServerFn(setStaffDisabled);
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const shopName = (id: string | null) => shops.find((s) => s.id === id)?.name ?? "—";
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<StaffRow[]> => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, name, email, staff_code, shop_id, disabled").order("staff_code"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      const roles = new Map<string, string[]>();
      for (const x of r.data ?? []) roles.set(x.user_id, [...(roles.get(x.user_id) ?? []), x.role]);
      return p.data.map((x) => {
        const rs = roles.get(x.id) ?? [];
        return { ...x, role: rs.includes("owner") ? "owner" : rs.includes("manager") ? "manager" : rs.includes("staff") ? "staff" : "—" };
      });
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [shopId, setShopId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<StaffRow | null>(null);
  const [edit, setEdit] = useState<{ id: string; shop_id: string; role: Role } | null>(null);
  const nextCode = `STF-${String(staff.length + 1).padStart(3, "0")}`;

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); setNotice(label); qc.invalidateQueries({ queryKey: ["staff"] }); }
    catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const staffCode = normalizeStaffCode(code || nextCode);
    if (!name.trim()) return setError("Name is required");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email");
    if (!shopId) return setError("Pick a shop");
    if (!STAFF_CODE_RE.test(staffCode)) return setError("Staff code: 3–20 letters, numbers or -");
    if (staff.some((s) => s.staff_code === staffCode)) return setError("That staff code is already used");
    await run(`Invite sent to ${email.trim()}`, async () => {
      const s = await invite({ data: { name, email, role, shop_id: shopId, staff_code: staffCode } });
      setName(""); setEmail(""); setCode("");
      setCard({ ...s, email, disabled: false });
    });
  }

  if (card) {
    return (
      <div className="space-y-4">
        {notice && <p className="no-print text-sm font-semibold text-primary">{notice}</p>}
        <div className="print-area staff-card inline-block space-y-2 rounded-xl border bg-card p-4 text-card-foreground">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Staff ID</div>
          <div className="text-xl font-bold">{card.name}</div>
          <div className="text-sm">{card.role} · {shopName(card.shop_id)}</div>
          <Barcode value={card.staff_code} height={50} />
        </div>
        <div className="no-print flex gap-2">
          <Button onClick={() => window.print()}>Print ID card</Button>
          <Button variant="outline" onClick={() => { setCard(null); setNotice(""); }}>Back to staff</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Invite staff</h1>
        <p className="text-sm text-muted-foreground">They get an email link to set their own password.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></F>
          <F label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></F>
          <F label="Shop">
            <select className="field" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">Select shop</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </F>
          <F label="Role">
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">staff</option>
              <option value="manager">manager</option>
              <option value="owner">owner</option>
            </select>
          </F>
          <F label="Staff code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={nextCode} maxLength={20} className="font-mono" /></F>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        {notice && <p className="text-sm font-semibold text-primary">{notice}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Invite staff"}</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Shop</th><th className="p-2">Status</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={`border-t ${s.disabled ? "opacity-60" : ""}`}>
                <td className="p-2 font-mono">{s.staff_code}</td>
                <td className="p-2">{s.name}<div className="text-xs text-muted-foreground">{s.email}</div></td>
                {edit?.id === s.id ? (
                  <>
                    <td className="p-2">
                      <select className="field" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                        <option value="staff">staff</option><option value="manager">manager</option><option value="owner">owner</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="field" value={edit.shop_id} onChange={(e) => setEdit({ ...edit, shop_id: e.target.value })}>
                        {shops.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                  </>
                ) : (
                  <><td className="p-2">{s.role}</td><td className="p-2">{shopName(s.shop_id)}</td></>
                )}
                <td className="p-2">{s.disabled ? <span className="font-semibold text-destructive">Disabled</span> : "Active"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {edit?.id === s.id ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => run("Saved", async () => { await update({ data: edit }); setEdit(null); })}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setCard(s)}>ID card</Button>
                        <Button size="sm" variant="outline" onClick={() => setEdit({ id: s.id, shop_id: s.shop_id ?? shops[0]?.id ?? "", role: s.role === "—" ? "staff" : s.role })}>Change shop/role</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(`Invite re-sent to ${s.email ?? s.name}`, () => resend({ data: { id: s.id } }))}>Resend invite</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(`Reset email sent to ${s.email ?? s.name}`, () => reset({ data: { id: s.id } }))}>Send reset</Button>
                        {s.id !== me?.id && (
                          <Button size="sm" variant={s.disabled ? "default" : "destructive"} disabled={busy}
                            onClick={() => { if (s.disabled || confirm(`Disable ${s.name}? They will be signed out and cannot log in.`)) run(s.disabled ? `${s.name} enabled` : `${s.name} disabled`, () => disable({ data: { id: s.id, disabled: !s.disabled } })); }}>
                            {s.disabled ? "Enable" : "Disable"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
