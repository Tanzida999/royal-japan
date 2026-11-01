export type SupplierFilters = { year: string; month: string; from: string; to: string; shopId: string };
export function supplierMatches(date: string, shopId: string, f: SupplierFilters) {
  return (!f.year || date.slice(0,4) === f.year) && (!f.month || date.slice(5,7) === f.month) && (!f.from || date >= f.from) && (!f.to || date <= f.to) && (!f.shopId || shopId === f.shopId);
}
export function supplierTotals(rows: { supplier: string | null; purchase_price: number; paid_amount: number | null }[]) {
  const map = new Map<string, { phones: number; bought: number; paid: number }>();
  for (const p of rows) { const name = p.supplier || "(no supplier)"; const r = map.get(name) ?? { phones: 0, bought: 0, paid: 0 }; r.phones++; r.bought += p.purchase_price; r.paid += p.paid_amount ?? p.purchase_price; map.set(name,r); }
  return [...map].map(([name,r]) => ({name,...r,due:r.bought-r.paid})).sort((a,b) => b.due-a.due);
}