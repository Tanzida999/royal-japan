import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { meQuery, modelsQuery } from "@/lib/app";
import { pageMeta } from "@/lib/metadata";
import { categoriesQuery, db, type Category, type CategoryKind } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => pageMeta("Categories — Mobile Shop Manager", "Product categories and which category each model belongs to."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!(me?.role === "owner" || me?.manager)) throw redirect({ to: "/home" });
  },
  component: Categories,
});

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: "phone", label: "Phone (IMEI required)" },
  { value: "computer", label: "Computer (serial + specs)" },
  { value: "other", label: "Other (IMEI or serial)" },
];
type ModelRow = { id: string; brand: string; model: string; category_id?: string | null };

function Categories() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: models = [] } = useQuery(modelsQuery);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newCat, setNewCat] = useState({ name: "", kind: "phone" as CategoryKind });
  const [newModel, setNewModel] = useState({ brand: "", model: "", category_id: "" });
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    setMsg(null);
    const { error } = await db.rpc(fn, args);
    if (error) { setMsg({ ok: false, text: error.message }); return false; }
    await Promise.all([qc.invalidateQueries({ queryKey: ["categories"] }), qc.invalidateQueries({ queryKey: ["models"] })]);
    setMsg({ ok: true, text: ok });
    return true;
  }
  const saveCat = (c: Category, patch: Partial<Category>) => {
    const n = { ...c, ...patch };
    return run("save_category", { _id: c.id, _name: n.name, _kind: n.kind, _sort: n.sort, _active: n.active }, `Saved ${n.name}`);
  };
  const saveModel = (m: ModelRow, categoryId: string) => run("save_model", { _id: m.id, _brand: m.brand, _model: m.model, _category_id: categoryId }, `${m.brand} ${m.model} moved`);

  const shownModels = (models as ModelRow[]).filter((m) =>
    (filter === "" || (filter === "none" ? !m.category_id : m.category_id === filter)) &&
    `${m.brand} ${m.model}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categories & Models</h1>
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      {!categories.length && <p className="text-destructive">No categories yet. Run the database update in Supabase first.</p>}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Categories</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left"><tr><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Order</th><th className="p-2">Active</th><th className="p-2 text-right">Models</th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-1"><Input defaultValue={c.name} aria-label="Category name" maxLength={50} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) void saveCat(c, { name: e.target.value.trim() }); }} /></td>
                  <td className="p-1"><select className="field" aria-label="Category type" value={c.kind} onChange={(e) => void saveCat(c, { kind: e.target.value as CategoryKind })}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></td>
                  <td className="p-1"><Input className="w-20" type="number" defaultValue={c.sort} aria-label="Order" onBlur={(e) => { const v = Number(e.target.value); if (v !== c.sort) void saveCat(c, { sort: v }); }} /></td>
                  <td className="p-2"><input type="checkbox" aria-label="Active" checked={c.active} onChange={(e) => void saveCat(c, { active: e.target.checked })} /></td>
                  <td className="p-2 text-right">{(models as ModelRow[]).filter((m) => m.category_id === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="flex flex-wrap gap-2 border-t pt-3" onSubmit={async (e) => { e.preventDefault(); if (await run("save_category", { _id: null, _name: newCat.name, _kind: newCat.kind, _sort: categories.length + 1, _active: true }, `Added ${newCat.name}`)) setNewCat({ name: "", kind: "phone" }); }}>
          <Input className="w-full sm:w-56" placeholder="New category (e.g. Camera)" value={newCat.name} maxLength={50} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <select className="field w-full sm:w-60" aria-label="New category type" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as CategoryKind })}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <Button type="submit" disabled={!newCat.name.trim()}>Add category</Button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Models</h2>
        <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run("save_model", { _id: null, _brand: newModel.brand, _model: newModel.model, _category_id: newModel.category_id || null }, `Added ${newModel.brand} ${newModel.model}`)) setNewModel({ brand: newModel.brand, model: "", category_id: newModel.category_id }); }}>
          <Input className="w-full sm:w-40" placeholder="Brand (e.g. Apple)" value={newModel.brand} maxLength={50} onChange={(e) => setNewModel({ ...newModel, brand: e.target.value })} />
          <Input className="w-full sm:w-56" placeholder="Model (e.g. MacBook Air M3)" value={newModel.model} maxLength={100} onChange={(e) => setNewModel({ ...newModel, model: e.target.value })} />
          <select className="field w-full sm:w-44" aria-label="New model category" value={newModel.category_id} onChange={(e) => setNewModel({ ...newModel, category_id: e.target.value })}>
            <option value="">Pick category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button type="submit" disabled={!newModel.brand.trim() || !newModel.model.trim() || !newModel.category_id}>Add model</Button>
        </form>
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Input className="w-full sm:w-56" placeholder="Search models…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field w-full sm:w-48" aria-label="Filter models by category" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All categories</option>
            <option value="none">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left"><tr><th className="p-2">Brand</th><th className="p-2">Model</th><th className="p-2">Category</th></tr></thead>
            <tbody>
              {shownModels.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.brand}</td>
                  <td className="p-2">{m.model}</td>
                  <td className="p-1">
                    <select className="field" aria-label={`Category of ${m.brand} ${m.model}`} value={m.category_id ?? ""} onChange={(e) => { if (e.target.value) void saveModel(m, e.target.value); }}>
                      <option value="">—</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
