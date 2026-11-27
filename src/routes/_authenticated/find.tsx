import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Smartphone, Tablet, Laptop, Search, Store, ArrowLeft, Battery } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, yen, jstDate, type ProductRow } from "@/lib/app";
import { categoriesQuery, specsText } from "@/lib/catalog";
import { ProductPhotos } from "@/components/ProductPhotos";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/find")({
  head: () => pageMeta("Find in Other Shops — Mobile Shop Manager", "Find available phones at other shops and request transfers."),
  component: Find,
});

const modelName = (p: ProductRow) => `${p.models?.brand ?? ""} ${p.models?.model ?? ""}`.trim();

function Find() {
  const qc = useQueryClient();
  const { shopId } = useCurrentShop();
  const { data: limit = 24 } = useQuery(settingsQuery);
  const { data: dbCategories = [] } = useQuery(categoriesQuery);
  const [search, setSearch] = useState("");
  const [shop, setShop] = useState("");
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [detail, setDetail] = useState<ProductRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["find-products"],
    refetchInterval: 60_000,
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
      return data.filter((t) => t.status === "accepted" || new Date(t.created_at).getTime() + limit * 3_600_000 > Date.now()).map((t) => t.product_id);
    },
  });

  // Phones in other shops only
  const others = useMemo(() => rows.filter((r) => r.current_shop_id !== shopId), [rows, shopId]);
  const shopList = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const r of others) {
      const g = m.get(r.current_shop_id) ?? { id: r.current_shop_id, name: r.shops?.name ?? "Shop", count: 0 };
      g.count++; m.set(r.current_shop_id, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [others]);
  const inShop = shop ? others.filter((r) => r.current_shop_id === shop) : others;

  const active = dbCategories.filter((c) => c.active);
  const catOf = (p: ProductRow) => p.models?.category_id ?? "";
  const categories = active
    .map((c) => ({ id: c.id, name: c.name, icon: c.kind === "computer" ? Laptop : c.kind === "other" ? Tablet : Smartphone, count: inShop.filter((p) => catOf(p) === c.id).length }))
    .filter((c) => c.count > 0);
  const uncategorised = inShop.filter((p) => !active.some((c) => c.id === catOf(p))).length;

  const q = search.trim().toLowerCase();
  const inCategory = category === "other" ? inShop.filter((p) => !active.some((c) => c.id === catOf(p))) : inShop.filter((p) => catOf(p) === category);
  const modelGroups = Object.values(inCategory.reduce((m, p) => {
    const k = modelName(p);
    const g = m[k] ?? { name: k, model: p.models?.model ?? k, count: 0, min: p.selling_price, shops: new Set<string>() };
    g.count++; g.min = Math.min(g.min, p.selling_price); if (p.shops?.name) g.shops.add(p.shops.name);
    m[k] = g; return m;
  }, {} as Record<string, { name: string; model: string; count: number; min: number; shops: Set<string> }>)).sort((a, b) => a.name.localeCompare(b.name));

  const modelPhones = inCategory.filter((p) => modelName(p) === model);
  const storages = [...new Set(modelPhones.map((p) => p.storage).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
  const phones = q
    ? inShop.filter((r) => [r.imei, r.product_code, modelName(r), r.storage, r.color].join(" ").toLowerCase().includes(q))
    : modelPhones.filter((p) => !storage || p.storage === storage);
  const showPhones = Boolean(q) || Boolean(model);

  async function request(p: ProductRow) {
    setBusy(p.id); setMsg(null);
    const { error } = await supabase.rpc("request_transfer_to_shop", { _product_id: p.id, _to_shop_id: shopId });
    setBusy("");
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Requested ${modelName(p)} (${p.product_code}) from ${p.shops?.name}` });
    qc.invalidateQueries({ queryKey: ["transfers"] });
  }

  const back = () => { if (model) { setModel(""); setStorage(""); } else setCategory(""); };

  return (
    <div className="space-y-4">
      <div className="page-toolbar">
        <h1 className="mr-auto text-2xl font-bold">Find in other shops <span className="text-muted-foreground">({inShop.length})</span></h1>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-12 pl-10 text-base" placeholder="Search model, IMEI or product code…" aria-label="Search other shops" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {shopList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button variant={shop === "" ? "default" : "outline"} className="h-11 shrink-0" onClick={() => setShop("")}><Store />All shops ({others.length})</Button>
          {shopList.map((s) => <Button key={s.id} variant={shop === s.id ? "default" : "outline"} className="h-11 shrink-0" onClick={() => setShop(s.id)}>{s.name} ({s.count})</Button>)}
        </div>
      )}

      {!shopId && <p className="text-sm text-muted-foreground">Your account has no shop, so you can browse but not request.</p>}
      {msg && <p role="status" className={`font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      {isLoading && <p className="py-8 text-center text-muted-foreground">Loading…</p>}

      {!q && !isLoading && (category || model) && (
        <Button variant="ghost" onClick={back}><ArrowLeft />{model ? `${categories.find((c) => c.id === category)?.name ?? "Other"} models · ${model}` : "All categories"}</Button>
      )}

      {/* 1. Categories */}
      {!q && !isLoading && !category && (
        inShop.length === 0 ? <p className="py-8 text-center text-muted-foreground">No phones in other shops right now.</p> :
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((c) => (
            <Button key={c.id} variant="outline" className="h-32 flex-col gap-3 whitespace-normal [&_svg]:size-8" onClick={() => setCategory(c.id)}>
              <c.icon className="text-primary" /><span className="text-base font-semibold">{c.name}</span><span className="text-xs text-muted-foreground">{c.count} available</span>
            </Button>
          ))}
          {uncategorised > 0 && (
            <Button variant="outline" className="h-32 flex-col gap-3 [&_svg]:size-8" onClick={() => setCategory("other")}>
              <Smartphone className="text-primary" /><span className="text-base font-semibold">Other</span><span className="text-xs text-muted-foreground">{uncategorised} available</span>
            </Button>
          )}
        </div>
      )}

      {/* 2. Models */}
      {!q && category && !model && (
        modelGroups.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modelGroups.map((g) => (
              <Button key={g.name} variant="outline" className="h-auto min-h-28 flex-col gap-1 whitespace-normal p-3" onClick={() => setModel(g.name)}>
                <span className="text-base font-semibold">{g.model}</span>
                <span className="text-xs text-muted-foreground">{g.count} available · from {yen(g.min)}</span>
                <span className="text-xs text-primary">{[...g.shops].join(" · ")}</span>
              </Button>
            ))}
          </div>
        ) : <p className="py-8 text-center text-muted-foreground">Nothing available in this category.</p>
      )}

      {/* Storage filter */}
      {!q && model && storages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={storage === "" ? "default" : "outline"} onClick={() => setStorage("")}>All storage</Button>
          {storages.map((s) => <Button key={s} size="sm" variant={storage === s ? "default" : "outline"} className="shrink-0" onClick={() => setStorage(s)}>{s} ({modelPhones.filter((p) => p.storage === s).length})</Button>)}
        </div>
      )}

      {/* 3. Phones */}
      {showPhones && (
        phones.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {phones.map((p) => {
              const requested = open.includes(p.id);
              return (
                <div key={p.id} role="button" tabIndex={0} aria-label={`Details of ${modelName(p)} ${p.product_code}`}
                  onClick={() => setDetail(p)} onKeyDown={(e) => { if (e.key === "Enter") setDetail(p); }}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 transition hover:border-primary hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{modelName(p)}</div>
                      <div className="text-sm text-muted-foreground">{[p.storage, p.color].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{p.shops?.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-0.5">{p.condition}</span>
                    {p.battery_health ? <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Battery className="size-3" />{p.battery_health}%</span> : null}
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{p.product_code}</span>
                  </div>
                  <span className="text-xs font-semibold text-primary">Tap for details & photos →</span>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="text-xl font-bold text-primary">{yen(p.selling_price)}</span>
                    <Button className="h-11" variant={requested ? "outline" : "default"} disabled={requested || !shopId || busy === p.id} onClick={(e) => { e.stopPropagation(); void request(p); }}>
                      {requested ? "Requested" : busy === p.id ? "Requesting…" : "Request to my shop"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="py-8 text-center text-muted-foreground">No phones found{q ? ` for "${search.trim()}"` : ""}.</p>
      )}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && (() => {
            const d = detail; const requested = open.includes(d.id);
            const specs = specsText(d.specs);
            const rows: [string, ReactNode][] = [
              ["Shop", d.shops?.name],
              ["Storage", d.storage], ["Colour", d.color], ["Condition", d.condition],
              ["Battery health", d.battery_health ? `${d.battery_health}%` : "—"],
              ["IMEI / serial", <span className="font-mono">{d.imei}</span>],
              ["Product code", <span className="font-mono">{d.product_code}</span>],
              ...(specs ? [["Specs", specs] as [string, ReactNode]] : []),
              ...(d.carrier || d.tracking_number ? [["Shipping", [d.carrier, d.tracking_number].filter(Boolean).join(" · ")] as [string, ReactNode]] : []),
              ["Added", jstDate(d.created_at)],
            ];
            return (
              <div className="space-y-4">
                <DialogTitle className="text-xl">{modelName(d)}</DialogTitle>
                <ProductPhotos productId={d.id} size="lg" />
                <div className="text-3xl font-bold text-primary">{yen(d.selling_price)}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v || "—"}</dd></Fragment>))}
                </dl>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="h-11" onClick={() => setDetail(null)}>Close</Button>
                  <Button className="h-11" disabled={requested || !shopId || busy === d.id} onClick={() => void request(d)}>
                    {requested ? "Requested" : !shopId ? "Select your shop to request" : busy === d.id ? "Requesting…" : "Request to my shop"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
