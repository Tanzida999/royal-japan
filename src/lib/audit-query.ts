export type AuditEntry = {
  id: string; user_id: string | null; user_name: string | null; staff_code: string | null; shop_id: string | null;
  action: string; table_name: string | null; record_id: string | null;
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; device: string | null; created_at: string;
};
export const AUDIT_SELECT = "id, user_id, user_name, staff_code, shop_id, action, table_name, record_id, old_values, new_values, device, created_at";
export const LOGIN_ACTIONS = ["login", "logout", "failed_login", "password_reset_requested", "password_changed"];
export const ACTION_TYPES = ["insert", "update", ...LOGIN_ACTIONS, "invite_sent", "role_changed", "account_disabled", "account_enabled", "receipt_reprinted", "label_printed"];

export function describe(e: AuditEntry) {
  const n = e.new_values ?? {};
  const ref = [n["product_code"], n["imei"], n["receipt_no"], n["email"], n["name"]].filter(Boolean).join(" · ");
  const what = e.action === "insert" ? `Added ${e.table_name}` : e.action === "update" ? `Changed ${e.table_name}` : e.action.replace(/_/g, " ");
  return ref ? `${what} — ${ref}` : what;
}
