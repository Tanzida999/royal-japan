import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, yen, type ProductRow } from "@/lib/app";
import { useCurrentShop } from "@/lib/shop-context";
import { checkoutTotals, PAYMENTS, saleEligibility } from "@/lib/pos";
import { receiptView } from "@/lib/receipt";
import { pageMeta } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { ReceiptActions } from "@/components/ReceiptActions";
import { StaffScan } from "@/components/StaffScan";
import { CameraScan } from "@/components/CameraScan";
import { ShopSelect } from "@/components/ShopSelect";

export const Route = createFileRoute("/_authenticated/sell")({ head: () => pageMeta("Sell — Mobile Shop Manager", "Scan phones into a cart and complete a shop sale with a printed receipt."), component: Sell });
type CartItem = { product: ProductRow; price: string };
function Sell() {
  const qc = useQueryClient();
  const { shopId, shopName } = useCurrentShop();
  const scanRef = useRef<HTMLInputElement>(null);
  const scanning = useRef(false);
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffCode, setStaffCode] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [format, setFormat] = useState<"thermal" | "a4">("thermal");
  useEffect(() => { setCart([]); setStaffCode(""); setPaid(""); setDiscount("0"); setError(""); scanRef.current?.focus(); }, [shopId]);
  const subtotal = cart.reduce((a, i) => a + Number(i.price), 0);
  const total = subtotal - Number(discount);
  const change = Math.max(0, Number(paid) - total);
  async function lookup(raw: string) {
    const q = raw.trim().toUpperCase();
    if (!q || busy || scanning.current) return;
    if (!shopId) return setError("Select a shop before adding phones");
    scanning.current = true;
    setError("");
    try {
      const col = /^\d{15}$/.test(q) ? "imei" : "product_code";
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq(col, q).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Not found: ${q}`);
      const p = data as unknown as ProductRow;
      const problem = saleEligibility(p.status, p.current_shop_id, shopId);
      if (problem) throw new Error(problem);
      setCart(items => { if (items.some(i => i.product.id === p.id)) { setError(`Already in cart: ${p.product_code}`); return items; } return [...items, { product: p, price: String(p.selling_price) }]; });
      setCode("");
      scanRef.current?.focus();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not find phone"); } finally { scanning.current = false; }
  }
  async function complete() {
    setError("");
    if (!shopId) return setError("Select a shop");
    if (!staffCode) return setError("Scan your staff code first");
    try { checkoutTotals(cart.map(i => i.price === "" ? NaN : Number(i.price)), discount === "" ? NaN : Number(discount), paid === "" ? NaN : Number(paid)); } catch (e) { return setError(e instanceof Error ? e.message : "Invalid totals"); }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("complete_cart_sale", { _shop_id: shopId, _staff_code: staffCode, _items: cart.map(i => ({ product_id: i.product.id, price: Number(i.price) })), _discount: Number(discount), _paid: Number(paid), _payment: payment, _customer_name: customer.trim(), _customer_phone: customerPhone.trim() });
      if (error) throw error;
      setReceipt(receiptView(data)); setCart([]);
      await Promise.all(["stock", "dashboard", "sales-list", "receipts", "find-products", "stock-check-products"].map(key => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) { setError(e instanceof Error ? e.message : "Sale was not saved"); } finally { setBusy(false); }
  }
  if (receipt) return <div className="space-y-4"><Receipt receipt={receipt} format={format} /><ReceiptActions format={format} onFormat={setFormat} backLabel="New sale" onBack={() => { setReceipt(null); setPaid(""); setDiscount("0"); setCustomer(""); setCustomerPhone(""); setStaffCode(""); }} /></div>;
  return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h1 className="mr-auto text-2xl font-bold">Sell · {shopName}</h1><ShopSelect /></div>
    <form onSubmit={e => { e.preventDefault(); void lookup(code); }} className="space-y-2 rounded-xl border bg-card p-4 sm:p-6"><Label htmlFor="scan" className="text-lg font-bold">Scan barcode / IMEI</Label><div className="flex gap-2"><Input id="scan" ref={scanRef} value={code} onChange={e => setCode(e.target.value)} placeholder="Product code or IMEI" className="h-14 min-w-0 text-xl" autoComplete="off" autoFocus disabled={busy} /><Button type="submit" className="h-14" disabled={busy || !shopId}>Add to cart</Button></div><CameraScan onScan={c => { void lookup(c); }} /></form>
    {error && <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 font-semibold text-destructive">{error}</p>}
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Phone ({cart.length})</th><th className="p-3">IMEI</th><th className="p-3">Price (¥)</th><th className="p-3"></th></tr></thead><tbody>{!cart.length && <tr><td colSpan={4} className="p-4 text-muted-foreground">Cart is empty</td></tr>}{cart.map(({ product: p, price }) => <tr key={p.id} className="border-t"><td className="p-3">{p.models?.brand} {p.models?.model}<div className="text-xs text-muted-foreground">{p.storage} · {p.color} · {p.product_code}</div></td><td className="p-3 font-mono">{p.imei}</td><td className="p-3"><Input aria-label={`Price ${p.product_code}`} className="w-32" inputMode="numeric" value={price} disabled={busy} onChange={e => setCart(items => items.map(i => i.product.id === p.id ? { ...i, price: e.target.value.replace(/\D/g, "") } : i))} /></td><td className="p-3"><Button title="Remove from cart" aria-label={`Remove ${p.product_code}`} variant="ghost" size="icon" disabled={busy} onClick={() => setCart(items => items.filter(i => i.product.id !== p.id))}><Trash2 className="size-4" /></Button></td></tr>)}</tbody></table></div>
    {cart.length > 0 && <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><StaffScan key={shopId} value={staffCode} onChange={c => setStaffCode(c)} /><F label="Payment"><select aria-label="Payment" className="field" value={payment} onChange={e => setPayment(e.target.value)}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select></F><F label="Customer name (optional)"><Input aria-label="Customer name" maxLength={100} value={customer} onChange={e => setCustomer(e.target.value)} /></F><F label="Customer phone (optional)"><Input aria-label="Customer phone" type="tel" maxLength={50} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></F><F label="Discount (¥)"><Input aria-label="Discount" inputMode="numeric" value={discount} onChange={e => setDiscount(e.target.value.replace(/\D/g, ""))} /></F><F label="Amount received (¥)"><Input aria-label="Amount received" inputMode="numeric" value={paid} onChange={e => setPaid(e.target.value.replace(/\D/g, ""))} /></F></fieldset><div className="space-y-1 text-right"><div>Subtotal: {yen(subtotal)}</div><div>Discount: {yen(Number(discount))}</div><div className="text-2xl font-bold">Total: {yen(total)}</div><div>Change due: {yen(change)}</div></div><Button size="lg" onClick={complete} disabled={busy}>{busy ? "Saving…" : "Complete sale"}</Button></div>}
  </div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
