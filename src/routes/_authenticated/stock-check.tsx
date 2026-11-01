import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { ShopSelect } from "@/components/ShopSelect";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, PRODUCT_SELECT, shopsQuery, type ProductRow } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/stock-check")({
  head: () => pageMeta("Stock Check — Mobile Shop Manager", "Reconcile scanned shelf phones against current shop inventory."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: StockCheck,
});

type Wrong = { code: string; reason: string };

function StockCheck() {
  const { data: shops = [] } = useQuery(shopsQuery);
  const { shopId: shop, setShopId: setShop } = useCurrentShop();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<Wrong[]>([]);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const { data: all = [] } = useQuery({
    queryKey: ["stock-check-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT);
      if (error) throw error;
      return data as unknown as ProductRow[];
    },
  });

  const expected = all.filter((p) => p.current_shop_id === shop && p.status === "in_stock");
  const transit = all.filter((p) => p.status === "in_transit" && (p.current_shop_id === shop));
  const missing = expected.filter((p) => !found.includes(p.id));
  const name = (p: ProductRow) => `${p.models?.brand} ${p.models?.model} ${p.storage} ${p.color}`;

  function scan(e: React.FormEvent) {
    e.preventDefault();
    const q = code.trim().toUpperCase();
    setCode("");
    if (!q) return;
    const p = all.find((x) => x.product_code === q || x.imei === q);
    if (!p) {
      setWrong((w) => [{ code: q, reason: "Not in system" }, ...w]);
      return setLast({ ok: false, text: `WRONG: ${q} not in system` });
    }
    if (found.includes(p.id)) return setLast({ ok: true, text: `Already scanned: ${p.product_code}` });
    if (p.status === "sold") {
      setWrong((w) => [{ code: p.product_code, reason: `Sold — ${name(p)}` }, ...w]);
      return setLast({ ok: false, text: `WRONG: ${p.product_code} is sold` });
    }
    if (p.status === "in_transit") {
      setWrong((w) => [{ code: p.product_code, reason: `In transit — ${name(p)}` }, ...w]);
      return setLast({ ok: false, text: `WRONG: ${p.product_code} is in transit` });
    }
    if (p.current_shop_id !== shop) {
      setWrong((w) => [{ code: p.product_code, reason: `Belongs to ${p.shops?.name} — ${name(p)}` }, ...w]);
      return setLast({ ok: false, text: `WRONG: ${p.product_code} belongs to ${p.shops?.name}` });
    }
    setFound((f) => [...f, p.id]);
    setLast({ ok: true, text: `FOUND: ${p.product_code} ${name(p)}` });
  }

  function reset(s: string) {
    setShop(s);
    setFound([]);
    setWrong([]);
    setLast(null);
    setTimeout(() => ref.current?.focus(), 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-2xl font-bold">Stock Check</h1>
        <select className="field w-full sm:w-56" value={shop} onChange={(e) => reset(e.target.value)}>
          <option value="">Pick a shop</option>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {shop && <Button variant="outline" onClick={() => reset(shop)}>Start over</Button>}
      </div>

      {shop && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Count title="FOUND" n={found.length} of={expected.length} cls="text-primary" />
            <Count title="MISSING" n={missing.length} cls={missing.length ? "text-destructive" : ""} />
            <Count title="WRONG" n={wrong.length} cls={wrong.length ? "text-destructive" : ""} />
          </div>
          <form onSubmit={scan} className="rounded-xl border bg-card p-4">
            <Label htmlFor="sc" className="text-lg font-bold">Scan phone</Label>
            <Input id="sc" ref={ref} autoFocus autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Product code or IMEI, then Enter" className="mt-2 h-14 text-xl" />
            {last && (
              <p className={`mt-2 text-lg font-semibold ${last.ok ? "text-primary" : "text-destructive"}`}>{last.text}</p>
            )}
          </form>
          <div className="grid gap-4 md:grid-cols-2">
            <List title={`Missing (${missing.length})`} items={missing.map((p) => ({ code: p.product_code, reason: name(p) }))} />
            <List title={`Wrong (${wrong.length})`} items={wrong} />
          </div>
          <List title={`In transit from this shop (${transit.length})`} items={transit.map((p) => ({ code: p.product_code, reason: name(p) }))} />
        </>
      )}
    </div>
  );
}

function Count({ title, n, of, cls = "" }: { title: string; n: number; of?: number; cls?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className={`text-5xl font-bold ${cls}`}>{n}</div>
      {of != null && <div className="text-xs text-muted-foreground">of {of} expected</div>}
    </div>
  );
}

function List({ title, items }: { title: string; items: { code: string; reason: string }[] }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b bg-muted p-2 text-sm font-semibold">{title}</div>
      <ul className="divide-y text-sm">
        {items.length === 0 && <li className="p-2 text-muted-foreground">None</li>}
        {items.map((i, k) => (
          <li key={k} className="p-2">
            <span className="font-mono">{i.code}</span> <span className="text-muted-foreground">{i.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
