import { forwardRef, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { db } from "@/lib/catalog";
import { toHalfWidth } from "@/lib/imei-scan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PickerModel = { id: string; brand: string; model: string; sort?: number | null; category_id?: string | null };
type Category = { id: string; name: string; kind?: string; active?: boolean };

const norm = (s: string) => toHalfWidth(s).toLowerCase().replace(/[\s\-_()（）]+/g, "");
const words = (s: string) => toHalfWidth(s).toLowerCase().split(/\s+/).filter(Boolean);

/** Search models by any part: "15 pro", "15pro", "s24", "pixel 9", "xperia 10". Newest models first. */
export function searchModels(models: PickerModel[], query: string, brand = "", limit = 40) {
  const q = query.trim();
  const ws = words(q), compact = norm(q);
  return models
    .filter((m) => !brand || m.brand === brand)
    .map((m) => {
      const full = `${m.brand} ${m.model}`;
      const n = norm(full), nm = norm(m.model);
      let score = 0;
      if (!q) score = 1;
      else if (nm === compact || n === compact) score = 100;
      else if (nm.startsWith(compact)) score = 80;
      else if (n.includes(compact)) score = 60;
      else if (ws.every((w) => n.includes(norm(w)))) score = 40;
      return { m, score, extra: q ? n.length - compact.length : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.extra - b.extra || (b.m.sort ?? 0) - (a.m.sort ?? 0) || a.m.model.localeCompare(b.m.model))
    .slice(0, limit)
    .map((x) => x.m);
}

function guessCategory(categories: Category[], brand: string, model: string, current: string) {
  if (current) return current;
  const t = `${brand} ${model}`.toLowerCase();
  const by = (name: RegExp) => categories.find((c) => name.test(c.name.toLowerCase()))?.id ?? "";
  if (/ipad|tab|pad\b/.test(t)) return by(/tablet|ipad/);
  if (/macbook|thinkpad|laptop|surface|dynabook|vaio|lets ?note/.test(t)) return categories.find((c) => c.kind === "computer")?.id ?? "";
  if (/iphone/.test(t)) return by(/iphone/);
  return by(/android/) || categories[0]?.id || "";
}

type Props = {
  models: PickerModel[];
  categories: Category[];
  categoryId?: string;
  value: string;
  onChange: (m: PickerModel | null) => void;
  highlight?: boolean;
  /** compact = one line with a dropdown (for tables) */
  compact?: boolean;
};

/**
 * Quick model picker for staff: type a few letters or tap a brand, tap the model.
 * If the model is missing, staff can add it right here (it goes into the shared model list).
 */
export const ModelPicker = forwardRef<HTMLInputElement, Props>(function ModelPicker(
  { models, categories, categoryId = "", value, onChange, highlight, compact },
  ref,
) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<{ brand: string; model: string; category: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scoped = useMemo(() => (categoryId ? models.filter((m) => m.category_id === categoryId) : models), [models, categoryId]);
  const brands = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of scoped) count.set(m.brand, (count.get(m.brand) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [scoped]);
  const results = useMemo(() => searchModels(scoped, q, brand, compact ? 12 : 40), [scoped, q, brand, compact]);
  const selected = models.find((m) => m.id === value) ?? null;
  const activeCats = categories.filter((c) => c.active !== false);

  function pick(m: PickerModel) { onChange(m); setQ(""); setOpen(false); setAdding(null); setError(""); }

  function startAdd() {
    const typed = q.trim();
    const known = brands.find((b) => typed.toLowerCase().startsWith(b.toLowerCase() + " "));
    const b = brand || known || "";
    const model = known ? typed.slice(known.length).trim() : typed;
    setAdding({ brand: b, model, category: guessCategory(activeCats, b, model, categoryId) });
    setError("");
  }

  async function saveNew() {
    if (!adding) return;
    setBusy(true); setError("");
    const { data, error: e } = await db.rpc("add_model", { _brand: adding.brand, _model: adding.model, _category_id: adding.category || null });
    setBusy(false);
    if (e) return setError(/add_model/.test(e.message) ? "Ask the owner to run the latest database update first." : e.message);
    await qc.invalidateQueries({ queryKey: ["models"] });
    pick(data as PickerModel);
  }

  const addForm = adding && (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-semibold">Add a new model</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="New model brand" placeholder="Brand (e.g. Apple)" list="model-picker-brands" value={adding.brand} onChange={(e) => setAdding({ ...adding, brand: e.target.value })} />
        <Input aria-label="New model name" placeholder="Model (e.g. iPhone 17 Pro)" value={adding.model} onChange={(e) => setAdding({ ...adding, model: e.target.value })} />
        <select aria-label="New model category" className="field" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>
          <option value="">Category…</option>
          {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <datalist id="model-picker-brands">{[...new Set(models.map((m) => m.brand))].map((b) => <option key={b} value={b} />)}</datalist>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" disabled={busy || !adding.brand.trim() || !adding.model.trim() || !adding.category} onClick={() => void saveNew()}>{busy ? "Saving…" : "Save model"}</Button>
        <Button type="button" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
      </div>
    </div>
  );

  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        aria-label="Search model"
        className={`h-12 pl-9 text-base ${highlight ? "ring-2 ring-amber-400" : ""}`}
        placeholder={selected && compact ? `${selected.brand} ${selected.model}` : "Type the model: 15 pro, s24, pixel 9…"}
        value={q}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => compact && setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setAdding(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); if (results[0] && q.trim()) pick(results[0]); } if (e.key === "Escape") setOpen(false); }}
      />
    </div>
  );

  const noMatch = q.trim() && results.length === 0;
  const addButton = (
    <Button type="button" variant={noMatch ? "default" : "outline"} className="h-auto min-h-12 justify-start whitespace-normal text-left" onMouseDown={(e) => e.preventDefault()} onClick={startAdd}>
      <Plus /> {q.trim() ? `Model not here? Add "${q.trim()}"` : "Model not in the list? Add it"}
    </Button>
  );

  if (compact) {
    return (
      <div className="relative min-w-48">
        {searchBox}
        {open && !adding && (
          <div className="absolute z-30 mt-1 max-h-72 w-72 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
            {results.map((m) => (
              <button key={m.id} type="button" className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted ${m.id === value ? "bg-primary/10 font-semibold" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
                {m.model} <span className="text-xs text-muted-foreground">{m.brand}</span>
              </button>
            ))}
            {noMatch && <p className="px-2 py-1 text-xs text-muted-foreground">No model found.</p>}
            <div className="p-1">{addButton}</div>
          </div>
        )}
        {adding && <div className="absolute z-30 mt-1 w-[min(36rem,90vw)] rounded-md bg-popover shadow-lg">{addForm}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selected && !open ? (
        <div className={`flex items-center gap-2 rounded-lg border bg-card p-3 ${highlight ? "ring-2 ring-amber-400" : ""}`}>
          <div className="mr-auto">
            <div className="text-xs text-muted-foreground">{selected.brand}</div>
            <div className="text-lg font-semibold">{selected.model}</div>
          </div>
          <Button type="button" variant="outline" onClick={() => { setOpen(true); setBrand(selected.brand); }}>Change</Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Clear model" onClick={() => { onChange(null); setOpen(true); }}><X /></Button>
        </div>
      ) : (
        <>
          {searchBox}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button type="button" size="sm" variant={brand === "" ? "default" : "outline"} onClick={() => setBrand("")}>All</Button>
            {brands.map((b) => <Button key={b} type="button" size="sm" variant={brand === b ? "default" : "outline"} className="shrink-0" onClick={() => setBrand(brand === b ? "" : b)}>{b}</Button>)}
          </div>
          {adding ? addForm : (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {results.map((m) => (
                <Button key={m.id} type="button" variant="outline" className={`h-auto min-h-14 flex-col items-start justify-center gap-0 whitespace-normal p-2 text-left ${m.id === value ? "border-primary bg-primary/10" : ""}`} onClick={() => pick(m)}>
                  <span className="text-sm font-semibold leading-tight">{m.model}</span>
                  <span className="text-xs text-muted-foreground">{m.brand}</span>
                </Button>
              ))}
              <div className="col-span-2 sm:col-span-3">{addButton}</div>
            </div>
          )}
          {selected && <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Keep {selected.brand} {selected.model}</Button>}
        </>
      )}
    </div>
  );
});
