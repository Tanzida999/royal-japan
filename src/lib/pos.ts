export const PAYMENTS = ["Cash", "Card", "PayPay", "Bank"] as const;
export function checkoutTotals(prices: number[], discount: number, paid: number) {
  if (!prices.length || prices.some(p => !Number.isSafeInteger(p) || p < 0)) throw new Error("Enter valid item prices");
  const subtotal = prices.reduce((a, p) => a + p, 0);
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) throw new Error("Discount must be between zero and subtotal");
  const total = subtotal - discount;
  if (!Number.isSafeInteger(paid) || paid < total) throw new Error("Amount received must cover the total");
  let cumulative = 0;
  const netPrices = prices.map(p => {
    const before = subtotal ? Math.floor(cumulative * total / subtotal) : 0;
    cumulative += p;
    return (subtotal ? Math.floor(cumulative * total / subtotal) : 0) - before;
  });
  return { subtotal, discount, total, paid, change: paid - total, netPrices };
}
export function saleEligibility(status: string, currentShop: string, saleShop: string) {
  if (status !== "in_stock") return status === "sold" ? "This phone is already sold" : "This phone is in transit and cannot be sold";
  if (!saleShop || currentShop !== saleShop) return "This phone is at another shop. Request a transfer first.";
  return "";
}
export function imeiProblem(imei: string, existing: Set<string>) {
  if (!/^\d{15}$/.test(imei)) return "IMEI must be exactly 15 digits";
  return existing.has(imei) ? "This IMEI already exists" : "";
}
export function transferTiming(start: string, limit: number, now: Date) {
  const remaining = new Date(start).getTime() + limit * 3_600_000 - now.getTime();
  return { overdue: remaining < 0, expired: remaining <= 0, remaining };
}