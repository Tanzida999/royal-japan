import { SecurityAlerts } from "@/components/SecurityAlerts";
import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { ShopSelect } from "@/components/ShopSelect";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { TrackButton } from "@/components/TrackingEditor";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, meQuery, shopsQuery, yen } from "@/lib/app";
import { buildAlerts } from "@/lib/alerts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta("Owner Dashboard — Mobile Shop Manager", "Track shop stock, sales, profits and overdue transfer alerts."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: Dashboard,
});

type Stat = { sold: number; revenue: number; profit: number };
const empty = (): Stat => ({ sold: 0, revenue: 0, profit: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Dashboard() {
  const { data: shops = [] } = useQuery(shopsQuery);
  const today = jstDate(new Date());
  const [year, setYear] = useState(today.slice(0, 4));
  const [monthSel, setMonthSel] = useState(today.slice(5, 7));
  const { shopId: shopSel } = useCurrentShop();
  const { data: transitLimit = 24 } = useQuery(settingsQuery);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [sales, products, costs, transfers] = await Promise.all([
        supabase.from("sales").select("receipt_no, product_id, sale_price, shop_id, created_at"),
        supabase.from("products").select("id, product_code, shop_id, current_shop_id, status, created_at, storage, carrier, tracking_number, models(brand, model)"),
        supabase.from("product_costs").select("product_id, purchase_price"),
        supabase.from("transfers").select("product_id, from_shop_id, to_shop_id, status, accepted_at, reject_reason"),
      ]);
      if (transfers.error) throw transfers.error;
      if (sales.error) throw sales.error;
      if (products.error) throw products.error;
      if (costs.error) throw costs.error;
      return { sales: sales.data, products: products.data, costs: costs.data, transfers: transfers.data };
    },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const cost = Object.fromEntries(data.costs.map((c) => [c.product_id, c.purchase_price]));
  const period = monthSel ? `${year}-${monthSel}` : year;
  const periodLabel = monthSel ? `${MONTHS[Number(monthSel) - 1]} ${year}` : year;
  const years = [...new Set([today.slice(0, 4), ...data.sales.map((s) => jstDate(s.created_at).slice(0, 4))])].sort().reverse();
  const inShop = (id: string) => !shopSel || id === shopSel;

  const totals = { today: empty(), period: empty() };
  const byShop: Record<string, { today: Stat; period: Stat; stock: number; stockValue: number }> = {};
  for (const s of shops) byShop[s.id] = { today: empty(), period: empty(), stock: 0, stockValue: 0 };

  for (const s of data.sales) {
    const d = jstDate(s.created_at);
    const profit = s.sale_price - (cost[s.product_id] ?? 0);
    const add = (t: Stat) => {
      t.sold++;
      t.revenue += s.sale_price;
      t.profit += profit;
    };
    const b = byShop[s.shop_id];
    if (d === today) {
      if (inShop(s.shop_id)) add(totals.today);
      if (b) add(b.today);
    }
    if (d.startsWith(period)) {
      if (inShop(s.shop_id)) add(totals.period);
      if (b) add(b.period);
    }
  }
  let stock = 0;
  let stockValue = 0;
  for (const p of data.products) {
    if (p.status !== "in_stock") continue;
    if (inShop(p.current_shop_id ?? p.shop_id)) {
      stock++;
      stockValue += cost[p.id] ?? 0;
    }
    const b = byShop[p.current_shop_id ?? p.shop_id];
    if (b) {
      b.stock++;
      b.stockValue += cost[p.id] ?? 0;
    }
  }

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "?";
  const alerts = buildAlerts({
    sales: data.sales,
    products: data.products.map((p) => ({
      ...p,
      name: `${p.models?.brand ?? ""} ${p.models?.model ?? ""} ${p.storage}`.trim(),
    })),
    cost,
    transfers: data.transfers,
    now: new Date(),
    transitLimit,
  }).filter((a) => !shopSel || a.shopIds.includes(shopSel));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-2xl font-bold">Owner Dashboard</h1>
        <select className="field w-28" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="field w-32" value={monthSel} onChange={(e) => setMonthSel(e.target.value)} aria-label="Month">
          <option value="">Whole year</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
        </select>
        <ShopSelect />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Sold today" value={String(totals.today.sold)} />
        <Card title="Revenue today" value={yen(totals.today.revenue)} />
        <Card title="Profit today" value={yen(totals.today.profit)} />
        <Card title="Stock count" value={String(stock)} />
        <Card title={`Sold ${periodLabel}`} value={String(totals.period.sold)} />
        <Card title={`Revenue ${periodLabel}`} value={yen(totals.period.revenue)} />
        <Card title={`Profit ${periodLabel}`} value={yen(totals.period.profit)} />
        <Card title="Stock value (cost)" value={yen(stockValue)} />
      </div>

      {(() => {
        const shipping = data.products.filter((p) => p.tracking_number && p.status !== "in_stock" && (inShop(p.current_shop_id ?? p.shop_id) || inShop(p.shop_id)));
        return (
          <div className="rounded-xl border bg-card">
            <div className="border-b p-3 font-semibold">Shipping — not yet in stock ({shipping.length})</div>
            {shipping.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No phones being shipped.</p> : (
              <ul className="divide-y text-sm">
                {shipping.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 p-3">
                    <Link to="/product/$id" params={{ id: p.id }} className="font-mono text-primary">{p.product_code}</Link>
                    <span>{p.models?.brand} {p.models?.model} {p.storage}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{p.status}</span>
                    <span className="mr-auto text-muted-foreground">{p.carrier} {p.tracking_number}</span>
                    <TrackButton carrier={p.carrier} number={p.tracking_number} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      <div className="rounded-xl border bg-card">
        <div className="border-b p-3 font-semibold">Alerts ({alerts.length})</div>
        {alerts.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No alerts.</p>
        ) : (
          <ul className="divide-y text-sm">
            {alerts.map((a, i) => (
              <li key={i} className="flex flex-wrap gap-2 p-3">
                <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{a.kind}</span>
                <span className="font-mono">{a.code}</span>
                <span className="text-muted-foreground">
                  {a.text}
                  {a.kind === "Different shop" && ` (bought for ${shopName(a.shopIds[0] ?? "")}, sold at ${shopName(a.shopIds[1] ?? "")})`}
                  {(a.kind === "In transit 24h+" || a.kind === "Transfer overdue" || a.kind === "Transfer rejected") && ` (${shopName(a.shopIds[0] ?? "")} → ${shopName(a.shopIds[1] ?? "")})`}
                  {["Below cost", "Old stock"].includes(a.kind) && ` · ${shopName(a.shopIds[0] ?? "")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SecurityAlerts />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Shop</th>
              <th className="p-2 text-right">Sold today</th>
              <th className="p-2 text-right">Revenue today</th>
              <th className="p-2 text-right">Profit today</th>
              <th className="p-2 text-right">Sold {periodLabel}</th>
              <th className="p-2 text-right">Revenue {periodLabel}</th>
              <th className="p-2 text-right">Profit {periodLabel}</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Stock value</th>
            </tr>
          </thead>
          <tbody>
            {shops.filter((s) => inShop(s.id)).map((s) => {
              const r = byShop[s.id];
              if (!r) return null;
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2 text-right">{r.today.sold}</td>
                  <td className="p-2 text-right">{yen(r.today.revenue)}</td>
                  <td className="p-2 text-right">{yen(r.today.profit)}</td>
                  <td className="p-2 text-right">{r.period.sold}</td>
                  <td className="p-2 text-right">{yen(r.period.revenue)}</td>
                  <td className="p-2 text-right">{yen(r.period.profit)}</td>
                  <td className="p-2 text-right">{r.stock}</td>
                  <td className="p-2 text-right">{yen(r.stockValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
