export const STAFF_CODE_RE = /^[A-Z0-9-]{3,20}$/;
export const normalizeStaffCode = (s: string) => s.trim().toUpperCase();
export const FAILED_LOGIN_LIMIT = 3;

type AuditRow = { action: string; table_name: string | null; record_id: string | null; created_at: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; user_name?: string | null };

/** Accounts with FAILED_LOGIN_LIMIT+ failed logins inside any 1-hour window. */
export function failedLoginAlerts(rows: AuditRow[]): { email: string; count: number; last: string }[] {
  const byEmail = new Map<string, number[]>();
  for (const r of rows) {
    if (r.action !== "failed_login") continue;
    const email = String(r.new_values?.["email"] ?? "");
    if (!email) continue;
    byEmail.set(email, [...(byEmail.get(email) ?? []), new Date(r.created_at).getTime()]);
  }
  const out: { email: string; count: number; last: string }[] = [];
  for (const [email, times] of byEmail) {
    times.sort((a, b) => a - b);
    let best = 0, lastAt = 0;
    for (let i = 0, j = 0; j < times.length; j++) {
      while (times[j]! - times[i]! > 3_600_000) i++;
      if (j - i + 1 > best) { best = j - i + 1; lastAt = times[j]!; }
    }
    if (best >= FAILED_LOGIN_LIMIT) out.push({ email, count: best, last: new Date(lastAt).toISOString() });
  }
  return out;
}

/** Price changes on a product (selling price) or its cost (purchase price) after it was added. */
export function priceEdits(rows: AuditRow[]): { record_id: string; field: string; from: number; to: number; at: string; by: string }[] {
  const out: { record_id: string; field: string; from: number; to: number; at: string; by: string }[] = [];
  for (const r of rows) {
    if (r.action !== "update" || !r.old_values || !r.new_values) continue;
    const field = r.table_name === "products" ? "selling_price" : r.table_name === "product_costs" ? "purchase_price" : null;
    if (!field) continue;
    const a = Number(r.old_values[field]), b = Number(r.new_values[field]);
    if (a !== b) out.push({ record_id: r.record_id ?? "", field, from: a, to: b, at: r.created_at, by: r.user_name ?? "" });
  }
  return out;
}

/** Fields that differ between old and new values. */
export function changedFields(oldV: Record<string, unknown> | null, newV: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]);
  return [...keys].filter((k) => JSON.stringify(oldV?.[k]) !== JSON.stringify(newV?.[k])).map((k) => ({ key: k, from: oldV?.[k], to: newV?.[k] }));
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}

export function homeFor(role: string | null | undefined) {
  return role === "owner" ? "/dashboard" : "/sell";
}
