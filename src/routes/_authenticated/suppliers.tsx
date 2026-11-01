import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, jstDateTime, meQuery, yen } from "@/lib/app";
import { useCurrentShop } from "@/lib/shop-context";
import { pageMeta } from "@/lib/metadata";
import { supplierMatches, supplierTotals } from "@/lib/suppliers";
import { ShopSelect } from "@/components/ShopSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => pageMeta("Suppliers — Mobile Shop Manager", "Review supplier purchases, payments and balances by period and shop."),
  beforeLoad: async ({ context }) => { const me = await context.queryClient.ensureQueryData(meQuery); if (me?.role !== "owner") throw redirect({ to: "/sell" }); }, component: Suppliers,
});
type Purchase = { product_id: string; supplier: string | null; purchase_price: number; paid_amount: number | null; supplier_payment: string; created_at: string; products: { product_code: string; imei: string; storage: string; color: string; shop_id: string; models: { brand: string; model: string } | null } | null };
function Suppliers() {
  const { shopId } = useCurrentShop();
  const [year, setYear] = useState(""); const [month, setMonth] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [supplier, setSupplier] = useState<string | null>(null);
  const { data: purchases = [], isLoading, error } = useQuery({ queryKey: ["suppliers"], queryFn: async () => {
    const { data, error } = await supabase.from("product_costs").select("product_id, supplier, purchase_price, paid_amount, supplier_payment, created_at, products(product_code, imei, storage, color, shop_id, models(brand, model))").order("created_at", { ascending: false }); if (error) throw error; return data as unknown as Purchase[];
  } });
  const filters = { year, month, from, to, shopId };
  const filtered = purchases.filter(p => supplierMatches(jstDate(p.created_at), p.products?.shop_id ?? "", filters));
  const data = supplierTotals(filtered);
  const total = data.reduce((a,r) => ({ phones: a.phones+r.phones, bought: a.bought+r.bought, paid: a.paid+r.paid, due: a.due+r.due }), { phones:0,bought:0,paid:0,due:0 });
  const detail = filtered.filter(p => (p.supplier || "(no supplier)") === supplier);
  const batches = new Map<string, Purchase[]>();
  for (const p of detail) { const key = `${p.created_at}|${p.products?.shop_id}|${p.supplier_payment}`; batches.set(key, [...(batches.get(key) ?? []), p]); }
  const years = [...new Set(purchases.map(p => jstDate(p.created_at).slice(0,4)))].sort().reverse();
  return <div className="space-y-4"><div className="flex flex-wrap items-end gap-2"><h1 className="mr-auto text-2xl font-bold">Suppliers</h1><select aria-label="Supplier year" className="field w-32" value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select><select aria-label="Supplier month" className="field w-36" value={month} onChange={e => setMonth(e.target.value)}><option value="">All months</option>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{new Date(2026,i,1).toLocaleString('en',{month:'long'})}</option>)}</select><Input type="date" aria-label="Supplier from date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} /><Input type="date" aria-label="Supplier to date" className="w-40" value={to} onChange={e => setTo(e.target.value)} /><ShopSelect /></div>
  {from && to && from > to && <p role="alert" className="text-destructive">End date must follow start date</p>}{error && <p role="alert" className="text-destructive">Could not load purchases</p>}
  <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-2">Supplier</th><th className="p-2 text-right">Phones</th><th className="p-2 text-right">Total bought</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Still due</th></tr></thead><tbody>{isLoading && <tr><td colSpan={5} className="p-4">Loading…</td></tr>}{data.map(r => <tr key={r.name} className="border-t"><td className="p-2"><Button variant="link" className="h-auto p-0" onClick={() => setSupplier(r.name)}>{r.name}</Button></td><td className="p-2 text-right">{r.phones}</td><td className="p-2 text-right">{yen(r.bought)}</td><td className="p-2 text-right">{yen(r.paid)}</td><td className={`p-2 text-right font-semibold ${r.due > 0 ? 'text-destructive' : ''}`}>{yen(r.due)}</td></tr>)}<tr className="border-t bg-muted font-bold"><td className="p-2">Total</td><td className="p-2 text-right">{total.phones}</td><td className="p-2 text-right">{yen(total.bought)}</td><td className="p-2 text-right">{yen(total.paid)}</td><td className="p-2 text-right">{yen(total.due)}</td></tr></tbody></table></div>
  {supplier !== null && <section className="space-y-3 border-t pt-4"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{supplier} · batches and purchases ({detail.length})</h2><Button variant="outline" onClick={() => setSupplier(null)}>Close</Button></div>{!detail.length && <p className="text-muted-foreground">No purchases in this period.</p>}{[...batches.entries()].map(([key, items]) => <div key={key} className="overflow-x-auto rounded-md border bg-card"><div className="border-b bg-muted p-2 text-sm font-semibold">{jstDateTime(items[0]?.created_at ?? '')} · {items.length} phones · {items[0]?.supplier_payment}</div><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Phone / IMEI</th><th className="p-2 text-right">Bought</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Due</th></tr></thead><tbody>{items.map(p => <tr className="border-t" key={p.product_id}><td className="p-2">{p.products?.models?.brand} {p.products?.models?.model} {p.products?.storage} {p.products?.color}<div className="font-mono text-xs">{p.products?.product_code} · {p.products?.imei}</div></td><td className="p-2 text-right">{yen(p.purchase_price)}</td><td className="p-2 text-right">{yen(p.paid_amount ?? p.purchase_price)}</td><td className="p-2 text-right">{yen(p.purchase_price-(p.paid_amount ?? p.purchase_price))}</td></tr>)}</tbody></table></div>)}</section>}</div>;
}
