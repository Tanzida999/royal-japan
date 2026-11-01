import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { ShopSelect } from "@/components/ShopSelect";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, PRODUCT_SELECT, yen, type ProductRow } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/find")({
  head: () => pageMeta("Find in Other Shops — Mobile Shop Manager", "Find available phones at other shops and request transfers."),
  component: Find,
});

function Find() {
  const qc = useQueryClient();
  const { shopId } = useCurrentShop();
  const { data: limit = 24 } = useQuery(settingsQuery);
  const { data: me } = useQuery(meQuery);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["find-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "in_stock").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProductRow[];
    },
  });
  const { data: open = [] } = useQuery({
    queryKey: ["transfers", "open", limit],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("transfers").select("product_id, status, created_at").in("status", ["requested", "accepted"]);
      if (error) throw error;
      return data.filter(t => t.status === "accepted" || new Date(t.created_at).getTime() + limit * 3_600_000 > Date.now()).map((t) => t.product_id);
    },
  });

  const q = search.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      r.current_shop_id !== shopId &&
      (!q || [r.imei, r.product_code, r.models?.brand, r.models?.model].join(" ").toLowerCase().includes(q)),
  );

  async function request(p: ProductRow) {
    setBusy(p.id);
    setMsg(null);
    const { error } = await supabase.rpc("request_transfer_to_shop", { _product_id: p.id, _to_shop_id: shopId });
    setBusy("");
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Requested ${p.product_code} from ${p.shops?.name}` });
    qc.invalidateQueries({ queryKey: ["transfers"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-2xl font-bold">Find in other shops ({list.length})</h1>
        <Input className="w-full sm:w-72" placeholder="Search model or IMEI…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!shopId && <p className="text-sm text-muted-foreground">Your account has no shop, so you can browse but not request.</p>}
      {msg && <p className={`font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
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
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={8}>Loading…</td></tr>}
            {!isLoading && list.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={8}>No phones found.</td></tr>}
            {list.map((r) => {
              const requested = open.includes(r.id);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono">{r.product_code}<div className="text-xs text-muted-foreground">{r.imei}</div></td>
                  <td className="p-2">{r.models?.brand} {r.models?.model}</td>
                  <td className="p-2">{r.storage}</td>
                  <td className="p-2">{r.color}</td>
                  <td className="p-2">{r.condition}</td>
                  <td className="p-2">{r.shops?.name}</td>
                  <td className="p-2 text-right">{yen(r.selling_price)}</td>
                  <td className="p-2">
                    <Button size="sm" variant="outline" disabled={requested || !shopId || busy === r.id} onClick={() => request(r)}>
                      {requested ? "Requested" : "Request"}
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
