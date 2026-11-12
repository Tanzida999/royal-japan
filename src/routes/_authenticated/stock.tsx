import { logEvent } from "@/lib/audit";
import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { ShopSelect } from "@/components/ShopSelect";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, meQuery, PRODUCT_SELECT, shopsQuery, yen, type ProductRow } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintLabel, type LabelData } from "@/components/PrintLabel";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => pageMeta("Stock — Mobile Shop Manager", "View available and in-transit phone inventory at the current shop."),
  component: Stock,
});

function Stock() {
  const { data: me } = useQuery(meQuery);
  const isOwner = me?.role === "owner";
  const { data: shops = [] } = useQuery(shopsQuery);
  const [search, setSearch] = useState("");
  const { shopId: shop } = useCurrentShop();
  const [hasTracking, setHasTracking] = useState(false);
  const [label, setLabel] = useState<LabelData | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("status", ["in_stock", "in_transit"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProductRow[];
    },
  });

  // Costs are only readable by owners (enforced in the database); staff get nothing back.
  const { data: costs = {} } = useQuery({
    queryKey: ["stock-costs"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_costs").select("product_id, purchase_price");
      if (error) throw error;
      return Object.fromEntries(data.map((c) => [c.product_id, c.purchase_price])) as Record<string, number>;
    },
  });

  const q = search.trim().toLowerCase();
  const matches = rows.filter(
    (r) =>
      (!shop || r.current_shop_id === shop) &&
      (!hasTracking || Boolean(r.tracking_number)) &&
      (!q ||
        [r.product_code, r.imei, r.models?.brand, r.models?.model, r.color, r.storage]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  const filtered = matches.filter((r) => r.status === "in_stock");
  const transit = matches.filter((r) => r.status === "in_transit");

  if (label) {
    return (
      <div className="space-y-4">
        <PrintLabel data={label} />
        <div className="no-print flex gap-2">
          <Button onClick={() => { window.print(); logEvent("label_printed", "products", label.product_code, { product_code: label.product_code, imei: label.imei }); }}>Print Label</Button>
          <Button variant="outline" onClick={() => setLabel(null)}>Back to stock</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-2xl font-bold">Stock ({filtered.length})</h1>
        <Input className="w-full sm:w-64" placeholder="Search code, IMEI, model…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={hasTracking} onChange={(e) => setHasTracking(e.target.checked)} />Has tracking</label>
        <ShopSelect />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Code</th>
              <th className="p-2">Model</th>
              <th className="p-2">Storage</th>
              <th className="p-2">Color</th>
              <th className="p-2">Cond.</th>
              <th className="p-2">Shop</th>
              <th className="p-2 text-right">Price</th>
              {isOwner && <th className="p-2 text-right">Cost</th>}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="p-4 text-muted-foreground" colSpan={9}>Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={9}>No phones in stock.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono">
                  <Link to="/product/$id" params={{ id: r.id }} className="text-primary underline-offset-2 hover:underline">{r.product_code}</Link>
                  {r.tracking_number && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 font-sans text-xs font-semibold">Shipping</span>}
                  <div className="text-xs text-muted-foreground">{r.imei}</div>
                </td>
                <td className="p-2">{r.models?.brand} {r.models?.model}</td>
                <td className="p-2">{r.storage}</td>
                <td className="p-2">{r.color}</td>
                <td className="p-2">{r.condition}</td>
                <td className="p-2">{r.shops?.name}</td>
                <td className="p-2 text-right">{yen(r.selling_price)}</td>
                {isOwner && <td className="p-2 text-right">{costs[r.id] != null ? yen(costs[r.id]) : "—"}</td>}
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setLabel({
                        product_code: r.product_code,
                        model: `${r.models?.brand} ${r.models?.model}`,
                        storage: r.storage,
                        selling_price: r.selling_price, imei: r.imei, color: r.color, condition: r.condition, purchase_date: jstDate(r.created_at), shop: r.shops?.name ?? "",
                      })
                    }
                  >
                    Label
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transit.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="border-b bg-muted p-2 text-sm font-semibold">In transit ({transit.length}) — cannot be sold</div>
          <table className="w-full text-sm">
            <tbody>
              {transit.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono"><Link to="/product/$id" params={{ id: r.id }} className="text-primary underline-offset-2 hover:underline">{r.product_code}</Link>{r.tracking_number && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 font-sans text-xs font-semibold">Shipping</span>}<div className="text-xs text-muted-foreground">{r.imei}</div></td>
                  <td className="p-2">{r.models?.brand} {r.models?.model}</td>
                  <td className="p-2">{r.storage}</td>
                  <td className="p-2">{r.color}</td>
                  <td className="p-2">From {r.shops?.name}</td>
                  <td className="p-2 text-right">{yen(r.selling_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
