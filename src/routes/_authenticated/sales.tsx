import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, jstDateTime, meQuery, shopsQuery, yen } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, type ReceiptData } from "@/components/Receipt";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — Phone Shop" }] }),
  component: Sales,
});

type SaleRow = {
  id: string;
  receipt_no: string;
  product_id: string;
  sale_price: number;
  customer_name: string | null;
  payment: string;
  shop_id: string;
  sold_by: string;
  staff_code: string | null;
  created_at: string;
  shops: { name: string } | null;
  products: {
    product_code: string;
    imei: string;
    color: string;
    storage: string;
    condition: string;
    models: { brand: string; model: string } | null;
  } | null;
};

function Sales() {
  const { data: me } = useQuery(meQuery);
  const isOwner = me?.role === "owner";
  const { data: shops = [] } = useQuery(shopsQuery);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shop, setShop] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Database only returns the staff member's own shop sales.
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, receipt_no, product_id, sale_price, customer_name, payment, shop_id, sold_by, staff_code, created_at, shops(name), products(product_code, imei, color, storage, condition, models(brand, model))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as SaleRow[];
    },
  });
  const { data: people = {} } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name, staff_code");
      const m: Record<string, string> = {};
      for (const p of data ?? []) {
        m[p.id] = p.name;
        m[p.staff_code] = p.name;
      }
      return m;
    },
  });
  const { data: costs = {} } = useQuery({
    queryKey: ["stock-costs"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_costs").select("product_id, purchase_price");
      if (error) throw error;
      return Object.fromEntries(data.map((c) => [c.product_id, c.purchase_price])) as Record<string, number>;
    },
  });

  const staffName = (r: SaleRow) => (r.staff_code && people[r.staff_code]) || people[r.sold_by] || "";
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const d = jstDate(r.created_at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (shop && r.shop_id !== shop) return false;
    if (!q) return true;
    const p = r.products;
    return [r.receipt_no, r.customer_name, p?.product_code, p?.imei, p?.models?.brand, p?.models?.model, staffName(r)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (receipt) {
    return (
      <div className="space-y-4">
        <Receipt receipt={receipt} />
        <div className="no-print flex justify-center gap-2">
          <Button onClick={() => window.print()}>Print</Button>
          <Button variant="outline" onClick={() => setReceipt(null)}>Back to sales</Button>
        </div>
      </div>
    );
  }

  const total = filtered.reduce((a, r) => a + r.sale_price, 0);
  const profit = filtered.reduce((a, r) => a + r.sale_price - (costs[r.product_id] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-2xl font-bold">Sales ({filtered.length})</h1>
        <Input className="w-full sm:w-56" placeholder="Search receipt, IMEI, customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input type="date" className="w-full sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" className="w-full sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        {isOwner && (
          <select className="field w-full sm:w-48" value={shop} onChange={(e) => setShop(e.target.value)}>
            <option value="">All shops</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        Total: <span className="font-semibold text-foreground">{yen(total)}</span>
        {isOwner && <> · Profit: <span className="font-semibold text-foreground">{yen(profit)}</span></>}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Receipt</th>
              <th className="p-2">Date</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Shop</th>
              <th className="p-2">Staff</th>
              <th className="p-2">Payment</th>
              <th className="p-2 text-right">Price</th>
              {isOwner && <th className="p-2 text-right">Profit</th>}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={9}>Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={9}>No sales.</td></tr>}
            {filtered.map((r) => {
              const p = r.products;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono">{r.receipt_no}</td>
                  <td className="p-2 whitespace-nowrap">{jstDateTime(r.created_at)}</td>
                  <td className="p-2">
                    {p?.models?.brand} {p?.models?.model} {p?.storage}
                    <div className="font-mono text-xs text-muted-foreground">{p?.product_code} · {p?.imei}</div>
                  </td>
                  <td className="p-2">{r.shops?.name}</td>
                  <td className="p-2">{staffName(r)}</td>
                  <td className="p-2">{r.payment}</td>
                  <td className="p-2 text-right">{yen(r.sale_price)}</td>
                  {isOwner && <td className="p-2 text-right">{costs[r.product_id] != null ? yen(r.sale_price - costs[r.product_id]) : "—"}</td>}
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setReceipt({
                          shop: r.shops?.name ?? "",
                          receipt_no: r.receipt_no,
                          date: jstDateTime(r.created_at),
                          item: `${p?.models?.brand} ${p?.models?.model} ${p?.storage} ${p?.color} (${p?.condition})`,
                          imei: p?.imei ?? "",
                          price: r.sale_price,
                          payment: r.payment,
                          customer: r.customer_name ?? "",
                          staff: staffName(r),
                        })
                      }
                    >
                      Reprint receipt
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
