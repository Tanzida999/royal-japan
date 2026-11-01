import { yen } from "./app";

export type Alert = { kind: "Below cost" | "Different shop" | "Old stock" | "In transit 24h+" | "Transfer rejected"; code: string; text: string; shopIds: string[] };

type Sale = { receipt_no: string; product_id: string; sale_price: number; shop_id: string };
type Product = { id: string; product_code: string; shop_id: string; status: string; created_at: string; name: string };

export const OLD_STOCK_DAYS = 60;

type Transfer = { product_id: string; from_shop_id: string; to_shop_id: string; status: string; accepted_at: string | null; reject_reason: string | null };

export const TRANSIT_ALERT_HOURS = 24;

export function buildAlerts({ sales, products, cost, now, transfers = [] }: { sales: Sale[]; products: Product[]; cost: Record<string, number>; now: Date; transfers?: Transfer[] }): Alert[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Alert[] = [];
  for (const s of sales) {
    const p = byId.get(s.product_id);
    const c = cost[s.product_id];
    const code = p?.product_code ?? s.receipt_no;
    if (c != null && s.sale_price < c) {
      out.push({ kind: "Below cost", code, text: `${p?.name ?? ""} sold ${yen(s.sale_price)}, cost ${yen(c)} (${s.receipt_no})`, shopIds: [s.shop_id] });
    }
    if (p && p.shop_id !== s.shop_id) {
      out.push({ kind: "Different shop", code, text: `${p.name} (${s.receipt_no})`, shopIds: [p.shop_id, s.shop_id] });
    }
  }
  for (const p of products) {
    if (p.status !== "in_stock") continue;
    const days = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86_400_000);
    if (days >= OLD_STOCK_DAYS) out.push({ kind: "Old stock", code: p.product_code, text: `${p.name} in stock ${days} days`, shopIds: [p.shop_id] });
  }
  for (const t of transfers) {
    const p = byId.get(t.product_id);
    const code = p?.product_code ?? "";
    if (t.status === "accepted" && t.accepted_at) {
      const hours = Math.floor((now.getTime() - new Date(t.accepted_at).getTime()) / 3_600_000);
      if (hours >= TRANSIT_ALERT_HOURS) out.push({ kind: "In transit 24h+", code, text: `${p?.name ?? ""} in transit ${hours}h`, shopIds: [t.from_shop_id, t.to_shop_id] });
    }
    if (t.status === "rejected") out.push({ kind: "Transfer rejected", code, text: `${p?.name ?? ""} — ${t.reject_reason ?? ""}`, shopIds: [t.from_shop_id, t.to_shop_id] });
  }
  return out;
}
