import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, meQuery, shopsQuery, yen } from "@/lib/app";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Owner Dashboard — Phone Shop" }] }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: Dashboard,
});

type Stat = { sold: number; revenue: number; profit: number };
const empty = (): Stat => ({ sold: 0, revenue: 0, profit: 0 });

function Dashboard() {
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [sales, products, costs] = await Promise.all([
        supabase.from("sales").select("product_id, sale_price, shop_id, created_at"),
        supabase.from("products").select("id, shop_id, status"),
        supabase.from("product_costs").select("product_id, purchase_price"),
      ]);
      if (sales.error) throw sales.error;
      if (products.error) throw products.error;
      if (costs.error) throw costs.error;
      return { sales: sales.data, products: products.data, costs: costs.data };
    },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const cost = Object.fromEntries(data.costs.map((c) => [c.product_id, c.purchase_price]));
  const today = jstDate(new Date());
  const month = today.slice(0, 7);

  const totals = { today: empty(), month: empty() };
  const byShop: Record<string, { today: Stat; month: Stat; stock: number; stockValue: number }> = {};
  for (const s of shops) byShop[s.id] = { today: empty(), month: empty(), stock: 0, stockValue: 0 };

  for (const s of data.sales) {
    const d = jstDate(s.created_at);
    const profit = s.sale_price - (cost[s.product_id] ?? 0);
    const add = (t: Stat) => {
      t.sold++;
      t.revenue += s.sale_price;
      t.profit += profit;
    };
    if (d === today) {
      add(totals.today);
      const b = byShop[s.shop_id];
      if (b) add(b.today);
    }
    if (d.startsWith(month)) {
      add(totals.month);
      const b = byShop[s.shop_id];
      if (b) add(b.month);
    }
  }
  let stock = 0;
  let stockValue = 0;
  for (const p of data.products) {
    if (p.status !== "in_stock") continue;
    stock++;
    stockValue += cost[p.id] ?? 0;
    const b = byShop[p.shop_id];
    if (b) {
      b.stock++;
      b.stockValue += cost[p.id] ?? 0;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Owner Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Sold today" value={String(totals.today.sold)} />
        <Card title="Revenue today" value={yen(totals.today.revenue)} />
        <Card title="Profit today" value={yen(totals.today.profit)} />
        <Card title="Stock count" value={String(stock)} />
        <Card title="Sold this month" value={String(totals.month.sold)} />
        <Card title="Revenue this month" value={yen(totals.month.revenue)} />
        <Card title="Profit this month" value={yen(totals.month.profit)} />
        <Card title="Stock value (cost)" value={yen(stockValue)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Shop</th>
              <th className="p-2 text-right">Sold today</th>
              <th className="p-2 text-right">Revenue today</th>
              <th className="p-2 text-right">Profit today</th>
              <th className="p-2 text-right">Sold month</th>
              <th className="p-2 text-right">Revenue month</th>
              <th className="p-2 text-right">Profit month</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Stock value</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const r = byShop[s.id];
              if (!r) return null;
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2 text-right">{r.today.sold}</td>
                  <td className="p-2 text-right">{yen(r.today.revenue)}</td>
                  <td className="p-2 text-right">{yen(r.today.profit)}</td>
                  <td className="p-2 text-right">{r.month.sold}</td>
                  <td className="p-2 text-right">{yen(r.month.revenue)}</td>
                  <td className="p-2 text-right">{yen(r.month.profit)}</td>
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
