import { pageMeta } from "@/lib/metadata";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, shopsQuery } from "@/lib/app";
import { createStaff } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Barcode } from "@/components/Barcode";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => pageMeta("Staff — Mobile Shop Manager", "Manage shop staff and print barcode ID cards."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: StaffPage,
});

type StaffRow = { id: string; name: string; staff_code: string; shop_id: string | null; role: string };

function StaffPage() {
  const qc = useQueryClient();
  const add = useServerFn(createStaff);
  const { data: shops = [] } = useQuery(shopsQuery);
  const shopName = (id: string | null) => shops.find((s) => s.id === id)?.name ?? "—";
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<StaffRow[]> => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, name, staff_code, shop_id").order("staff_code"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      const roles = new Map((r.data ?? []).map((x) => [x.user_id, x.role]));
      return p.data.map((x) => ({ ...x, role: roles.get(x.id) ?? "—" }));
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [shopId, setShopId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<StaffRow | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!shopId) return setError("Pick a shop");
    setBusy(true);
    try {
      const s = await add({ data: { name, email, password, role, shop_id: shopId } });
      qc.invalidateQueries({ queryKey: ["staff"] });
      setName("");
      setEmail("");
      setPassword("");
      setCard({ ...s, role: s.role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff");
    } finally {
      setBusy(false);
    }
  }

  if (card) {
    return (
      <div className="space-y-4">
        <div className="print-area staff-card inline-block space-y-2 rounded-xl border bg-card p-4 text-card-foreground">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Staff ID</div>
          <div className="text-xl font-bold">{card.name}</div>
          <div className="text-sm">
            {card.role} · {shopName(card.shop_id)}
          </div>
          <Barcode value={card.staff_code} height={50} />
        </div>
        <div className="no-print flex gap-2">
          <Button onClick={() => window.print()}>Print ID card</Button>
          <Button variant="outline" onClick={() => setCard(null)}>Back to staff</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Add Staff</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></F>
          <F label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></F>
          <F label="Starting password"><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" /></F>
          <F label="Role">
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as "staff" | "owner")}>
              <option value="staff">staff</option>
              <option value="owner">owner</option>
            </select>
          </F>
          <F label="Shop">
            <select className="field" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">Select shop</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </F>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add Staff"}</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Code</th>
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              <th className="p-2">Shop</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-mono">{s.staff_code}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.role}</td>
                <td className="p-2">{shopName(s.shop_id)}</td>
                <td className="p-2">
                  <Button size="sm" variant="outline" onClick={() => setCard(s)}>ID card</Button>
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
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
