import type { ReceiptData } from "@/components/Receipt";
import { jstDateTime } from "./app";
import type { Database, Json } from "@/integrations/supabase/types";
type SavedReceipt = Database["public"]["Tables"]["receipts"]["Row"];
function object(value: Json): Record<string, Json | undefined> { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
export function receiptView(r: SavedReceipt): ReceiptData {
  const sh = object(r.shop_snapshot);
  const items = (Array.isArray(r.items) ? r.items : []).map(value => { const i = object(value); return { model: String(i['model'] ?? ""), storage: String(i['storage'] ?? ""), color: String(i['color'] ?? ""), imei: String(i['imei'] ?? ""), price: Number(i['price'] ?? 0) }; });
  return { shop: String(sh['name'] ?? ""), address: String(sh['address'] ?? ""), postal_code: String(sh['postal_code'] ?? ""), phone: String(sh['phone'] ?? ""), logo: typeof sh['logo'] === 'string' ? sh['logo'] : null, footer: String(sh['receipt_footer'] ?? ""), receipt_no: r.receipt_no, date: jstDateTime(r.created_at), staff: r.staff_name, customer: r.customer_name, customer_phone: r.customer_phone, payment: r.payment, item: "", imei: "", price: r.total, items, subtotal: r.subtotal, discount: r.discount, paid: r.paid, change: r.change_due };
}