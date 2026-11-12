import { logEvent } from "@/lib/audit";
import { pageMeta } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, meQuery, modelsQuery, shopsQuery } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintLabel, type LabelData } from "@/components/PrintLabel";
import { CameraScan } from "@/components/CameraScan";
import { useCurrentShop } from "@/lib/shop-context";
import { imeiProblem } from "@/lib/pos";
import { StaffScan } from "@/components/StaffScan";
import { validateBulkRows, type BulkRow, SUPPLIER_PAYMENTS } from "@/lib/bulk";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { TrackingFields } from "@/components/TrackingEditor";
import { photoProblem } from "@/lib/product-extras";
import { uploadProductPhotos } from "@/lib/product-photos";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => pageMeta("Add Product — Mobile Shop Manager", "Register individual phones or bulk purchases with verified staff badges."),
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

const emptyRow = (): BulkRow => ({
  model_id: "",
  imei: "",
  color: "",
  storage: "",
  condition: "New",
  purchase_price: "",
  selling_price: "",
});

function AddProduct() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: models = [] } = useQuery(modelsQuery);

  const [bulk, setBulk] = useState(false);
  const { shopId, setShopId, isOwner } = useCurrentShop();
  const imeiRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLSelectElement>(null);
  const bulkImeiRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<string>("New");
  const [purchase, setPurchase] = useState("");
  const [selling, setSelling] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supPay, setSupPay] = useState<string>("Cash");
  const [paid, setPaid] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<LabelData[] | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [rowPhotos, setRowPhotos] = useState<PickedPhoto[][]>([[]]);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [postError, setPostError] = useState("");

  const focusImei = () => setTimeout(() => (bulk ? bulkImeiRefs.current[rows.length - 1] : imeiRef.current)?.focus(), 0);
  useEffect(() => { if (!bulk && !saved && staffCode) imeiRef.current?.focus(); }, [bulk, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (bulk && !saved && staffCode) bulkImeiRefs.current[rows.length - 1]?.focus(); }, [bulk, rows.length, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const brands = useMemo(() => [...new Set(models.map((m) => m.brand))], [models]);
  const brandModels = models.filter((m) => m.brand === brand);

  // Existing IMEIs, for duplicate checks in bulk mode
  const { data: existingImeis = [] } = useQuery({
    queryKey: ["stock", "imeis"],

    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("imei");
      if (error) throw error;
      return data.map((d) => d.imei);
    },
  });
  const existing = new Set(existingImeis);
  const imeiError = imei ? imeiProblem(imei, existing) : "";
  const rowStatus = validateBulkRows(rows, existing).map((st, i) => st !== "OK" ? st : photoProblem(rows[i]!.condition, rowPhotos[i]?.length ?? 0) || "OK");
  const photoError = photoProblem(condition, photos.length);

  function trackingOk() {
    if (tracking.trim() && !carrier) return "Pick a carrier for the tracking number";
    if (tracking.trim() && !/^[A-Za-z0-9-]{4,40}$/.test(tracking.replace(/\s/g, ""))) return "Tracking number looks wrong";
    return "";
  }

  /** Photos + tracking after the product exists; returns problems (product is already saved). */
  async function afterSave(productId: string, blobs: Blob[]) {
    const problems: string[] = [];
    try { await uploadProductPhotos(productId, blobs); } catch (e) { problems.push(e instanceof Error ? e.message : "Photos not saved"); }
    if (tracking.trim()) {
      const { error } = await supabase.rpc("set_product_tracking", { _product_id: productId, _carrier: carrier, _tracking_number: tracking });
      if (error) problems.push(`Tracking not saved: ${error.message}`);
    }
    return problems;
  }

  const modelName = (id: string) => {
    const m = models.find((x) => x.id === id);
    return m ? `${m.brand} ${m.model}` : "";
  };

  function paymentOk() {
    if (supPay === "Partial" && paid === "") return "Enter the paid amount";
    return "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!staffCode) return setError("Scan your staff code first");
    if (imeiError) return setError(imeiError);
    if (photoError) return setError(photoError);
    const te = trackingOk();
    if (te) return setError(te);
    const pe = paymentOk();
    if (pe) return setError(pe);
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
      _staff_code: staffCode,
      _supplier_payment: supPay,
      _paid_amount: supPay === "Partial" ? Number(paid) : (null as unknown as number),
    });
    if (error) {
      setBusy(false);
      return setError(error.message.includes("duplicate") ? "This IMEI or product code already exists" : error.message);
    }
    const problems = await afterSave(data.id, photos.map((x) => x.blob));
    setBusy(false);
    setPostError(problems.length ? `Phone saved, but: ${problems.join("; ")}. Add them from the phone's details page.` : "");
    photos.forEach((x) => URL.revokeObjectURL(x.url));
    setPhotos([]);
    setTracking("");
    setCarrier("");
    setSaved([
      { product_code: data.product_code, model: modelName(v.model_id), storage: v.storage, selling_price: v.selling_price, imei: data.imei, color: data.color, condition: data.condition, purchase_date: jstDate(data.created_at), shop: shops.find(s => s.id === data.shop_id)?.name ?? "" },
    ]);
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setImei("");
    setColor("");
    setPurchase("");
    setSelling("");
    setPaid("");
  }

  async function saveAll() {
    setError("");
    if (!shopId) return setError("Pick a shop");
    if (!staffCode) return setError("Scan your staff code first");
    const pe = paymentOk() || trackingOk();
    if (pe) return setError(pe);
    if (rows.length === 0) return setError("Add at least one phone");
    if (rowStatus.some((s) => s !== "OK")) return setError("Fix every row first — all rows must be OK");
    setBusy(true);
    const items = rows.map((r) => ({
      ...r,
      imei: r.imei.trim(),
      purchase_price: Number(r.purchase_price),
      selling_price: Number(r.selling_price),
    }));
    const { data, error } = await supabase.rpc("add_products_bulk", {
      _shop_id: shopId,
      _supplier: supplier,
      _staff_code: staffCode,
      _supplier_payment: supPay,
      _paid_amount: supPay === "Partial" ? Number(paid) : (null as unknown as number),
      _items: items,
    });
    if (error) { setBusy(false); return setError(`Nothing was saved: ${error.message}`); }
    const problems: string[] = [];
    for (const [i, p] of (data ?? []).entries()) {
      const idx = rows.findIndex((r) => r.imei.trim() === p.imei);
      problems.push(...(await afterSave(p.id, (rowPhotos[idx >= 0 ? idx : i] ?? []).map((x) => x.blob))).map((m) => `${p.product_code}: ${m}`));
    }
    setBusy(false);
    setPostError(problems.length ? `Phones saved, but: ${problems.join("; ")}. Add them from each phone's details page.` : "");
    rowPhotos.flat().forEach((x) => URL.revokeObjectURL(x.url));
    setRowPhotos([[]]);
    setTracking("");
    setCarrier("");
    setSaved(
      (data ?? []).map((p) => ({
        product_code: p.product_code,
        model: modelName(p.model_id),
        storage: p.storage,
        selling_price: p.selling_price, imei: p.imei, color: p.color, condition: p.condition, purchase_date: jstDate(p.created_at), shop: shops.find(s => s.id === p.shop_id)?.name ?? "",
      })),
    );
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setRows([emptyRow()]);
    setPaid("");
  }

  const setRow = (i: number, patch: Partial<BulkRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="no-print">
          <h1 className="text-2xl font-bold">{saved.length > 1 ? `${saved.length} products saved` : "Product saved"}</h1>
          {saved.length === 1 && (
            <p className="text-muted-foreground">
              Product code: <span className="font-mono font-semibold text-foreground">{saved[0]?.product_code}</span>
            </p>
          )}
          {postError && <p role="alert" className="font-semibold text-destructive">{postError}</p>}
        </div>
        {saved.length === 1 && saved[0] ? (
          <PrintLabel data={saved[0]} />
        ) : (
          <div className="print-area labels-sheet flex flex-wrap gap-2">
            {saved.map((l) => (
              <div key={l.product_code} className="labels-sheet-item">
                <PrintLabel data={l} />
              </div>
            ))}
          </div>
        )}
        <div className="no-print flex gap-2">
          <Button onClick={() => { window.print(); for (const l of saved) logEvent("label_printed", "products", l.product_code, { product_code: l.product_code, imei: l.imei }); }}>{saved.length > 1 ? "Print all labels" : "Print Label"}</Button>
          <Button variant="outline" onClick={() => { setSaved(null); setPostError(""); }}>
            Add another
          </Button>
        </div>
      </div>
    );
  }

  const shared = (
    <>
      <Field label="Shop">
        <select aria-label="Purchase shop" className="field" value={shopId} disabled={!isOwner} onChange={(e) => setShopId(e.target.value)}>
          <option value="">Select shop</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Supplier">
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </Field>
      <Field label="Supplier payment">
        <select className="field" value={supPay} onChange={(e) => setSupPay(e.target.value)}>
          {SUPPLIER_PAYMENTS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      {supPay === "Partial" && (
        <Field label={bulk ? "Paid amount for all (¥)" : "Paid amount (¥)"}>
          <Input inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))} />
        </Field>
      )}
      <Field label="Shipping (optional)">
        <TrackingFields carrier={carrier} number={tracking} onCarrier={setCarrier} onNumber={setTracking} />
      </Field>
    </>
  );

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Add Product</h1>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={bulk} onChange={(e) => { setBulk(e.target.checked); setError(""); }} />
          Bulk mode
        </label>
      </div>
      <StaffScan value={staffCode} onChange={(c) => setStaffCode(c)} autoFocus camera errorText="Unknown staff code" onVerified={focusImei} />

      {!bulk ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {shared}
            <Field label="IMEI (scan or type)">
              <Input
                ref={imeiRef}
                aria-label="IMEI"
                inputMode="numeric"
                maxLength={15}
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); brandRef.current?.focus(); } }}
                placeholder="15 digits"
              />
              {imeiError && <p role="alert" className="text-xs text-destructive">{imeiError}</p>}
              <CameraScan onScan={c => { setImei(c.trim()); brandRef.current?.focus(); }} />
            </Field>
            <Field label="Brand">
              <select
                ref={brandRef}
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
            </Field>
            <Field label="Condition">
              <select className="field" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Purchase price (¥)">
              <Input inputMode="numeric" value={purchase} onChange={(e) => setPurchase(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Selling price (¥)">
              <Input inputMode="numeric" value={selling} onChange={(e) => setSelling(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <Field label={`Condition photos (1–6${condition === "Used B" || condition === "Used C" ? ", at least 2 for " + condition : ""})`}>
            <PhotoPicker photos={photos} onChange={setPhotos} />
            {photoError && <p className="text-xs text-destructive">{photoError}</p>}
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || !staffCode || Boolean(imeiError)} className="w-full sm:w-auto">
            {busy ? "Saving…" : "Save Product"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">{shared}</div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Model</th>
                  <th className="p-2">IMEI</th>
                  <th className="p-2">Color</th>
                  <th className="p-2">Storage</th>
                  <th className="p-2">Cond.</th>
                  <th className="p-2">Purchase ¥</th>
                  <th className="p-2">Selling ¥</th>
                  <th className="p-2">Photos</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-1">
                      <select className="field min-w-40" value={r.model_id} onChange={(e) => setRow(i, { model_id: e.target.value })}>
                        <option value="">Select</option>
                        {models.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.model}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <Input
                        ref={el => { bulkImeiRefs.current[i] = el; }}
                        aria-label={`IMEI row ${i + 1}`}
                        className="min-w-40 font-mono"
                        inputMode="numeric"
                        maxLength={15}
                        value={r.imei}
                        onChange={(e) => setRow(i, { imei: e.target.value.replace(/\D/g, "") })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (i === rows.length - 1) setRows((rs) => [...rs, { ...emptyRow(), model_id: r.model_id, color: r.color, storage: r.storage, condition: r.condition, purchase_price: r.purchase_price, selling_price: r.selling_price }]);
                            else bulkImeiRefs.current[i + 1]?.focus();
                          }
                        }}
                      />
                    </td>
                    <td className="p-1"><Input className="min-w-24" value={r.color} onChange={(e) => setRow(i, { color: e.target.value })} /></td>
                    <td className="p-1"><Input className="min-w-20" value={r.storage} list="storage-opts" onChange={(e) => setRow(i, { storage: e.target.value })} /></td>
                    <td className="p-1">
                      <select className="field min-w-24" value={r.condition} onChange={(e) => setRow(i, { condition: e.target.value })}>
                        {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-1"><Input className="min-w-24" inputMode="numeric" value={r.purchase_price} onChange={(e) => setRow(i, { purchase_price: e.target.value.replace(/\D/g, "") })} /></td>
                    <td className="p-1"><Input className="min-w-24" inputMode="numeric" value={r.selling_price} onChange={(e) => setRow(i, { selling_price: e.target.value.replace(/\D/g, "") })} /></td>
                    <td className="p-1"><div className="min-w-32"><PhotoPicker compact photos={rowPhotos[i] ?? []} onChange={(ps) => setRowPhotos((all) => { const next = [...all]; next[i] = ps; return next; })} /></div></td>
                    <td className={`p-2 font-semibold whitespace-nowrap ${rowStatus[i] === "OK" ? "text-primary" : "text-destructive"}`}>
                      {rowStatus[i]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CameraScan onScan={c => setRows(rs => { const i = rs.findIndex(r => !r.imei); return i >= 0 ? rs.map((r,j) => j === i ? { ...r, imei: c.trim() } : r) : [...rs, { ...emptyRow(), imei: c.trim() }]; })} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>Add row</Button>
            <Button variant="outline" disabled={rows.length <= 1} onClick={() => { setRows((rs) => rs.slice(0, -1)); setRowPhotos((all) => { all[rows.length - 1]?.forEach((x) => URL.revokeObjectURL(x.url)); return all.slice(0, rows.length - 1); }); }}>Remove last row</Button>
            <Button onClick={saveAll} disabled={busy || !staffCode}>{busy ? "Saving…" : `Save all (${rows.length})`}</Button>
          </div>
        </div>
      )}
      <datalist id="storage-opts">
        {["64GB", "128GB", "256GB", "512GB", "1TB"].map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
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
