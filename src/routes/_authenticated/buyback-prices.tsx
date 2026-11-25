import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { meQuery, modelsQuery, yen } from "@/lib/app";
import { pageMeta } from "@/lib/metadata";
import { categoriesQuery, db, PHONE_STORAGE, COMPUTER_DISK } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/buyback-prices")({
  head: () => pageMeta("Buyback Prices — Mobile Shop Manager", "Buyback prices shown live on kaitorinihon.jp."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!(me?.role === "owner" || me?.manager)) throw redirect({ to: "/home" });
  },
  component: BuybackPrices,
});

const GRADES = [
  { value: "unused", label: "未使用 Unused" },
  { value: "used_a", label: "中古A" },
  { value: "used_b", label: "中古B" },
  { value: "used_c", label: "中古C" },
  { value: "junk", label: "ジャンク Junk" },
] as const;
type Price = { id: string; model_id: string; storage: string; grade: string; price: number; active: boolean; updated_at: string };
type ModelRow = { id: string; brand: string; model: string; category_id?: string | null };

function BuybackPrices() {
  const qc = useQueryClient();
  const { data: models = [] } = useQuery(modelsQuery);
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: prices = [], error } = useQuery({
    queryKey: ["buyback-prices"],
    queryFn: async () => {
      const { data, error } = await db.from("buyback_prices").select("id, model_id, storage, grade, price, active, updated_at");
      if (error) throw error;
      return (data ?? []) as Price[];
    },
  });
  const [category, setCategory] = useState("");
  const [modelId, setModelId] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const list = (models as ModelRow[]).filter((m) => (!category || m.category_id === category) && `${m.brand} ${m.model}`.toLowerCase().includes(search.trim().toLowerCase()));
  const model = (models as ModelRow[]).find((m) => m.id === modelId);
  const isComputer = categories.find((c) => c.id === model?.category_id)?.kind === "computer";
  const priced = prices.filter((p) => p.model_id === modelId);
  const storages = useMemo(() => {
    const base = isComputer ? COMPUTER_DISK : PHONE_STORAGE;
    return [...new Set([...base, ...priced.map((p) => p.storage)])].filter((s) => s !== "" || priced.some((p) => p.storage === ""));
  }, [isComputer, priced]);
  const key = (s: string, g: string) => `${s}|${g}`;
  const current = (s: string, g: string) => priced.find((p) => p.storage === s && p.grade === g && p.active);
  const changed = Object.entries(draft).filter(([k, v]) => {
    const [s, g] = k.split("|"); const c = current(s!, g!);
    return v === "" ? Boolean(c) : Number(v) !== c?.price;
  });

  async function save() {
    if (!modelId) return;
    setBusy(true); setMsg(null);
    for (const [k, v] of changed) {
      const [s, g] = k.split("|");
      const c = current(s!, g!);
      const { error } = await db.rpc("set_buyback_price", { _model_id: modelId, _storage: s, _grade: g, _price: v === "" ? (c?.price ?? 0) : Number(v), _active: v !== "" });
      if (error) { setBusy(false); return setMsg({ ok: false, text: error.message }); }
    }
    await qc.invalidateQueries({ queryKey: ["buyback-prices"] });
    setDraft({}); setBusy(false);
    setMsg({ ok: true, text: `Saved ${changed.length} price${changed.length === 1 ? "" : "s"}. The website shows them now.` });
  }

  const pricedModels = new Map<string, number>();
  for (const p of prices) if (p.active) pricedModels.set(p.model_id, (pricedModels.get(p.model_id) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buyback Prices (kaitorinihon.jp)</h1>
      <p className="text-sm text-muted-foreground">Prices you save here appear on the website immediately. Leave a box empty to hide that price.</p>
      {error && <p role="alert" className="text-destructive">Could not load prices. Run the website database update first.</p>}
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <select className="field" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Input placeholder="Search model…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[60vh] overflow-auto">
            {list.map((m) => (
              <button key={m.id} type="button" onClick={() => { setModelId(m.id); setDraft({}); setMsg(null); }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${m.id === modelId ? "bg-primary/10 font-semibold" : ""}`}>
                <span>{m.brand} {m.model}</span>
                {pricedModels.get(m.id) ? <span className="text-xs text-primary">{pricedModels.get(m.id)} prices</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3">
          {!model ? <p className="p-4 text-muted-foreground">Pick a model on the left.</p> : (
            <div className="space-y-3">
              <h2 className="font-semibold">{model.brand} {model.model}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left"><th className="p-2">Storage</th>{GRADES.map((g) => <th key={g.value} className="p-2">{g.label}</th>)}</tr></thead>
                  <tbody>
                    {storages.map((s) => (
                      <tr key={s || "none"} className="border-t">
                        <td className="p-2 font-medium">{s || "—"}</td>
                        {GRADES.map((g) => {
                          const k = key(s, g.value); const c = current(s, g.value);
                          return (
                            <td key={g.value} className="p-1">
                              <Input aria-label={`${s} ${g.label} price`} inputMode="numeric" className="min-w-24" placeholder="—"
                                value={draft[k] ?? (c ? String(c.price) : "")}
                                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/\D/g, "") }))} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={busy || !changed.length} onClick={() => void save()}>{busy ? "Saving…" : `Save ${changed.length || ""} change${changed.length === 1 ? "" : "s"}`}</Button>
                {priced.length > 0 && <span className="text-xs text-muted-foreground">Last updated {new Date(Math.max(...priced.map((p) => +new Date(p.updated_at)))).toLocaleString("ja-JP")}</span>}
              </div>
              {priced.filter((p) => p.active).length > 0 && (
                <p className="text-xs text-muted-foreground">On the website: {priced.filter((p) => p.active).map((p) => `${p.storage} ${GRADES.find((g) => g.value === p.grade)?.label.split(" ")[0]} ${yen(p.price)}`).join(" · ")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
