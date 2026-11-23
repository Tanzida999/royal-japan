import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { modelsQuery, type ProductRow } from "@/lib/app";
import { db, PHONE_COLORS, PHONE_STORAGE, COMPUTER_DISK, BATTERY_OPTIONS } from "@/lib/catalog";
import { toHalfWidth } from "@/lib/imei-scan";
import { ColorSelect, OptionSelect } from "@/components/ProductFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const CONDITIONS = ["New", "Used A", "Used B", "Used C"];

/** Fix wrong details of a product (model, colour, storage, IMEI, price, battery). Changes are logged. */
export function EditProduct({ product, onClose, onSaved }: { product: ProductRow; onClose: () => void; onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data: models = [] } = useQuery(modelsQuery);
  const current = models.find((m) => m.id === product.model_id);
  const [brand, setBrand] = useState(current?.brand ?? product.models?.brand ?? "");
  const [modelId, setModelId] = useState(product.model_id ?? "");
  const [imei, setImei] = useState(product.imei);
  const [color, setColor] = useState(product.color ?? "");
  const [storage, setStorage] = useState(product.storage ?? "");
  const [condition, setCondition] = useState(product.condition ?? "New");
  const [price, setPrice] = useState(String(product.selling_price ?? ""));
  const [battery, setBattery] = useState(product.battery_health ? String(product.battery_health) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const brands = [...new Set(models.map((m) => m.brand))];
  const isComputer = /^[A-Z]/i.test(product.imei) && !/^\d{15}$/.test(product.imei);

  async function save() {
    setBusy(true); setError("");
    const { error } = await db.rpc("update_product_details", {
      _id: product.id, _imei: imei, _model_id: modelId, _color: color, _storage: storage,
      _condition: condition, _selling_price: Number(price), _battery: battery ? Number(battery) : null,
    });
    setBusy(false);
    if (error) return setError(error.message.includes("update_product_details") ? "Ask the owner to run the latest database update." : error.message);
    await Promise.all(["product", "stock", "register", "product-extra", "find-products"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    onSaved?.();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit product {product.product_code}</DialogTitle>
        <label className="space-y-1 text-sm">IMEI / serial
          <Input value={imei} maxLength={40} autoComplete="off" onChange={(e) => setImei(toHalfWidth(e.target.value).toUpperCase().replace(/[^A-Z0-9-]/g, ""))} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">Brand
            <select className="field" value={brand} onChange={(e) => { setBrand(e.target.value); setModelId(""); }}>
              <option value="">Select</option>
              {brands.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Model
            <select className="field" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">Select</option>
              {models.filter((m) => m.brand === brand).map((m) => <option key={m.id} value={m.id}>{m.model}</option>)}
            </select>
          </label>
          <div className="space-y-1 text-sm">Color<ColorSelect value={color} onChange={setColor} options={PHONE_COLORS} /></div>
          <div className="space-y-1 text-sm">Storage<OptionSelect label="Storage" value={storage} onChange={setStorage} options={isComputer ? COMPUTER_DISK : PHONE_STORAGE} placeholder="Select storage" /></div>
          <label className="space-y-1 text-sm">Condition
            <select className="field" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {[...new Set([...CONDITIONS, condition])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Battery health
            <select className="field" value={battery} onChange={(e) => setBattery(e.target.value)}>
              <option value="">Not checked</option>
              {BATTERY_OPTIONS.map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
          </label>
          <label className="col-span-2 space-y-1 text-sm">Selling price (¥)
            <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">The label code ({product.product_code}) stays the same, so the printed label still works. Reprint it if the details on it changed.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !modelId || !price || !imei} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
