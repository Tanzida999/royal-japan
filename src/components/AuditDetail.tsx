import { changedFields } from "@/lib/accounts";
import { jstDateTime } from "@/lib/app";
import { describe, type AuditEntry } from "@/lib/audit-query";

const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function AuditDetail({ e }: { e: AuditEntry }) {
  const rows = e.action === "update" ? changedFields(e.old_values, e.new_values) : Object.entries(e.new_values ?? {}).map(([key, to]) => ({ key, from: undefined, to }));
  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="font-semibold">{describe(e)}</div>
      <div className="text-xs text-muted-foreground">{jstDateTime(e.created_at)} · {e.user_name ?? "System / signed out"} {e.staff_code ? `(${e.staff_code})` : ""} · {e.device || "unknown device"}</div>
      <table className="w-full text-xs">
        <thead className="text-left"><tr><th className="p-1">Field</th>{e.action === "update" && <th className="p-1">Old</th>}<th className="p-1">{e.action === "update" ? "New" : "Value"}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t align-top">
              <td className="p-1 font-mono">{r.key}</td>
              {e.action === "update" && <td className="p-1 break-all text-destructive">{show(r.from)}</td>}
              <td className="p-1 break-all">{show(r.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
