export const SUPPLIER_PAYMENTS = ["Cash", "Bank", "Due", "Partial"] as const;

export type BulkRow = {
  model_id: string;
  imei: string;
  color: string;
  storage: string;
  condition: string;
  purchase_price: string;
  selling_price: string;
};

/** Returns "OK" or the first problem for each row. */
export function validateBulkRows(rows: BulkRow[], existing: Set<string>): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.imei.trim(), (counts.get(r.imei.trim()) ?? 0) + 1);
  return rows.map((r) => {
    const imei = r.imei.trim();
    if (!r.model_id) return "Missing model";
    if (!/^\d{15}$/.test(imei)) return "Bad IMEI (need 15 digits)";
    if (existing.has(imei)) return "Duplicate (already in system)";
    if ((counts.get(imei) ?? 0) > 1) return "Duplicate (in this list)";
    if (!r.color.trim()) return "Missing color";
    if (!r.storage.trim()) return "Missing storage";
    if (r.purchase_price === "") return "Missing purchase price";
    if (r.selling_price === "") return "Missing selling price";
    return "OK";
  });
}

/** What was paid to the supplier for a purchase. */
export function paidFor(payment: string, price: number, paidAmount: number | null): number {
  if (payment === "Due") return 0;
  if (payment === "Partial") return Math.max(0, Math.min(paidAmount ?? 0, price));
  return price;
}
