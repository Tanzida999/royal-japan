export type RegisterLine = { id: string; kind: 'phone' | 'accessory' | 'custom'; name: string; price: number; quantity: number; discount: number; added: string; stock: number; detail?: string; imei?: string; carrier?: string | null; tracking?: string | null };
export type Tender = { method: 'Cash' | 'Card' | 'PayPay' | 'Bank' | 'COD'; amount: number };
export function inclusiveTax(total: number) { return Math.floor(total * 10 / 110); }
export function discountAmount(base: number, value: number, percent: boolean) {
  if (!Number.isFinite(value) || value < 0 || (percent && value > 100)) throw new Error('Invalid discount');
  const amount = percent ? Math.floor(base * value / 100) : value;
  if (!Number.isSafeInteger(amount) || amount > base) throw new Error('Discount exceeds item amount');
  return amount;
}
export function registerTotals(lines: RegisterLine[], orderDiscount: number, privileged = true, staffLimit = 0) {
  let subtotal = 0, lineDiscount = 0, count = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || (line.kind === 'phone' && line.quantity !== 1) || (line.kind === 'accessory' && line.quantity > line.stock)) throw new Error('Quantity exceeds available stock');
    if (!Number.isSafeInteger(line.price) || line.price < 0) throw new Error('Enter a valid price');
    const base = line.quantity * line.price;
    discountAmount(base, line.discount, false);
    subtotal += base; lineDiscount += line.discount; count += line.quantity;
  }
  discountAmount(subtotal - lineDiscount, orderDiscount, false);
  const discount = lineDiscount + orderDiscount;
  if (!privileged && discount > Math.floor(subtotal * staffLimit / 100)) throw new Error(`Staff discount limit is ${staffLimit}%`);
  const total = subtotal - discount;
  return { subtotal, discount, total, tax: inclusiveTax(total), count };
}
export function tenderTotals(total: number, payments: Tender[]) {
  if (!payments.length || new Set(payments.map(p => p.method)).size !== payments.length || payments.some(p => !Number.isSafeInteger(p.amount) || p.amount < 0)) throw new Error('Enter valid payment amounts');
  const received = payments.reduce((a, p) => a + p.amount, 0);
  const noncash = payments.filter(p => p.method !== 'Cash').reduce((a, p) => a + p.amount, 0);
  if (received < total) throw new Error('Amount received must cover the total');
  if (noncash > total) throw new Error('Change can only be returned from cash');
  return { received, change: received - total };
}