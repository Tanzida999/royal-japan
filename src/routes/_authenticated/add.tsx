import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, modelsQuery, shopsQuery } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintLabel, type LabelData } from "@/components/PrintLabel";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => ({ meta: [{ title: "Add Product — Phone Shop" }] }),
  component: AddProduct,
});

const CONDITIONS = ["New", "Used A", "Used B", "Used C"] as const;

const schema = z.object({
  shop_id: z.string().uuid("Pick a shop"),
  model_id: z.string().uuid("Pick a model"),
  imei: z.string().regex(/^\d{15}$/, "IMEI must be exactly 15 digits"),
  color: z.string().trim().min(1, "Color is required").max(50),
  storage: z.string().trim().min(1, "Storage is required").max(20),
  condition: z.enum(CONDITIONS),
  purchase_price: z.number().int().min(0, "Enter purchase price"),
  selling_price: z.number().int().min(0, "Enter selling price"),
  supplier: z.string().trim().max(100),
});

function AddProduct() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: models = [] } = useQuery(modelsQuery);

  const [shopId, setShopId] = useState("");
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<string>("New");
  const [purchase, setPurchase] = useState("");
  const [selling, setSelling] = useState("");
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<LabelData | null>(null);

  useEffect(() => {
    if (!shopId && me?.shop_id) setShopId(me.shop_id);
  }, [me, shopId]);

  const brands = useMemo(() => [...new Set(models.map((m) => m.brand))], [models]);
  const brandModels = models.filter((m) => m.brand === brand);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = schema.safeParse({
      shop_id: shopId,
      model_id: modelId,
      imei: imei.trim(),
      color,
      storage,
      condition,
      purchase_price: purchase === "" ? -1 : Number(purchase),
      selling_price: selling === "" ? -1 : Number(selling),
      supplier,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid input");
    const v = parsed.data;
    setBusy(true);
    const { data, error } = await supabase.rpc("add_product", {
      _shop_id: v.shop_id,
      _model_id: v.model_id,
      _imei: v.imei,
      _color: v.color,
      _storage: v.storage,
      _condition: v.condition,
      _purchase_price: v.purchase_price,
      _selling_price: v.selling_price,
      _supplier: v.supplier,
    });
    setBusy(false);
    if (error) {
      return setError(error.message.includes("duplicate") ? "This IMEI or product code already exists" : error.message);
    }
    const m = models.find((x) => x.id === v.model_id);
    setSaved({
      product_code: data.product_code,
      model: m ? `${m.brand} ${m.model}` : "",
      storage: v.storage,
      selling_price: v.selling_price,
    });
    qc.invalidateQueries({ queryKey: ["stock"] });
    setImei("");
    setColor("");
    setPurchase("");
    setSelling("");
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="no-print">
          <h1 className="text-2xl font-bold">Product saved</h1>
          <p className="text-muted-foreground">
            Product code: <span className="font-mono font-semibold text-foreground">{saved.product_code}</span>
          </p>
        </div>
        <PrintLabel data={saved} />
        <div className="no-print flex gap-2">
          <Button onClick={() => window.print()}>Print Label</Button>
          <Button variant="outline" onClick={() => setSaved(null)}>
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Add Product</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shop">
          <select className="field" value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">Select shop</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="IMEI (scan or type)">
          <Input
            inputMode="numeric"
            maxLength={15}
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="15 digits"
          />
        </Field>
        <Field label="Brand">
          <select
            className="field"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setModelId("");
            }}
          >
            <option value="">Select brand</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <select className="field" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!brand}>
            <option value="">Select model</option>
            {brandModels.map((m) => (
              <option key={m.id} value={m.id}>{m.model}</option>
            ))}
          </select>
        </Field>
        <Field label="Color">
          <Input value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
        <Field label="Storage">
          <Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="e.g. 128GB" list="storage-opts" />
          <datalist id="storage-opts">
            {["64GB", "128GB", "256GB", "512GB", "1TB"].map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Condition">
          <select className="field" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Supplier">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Purchase price (¥)">
          <Input inputMode="numeric" value={purchase} onChange={(e) => setPurchase(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Selling price (¥)">
          <Input inputMode="numeric" value={selling} onChange={(e) => setSelling(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : "Save Product"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
