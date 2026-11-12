import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime, meQuery, shopsQuery } from "@/lib/app";
import { pageMeta } from "@/lib/metadata";
import { toCsv } from "@/lib/accounts";
import { ACTION_TYPES, AUDIT_SELECT, describe, LOGIN_ACTIONS, type AuditEntry } from "@/lib/audit-query";
import { AuditDetail } from "@/components/AuditDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => pageMeta("Activity — Mobile Shop Manager", "Owner audit log of every change, sign-in and print across all shops."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: Activity,
});

const jstStart = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
const jstEnd = (d: string) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

function Activity() {
  const [tab, setTab] = useState<"all" | "login">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shop, setShop] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: people = [] } = useQuery({
    queryKey: ["staff-names"],
    queryFn: async () => (await supabase.from("profiles").select("id, name, staff_code").order("name")).data ?? [],
  });
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["audit", tab, from, to, shop, user, action],
    queryFn: async () => {
      let q = supabase.from("audit_log").select(AUDIT_SELECT).order("created_at", { ascending: false }).limit(1000);
      if (tab === "login") q = q.in("action", LOGIN_ACTIONS);
      if (from) q = q.gte("created_at", jstStart(from));
      if (to) q = q.lte("created_at", jstEnd(to));
      if (shop) q = q.eq("shop_id", shop);
      if (user) q = q.eq("user_id", user);
      if (action) q = q.eq("action", action);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AuditEntry[];
    },
  });
  const shopName = (id: string | null) => shops.find((s) => s.id === id)?.name ?? "";
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((e) => {
      const v = { ...(e.old_values ?? {}), ...(e.new_values ?? {}) };
      return [v["product_code"], v["imei"], v["receipt_no"], e.record_id].some((x) => String(x ?? "").toLowerCase().includes(s));
    });
  }, [data, search]);

  function exportCsv() {
    const csv = toCsv([
      ["time (JST)", "user", "staff_code", "shop", "action", "table", "record", "summary", "device", "old_values", "new_values"],
      ...rows.map((e) => [jstDateTime(e.created_at), e.user_name, e.staff_code, shopName(e.shop_id), e.action, e.table_name, e.record_id, describe(e), e.device, JSON.stringify(e.old_values ?? {}), JSON.stringify(e.new_values ?? {})]),
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Activity</h1>
        <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>All activity</Button>
        <Button variant={tab === "login" ? "default" : "outline"} size="sm" onClick={() => setTab("login")}>Login history</Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>
      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="field" aria-label="Shop" value={shop} onChange={(e) => setShop(e.target.value)}>
          <option value="">All shops</option>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field" aria-label="Staff" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">All staff</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.staff_code})</option>)}
        </select>
        <select className="field" aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>{(tab === "login" ? LOGIN_ACTIONS : ACTION_TYPES).map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
        <Input placeholder="Product code / IMEI / receipt" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Time</th><th className="p-2">Who</th><th className="p-2">Shop</th><th className="p-2">What</th>{tab === "login" && <th className="p-2">Device</th>}</tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
            {!isLoading && !rows.length && <tr><td className="p-3 text-muted-foreground" colSpan={5}>No activity found.</td></tr>}
            {rows.map((e) => (
              <Fragment key={e.id}>
                <tr className={`cursor-pointer border-t hover:bg-accent ${e.action === "failed_login" ? "text-destructive" : ""}`} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <td className="whitespace-nowrap p-2">{jstDateTime(e.created_at)}</td>
                  <td className="p-2">{e.user_name ?? String(e.new_values?.["email"] ?? "—")}{e.staff_code && <span className="ml-1 font-mono text-xs text-muted-foreground">{e.staff_code}</span>}</td>
                  <td className="p-2">{shopName(e.shop_id)}</td>
                  <td className="p-2">{describe(e)}</td>
                  {tab === "login" && <td className="max-w-xs truncate p-2 text-xs text-muted-foreground">{e.device}</td>}
                </tr>
                {open === e.id && <tr><td colSpan={5} className="p-2"><AuditDetail e={e} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 1000 && <p className="text-xs text-muted-foreground">Showing the newest 1000 entries — narrow the dates to see older ones.</p>}
    </div>
  );
}
