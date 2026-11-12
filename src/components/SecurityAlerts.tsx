import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime, yen } from "@/lib/app";
import { failedLoginAlerts, priceEdits } from "@/lib/accounts";
import { AUDIT_SELECT, type AuditEntry } from "@/lib/audit-query";

/** Owner dashboard: repeated failed logins and price edits after a phone was added (last 30 days). */
export function SecurityAlerts() {
  const { data = [] } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("audit_log").select(AUDIT_SELECT).gte("created_at", since)
        .or("action.eq.failed_login,and(action.eq.update,table_name.in.(products,product_costs))")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as unknown as AuditEntry[];
    },
  });
  const logins = failedLoginAlerts(data);
  const prices = priceEdits(data);
  const codeFor = (id: string) => String(data.find((e) => e.record_id === id && e.new_values?.["product_code"])?.new_values?.["product_code"] ?? "");
  const total = logins.length + prices.length;
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-3 font-semibold">Security alerts ({total})</div>
      {total === 0 ? <p className="p-3 text-sm text-muted-foreground">No security alerts in the last 30 days.</p> : (
        <ul className="divide-y text-sm">
          {logins.map((a) => (
            <li key={a.email} className="flex flex-wrap gap-2 p-3">
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Failed logins</span>
              <span>{a.email}: {a.count} failed attempts within 1 hour (last {jstDateTime(a.last)})</span>
            </li>
          ))}
          {prices.map((p, i) => (
            <li key={i} className="flex flex-wrap gap-2 p-3">
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Price edited</span>
              <Link to="/product/$id" params={{ id: p.record_id }} className="font-mono text-primary">{codeFor(p.record_id) || "View phone"}</Link>
              <span className="text-muted-foreground">{p.field === "selling_price" ? "Selling price" : "Purchase price"} {yen(p.from)} → {yen(p.to)} by {p.by || "—"} · {jstDateTime(p.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
