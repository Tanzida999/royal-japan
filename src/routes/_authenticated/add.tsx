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
import { PrintLabel, type LabelData, printLabels } from "@/components/PrintLabel";
import { CameraScan } from "@/components/CameraScan";
import { ColorSelect, OptionSelect } from "@/components/ProductFields";
import { useCurrentShop } from "@/lib/shop-context";
import { imeiProblem } from "@/lib/pos";
import { extractImei, guessFromImei, toHalfWidth, isValidImei, beep, isJanCode, lookupSku, learnSku } from "@/lib/imei-scan";
import { LoggedInStaff } from "@/components/LoggedInStaff";
import { validateBulkRows, type BulkRow, SUPPLIER_PAYMENTS } from "@/lib/bulk";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { TrackingFields } from "@/components/TrackingEditor";
import { photoProblem } from "@/lib/product-extras";
import { uploadProductPhotos } from "@/lib/product-photos";
import { SupplierSelect } from "@/components/SupplierSelect";
import { activeSuppliersQuery, supplierProblem } from "@/lib/supplier-directory";
import { categoriesQuery, db, PHONE_COLORS, COMPUTER_COLORS, PHONE_STORAGE, COMPUTER_DISK, COMPUTER_PROCESSORS, COMPUTER_GENERATIONS, COMPUTER_RAM, COMPUTER_DISPLAY, SERIAL_RE, BATTERY_OPTIONS, emptySpecs, type CategoryKind, type ComputerSpecs } from "@/lib/catalog";
import { compressImage } from "@/lib/product-extras";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => pageMeta("Add Product — Mobile Shop Manager", "Register individual phones or bulk purchases with verified staff badges."),
  component: AddProduct,
});

const CONDITIONS = ["New", "Used A", "Used B", "Used C"] as const;

const schema = z.object({
  shop_id: z.string().uuid("Pick a shop"),
  model_id: z.string().uuid("Pick a model"),
  imei: z.string().regex(/^(\d{15}|[A-Z0-9][A-Z0-9-]{4,29})$/, "Enter a 15-digit IMEI (or a serial number for computers)"),
  color: z.string().trim().min(1, "Color is required").max(50),
  storage: z.string().trim().min(1, "Storage is required").max(20),
  condition: z.enum(CONDITIONS),
  purchase_price: z.number().int().min(0, "Enter purchase price"),
  selling_price: z.number().int().min(0, "Enter selling price"),
  supplier: z.string().uuid("Pick an active supplier"),
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
  const { data: activeSuppliers = [] } = useQuery(activeSuppliersQuery);

  const [bulk, setBulk] = useState(false);
  const { shopId, setShopId, isOwner } = useCurrentShop();
  const imeiRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLSelectElement>(null);
  const purchaseRef = useRef<HTMLInputElement>(null);
  const [autoFilled, setAutoFilled] = useState<string[]>([]);
  const [jan, setJan] = useState("");
  const [janKnown, setJanKnown] = useState(false);
  const bulkImeiRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<string>("New");
  const [battery, setBattery] = useState("");
  const [purchase, setPurchase] = useState("");
  const [selling, setSelling] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supPay, setSupPay] = useState<string>("Cash");
  const [paid, setPaid] = useState("");
  const [staffCode, setStaffCode] = useState("");
  useEffect(() => { if (me?.staff_code) setStaffCode((c) => c || me.staff_code || ""); }, [me?.staff_code]);
  const [rows, setRows] = useState<BulkRow[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<LabelData[] | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [rowPhotos, setRowPhotos] = useState<PickedPhoto[][]>([[]]);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [postError, setPostError] = useState("");
  const { data: categories = [] } = useQuery(categoriesQuery);
  const [category, setCategory] = useState("");
  const [specs, setSpecs] = useState<ComputerSpecs>(emptySpecs());
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceT, setInvoiceT] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [scanProblem, setScanProblem] = useState("");
  const [scanNote, setScanNote] = useState("");

  // Keep the unfinished entry if the page reloads (e.g. iPhone reloads the tab after checking Settings → About)
  const draftKey = me?.id ? `add-product-draft:${me.id}` : "";
  const draftRestored = useRef(false);
  useEffect(() => {
    if (!draftKey || draftRestored.current) return;
    draftRestored.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (!d || Date.now() - d.t > 12 * 3600_000) return;
      setBulk(Boolean(d.bulk)); setCategory(d.category ?? ""); setBrand(d.brand ?? ""); setModelId(d.modelId ?? "");
      setColor(d.color ?? ""); setStorage(d.storage ?? ""); setCondition(d.condition ?? "New"); setBattery(d.battery ?? "");
      setPurchase(d.purchase ?? ""); setSelling(d.selling ?? ""); setSupplier(d.supplier ?? ""); setSupPay(d.supPay ?? "Cash"); setPaid(d.paid ?? "");
      setCarrier(d.carrier ?? ""); setTracking(d.tracking ?? ""); setSpecs({ ...emptySpecs(), ...(d.specs ?? {}) }); setJan(d.jan ?? ""); setJanKnown(Boolean(d.janKnown));
      if (Array.isArray(d.rows) && d.rows.length) { setRows(d.rows); setRowPhotos(d.rows.map(() => [])); }
      resolvedImei.current = d.imei ?? ""; setImei(d.imei ?? "");
      if (d.imei || (Array.isArray(d.rows) && d.rows.some((r: BulkRow) => r.imei))) setScanNote("Your unsaved entry was restored. Photos and the invoice file must be added again.");
    } catch { /* storage unavailable */ }
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftKey || !draftRestored.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ t: Date.now(), bulk, category, brand, modelId, imei, color, storage, condition, battery, purchase, selling, supplier, supPay, paid, carrier, tracking, specs, jan, janKnown, rows }));
    } catch { /* storage unavailable */ }
  }, [draftKey, bulk, category, brand, modelId, imei, color, storage, condition, battery, purchase, selling, supplier, supPay, paid, carrier, tracking, specs, jan, janKnown, rows]);
  const resolvedImei = useRef("");

  const focusImei = () => setTimeout(() => (bulk ? bulkImeiRefs.current[rows.length - 1] : imeiRef.current)?.focus(), 0);
  useEffect(() => { if (!bulk && !saved && staffCode) imeiRef.current?.focus(); }, [bulk, saved, staffCode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (bulk && !saved && staffCode) bulkImeiRefs.current[rows.length - 1]?.focus(); }, [bulk, rows.length, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCategories = categories.filter((c) => c.active);
  const modelKind = (id: string): CategoryKind => {
    const cid = (models.find((m) => m.id === id) as { category_id?: string | null } | undefined)?.category_id;
    return categories.find((c) => c.id === cid)?.kind ?? "phone";
  };
  const kind: CategoryKind = modelId ? modelKind(modelId) : (categories.find((c) => c.id === category)?.kind ?? "phone");
  const isComputer = kind === "computer";
  const idLabel = kind === "phone" ? "IMEI" : isComputer ? "Serial number" : "IMEI or serial number";
  const cleanId = (raw: string) => {
    const v = toHalfWidth(raw).toUpperCase();
    return kind === "phone" ? v.replace(/\D/g, "").slice(0, 32) : v.replace(/[^A-Z0-9-]/g, "").slice(0, 32);
  };

  /** Box barcode (JAN): fills model, storage and colour exactly if this box was added before. */
  async function acceptJan(code: string) {
    setJan(code); setImei(""); resolvedImei.current = ""; setScanProblem(""); setAutoFilled([]);
    const sku = await lookupSku(code);
    beep(true);
    if (!sku) {
      setJanKnown(false);
      setScanNote(`New box barcode ${code}: pick the model, storage and colour once — next time this box fills in by itself. Now scan the IMEI.`);
      setTimeout(() => imeiRef.current?.focus(), 0);
      return;
    }
    const m = models.find((x) => x.id === sku.model_id);
    if (m) { setBrand(m.brand); setModelId(m.id); const cid = (m as { category_id?: string | null }).category_id; if (cid) setCategory(cid); }
    setStorage(sku.storage); setColor(sku.color); setJanKnown(true);
    setScanNote(`Box ${code}: ${m ? `${m.brand} ${m.model}` : "model"} ${sku.storage} ${sku.color}. Now scan the IMEI.`);
    setTimeout(() => imeiRef.current?.focus(), 0);
  }

  /** Read a scanned/typed IMEI, then fill model (and storage/colour if known) from earlier phones. */
  async function acceptImei(raw: string) {
    const digits = toHalfWidth(raw).trim().replace(/\s/g, "");
    if (isJanCode(digits)) return acceptJan(digits);
    const plain = toHalfWidth(raw).trim().toUpperCase();
    const serial = plain.replace(/\s/g, "");
    const digitsOnly = /^\d+$/.test(serial);
    if (kind !== "phone" && SERIAL_RE.test(serial) && (!digitsOnly || (isComputer && ![15, 16, 30].includes(serial.length)))) {
      setScanProblem(""); setScanNote(""); resolvedImei.current = serial; setImei(serial); return;
    }
    const { imei: v, problem, warning } = extractImei(raw);
    if (v && v === resolvedImei.current && v === imei && !problem) return;
    setScanNote("");
    if (problem) { setScanProblem(problem); resolvedImei.current = raw; beep(false); return; }
    setScanProblem("");
    resolvedImei.current = v;
    setImei(v);
    if (existing.has(v)) { beep(false); return; }
    beep(true);
    if (jan && janKnown && modelId) { setScanNote(""); setTimeout(() => purchaseRef.current?.focus(), 0); return; }
    setAutoFilled([]);
    const g = await guessFromImei(v);
    if (warning) { setScanNote(warning); if (!g) { brandRef.current?.focus(); return; } }
    if (!g) { setScanNote("New model code: pick the brand and model once. Next time this model fills in automatically."); brandRef.current?.focus(); return; }
    const m = models.find((x) => x.id === g.model_id);
    if (m && m.id !== modelId) { setColor(""); setStorage(""); } // different model: don't keep the last phone's colour/storage
    if (m) { setBrand(m.brand); setModelId(m.id); const cid = (m as { category_id?: string | null }).category_id; if (cid) setCategory(cid); }
    setAutoFilled(["model"]);
    setScanNote(`${warning ? warning + " " : ""}Model detected from the IMEI (${g.matches} earlier phone${g.matches > 1 ? "s" : ""} with the same model code). Now pick colour and storage — or scan the box JAN barcode to fill them exactly.`);
  }
  useEffect(() => {
    if (bulk || imei === resolvedImei.current) return;
    const janLike = isJanCode(imei) && (imei.length === 13 || imei.length === 12 || imei.length === 8);
    if (!janLike && (kind !== "phone" || imei.length < 15)) return;
    const t = setTimeout(() => void acceptImei(imei), janLike ? 600 : imei.length === 15 && isValidImei(imei) ? 0 : 300);
    return () => clearTimeout(t);
  }, [imei, bulk]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bulk mode: check the scanned IMEI for row i and fill an empty row from earlier phones. */
  async function acceptRowImei(i: number, raw: string) {
    const plain = toHalfWidth(raw).trim().toUpperCase().replace(/\s/g, "");
    if (isJanCode(plain)) {
      // Box barcode: fill this row's model/storage/colour, then the IMEI goes in the same row
      const sku = await lookupSku(plain);
      beep(true);
      setRows((rs) => rs.map((r, j) => j === i ? { ...r, imei: "", jan: plain, ...(sku ? { model_id: sku.model_id, storage: sku.storage, color: sku.color } : {}) } : r));
      setError(sku ? "" : `Row ${i + 1}: new box barcode — pick model, storage and colour once, then scan the IMEI.`);
      return false;
    }
    if (rows[i] && modelKind(rows[i]!.model_id) !== "phone" && /[A-Z]/.test(plain) && SERIAL_RE.test(plain)) { setError(""); setRow(i, { imei: plain }); return true; }
    const { imei: v, problem } = extractImei(raw);
    if (problem) { setError(`Row ${i + 1}: ${problem}`); beep(false); return false; }
    beep(!existing.has(v));
    setError("");
    setRow(i, { imei: v });
    const g = existing.has(v) ? null : await guessFromImei(v);
    if (g) setRows((rs) => rs.map((r, j) => j === i ? { ...r, model_id: r.model_id || g.model_id } : r));
    return true;
  }

  const catModels = category ? models.filter((m) => (m as { category_id?: string | null }).category_id === category) : models;
  const brands = useMemo(() => [...new Set(catModels.map((m) => m.brand))], [catModels]);
  const brandModels = catModels.filter((m) => m.brand === brand);

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
  const imeiError = !imei ? "" : kind !== "phone" && SERIAL_RE.test(imei) && !/^\d+$/.test(imei)
    ? (existing.has(imei) ? "This serial number already exists" : "")
    : imeiProblem(imei, existing);
  const rowStatus = validateBulkRows(rows, existing, (mid) => modelKind(mid) !== "phone").map((st, i) => st !== "OK" ? st : photoProblem(rows[i]?.condition ?? "New", rowPhotos[i]?.length ?? 0) || "OK");
  const photoError = photoProblem(condition, photos.length);

  function trackingOk() {
    if (tracking.trim() && !carrier) return "Pick a carrier for the tracking number";
    if (tracking.trim() && !/^[A-Za-z0-9-]{4,40}$/.test(tracking.replace(/\s/g, ""))) return "Tracking number looks wrong";
    return "";
  }

  /** Photos + tracking after the product exists; returns problems (product is already saved). */
  async function afterSave(productId: string, blobs: Blob[], batteryPct = "") {
    const problems: string[] = [];
    if (batteryPct) {
      const { error } = await db.rpc("set_product_battery", { _product_id: productId, _battery: Number(batteryPct) });
      if (error) problems.push(`Battery health not saved: ${error.message}`);
    }
    try { await uploadProductPhotos(productId, blobs); } catch (e) { problems.push(e instanceof Error ? e.message : "Photos not saved"); }
    if (isComputer && !bulk && Object.values(specs).some(Boolean)) {
      const { error } = await db.rpc("set_product_specs", { _product_id: productId, _specs: specs });
      if (error) problems.push(`Computer details not saved: ${error.message}`);
    }
    if (tracking.trim()) {
      const { error } = await supabase.rpc("set_product_tracking", { _product_id: productId, _carrier: carrier, _tracking_number: tracking });
      if (error) problems.push(`Tracking not saved: ${error.message}`);
    }
    return problems;
  }

  function invoiceOk() {
    if (!invoiceFile) return "";
    if (invoiceFile.size > 10 * 1024 * 1024) return "Invoice file is too big (max 10 MB)";
    if (!/^(application\/pdf|image\/)/.test(invoiceFile.type)) return "Invoice must be a PDF or a photo";
    const t = invoiceT.toUpperCase().replace(/[\s-]/g, "");
    if (t && !/^T\d{13}$/.test(t)) return "T-number must be T followed by 13 digits";
    return "";
  }

  /** Upload the supplier invoice and link it to the saved products; returns problems. */
  async function saveInvoice(productIds: string[]): Promise<string[]> {
    if (!invoiceFile || !productIds.length || !me?.id) return [];
    try {
      const isPdf = invoiceFile.type === "application/pdf";
      const blob: Blob = isPdf ? invoiceFile : await compressImage(invoiceFile, 2200, 0.85);
      const path = `${me.id}/${crypto.randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
      const up = await db.storage.from("invoices").upload(path, blob, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await db.rpc("add_purchase_invoice", {
        _shop: shopId || null, _supplier: supplier || null, _invoice_no: invoiceNo, _invoice_date: invoiceDate || null,
        _total: invoiceTotal === "" ? null : Number(invoiceTotal), _t_number: invoiceT, _file_path: path, _file_name: invoiceFile.name, _product_ids: productIds,
      });
      if (error) throw error;
      setInvoiceFile(null); setInvoiceNo(""); setInvoiceDate(""); setInvoiceT(""); setInvoiceTotal("");
      return [];
    } catch (e) {
      return [`Invoice not saved: ${e instanceof Error ? e.message : "upload failed"}`];
    }
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
    if (!staffCode) return setError("Your account has no staff code. Ask the owner to set one.");
    const supplierError = supplierProblem(supplier, activeSuppliers);
    if (supplierError) return setError(supplierError);
    if (imeiError) return setError(imeiError);
    if (photoError) return setError(photoError);
    const te = trackingOk();
    if (te) return setError(te);
    const pe = paymentOk();
    if (pe) return setError(pe);
    const ie = invoiceOk();
    if (ie) return setError(ie);
    if (isComputer && (!specs.processor || !specs.ram)) return setError("Pick the processor and RAM for the computer");
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
    const { data, error } = await supabase.rpc("add_product_with_supplier", {
      _shop_id: v.shop_id,
      _model_id: v.model_id,
      _imei: v.imei,
      _color: v.color,
      _storage: v.storage,
      _condition: v.condition,
      _purchase_price: v.purchase_price,
      _selling_price: v.selling_price,
      _supplier_id: v.supplier,
      _staff_code: staffCode,
      _supplier_payment: supPay,
      _paid_amount: supPay === "Partial" ? Number(paid) : (null as unknown as number),
    });
    if (error) {
      setBusy(false);
      return setError(error.message.includes("duplicate") ? "This IMEI or product code already exists" : error.message);
    }
    const problems = [...(await afterSave(data.id, photos.map((x) => x.blob), battery)), ...(await saveInvoice([data.id]))];
    if (jan) void learnSku(jan, v.model_id, v.storage, v.color);
    setJan(""); setJanKnown(false);
    setSpecs(emptySpecs());
    setBattery("");
    setBusy(false);
    setPostError(problems.length ? `Phone saved, but: ${problems.join("; ")}. Add them from the phone's details page.` : "");
    photos.forEach((x) => URL.revokeObjectURL(x.url));
    setPhotos([]);
    setTracking("");
    setCarrier("");
    setSaved([
      { product_code: data.product_code, model: modelName(v.model_id), storage: v.storage, selling_price: v.selling_price, imei: data.imei, color: data.color, condition: data.condition, purchase_date: jstDate(data.created_at), shop: shops.find(s => s.id === data.shop_id)?.name ?? "", battery: battery ? Number(battery) : null },
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
    if (!staffCode) return setError("Your account has no staff code. Ask the owner to set one.");
    const supplierError = supplierProblem(supplier, activeSuppliers);
    if (supplierError) return setError(supplierError);
    const pe = paymentOk() || trackingOk() || invoiceOk();
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
    const { data, error } = await supabase.rpc("add_products_bulk_with_supplier", {
      _shop_id: shopId,
      _supplier_id: supplier,
      _staff_code: staffCode,
      _supplier_payment: supPay,
      _paid_amount: supPay === "Partial" ? Number(paid) : (null as unknown as number),
      _items: items,
    });
    if (error) { setBusy(false); return setError(`Nothing was saved: ${error.message}`); }
    const problems: string[] = [];
    for (const [i, p] of (data ?? []).entries()) {
      const idx = rows.findIndex((r) => r.imei.trim() === p.imei);
      problems.push(...(await afterSave(p.id, (rowPhotos[idx >= 0 ? idx : i] ?? []).map((x) => x.blob), rows[idx >= 0 ? idx : i]?.battery ?? "")).map((m) => `${p.product_code}: ${m}`));
    }
    problems.push(...(await saveInvoice((data ?? []).map((p) => p.id))));
    for (const r of rows) if (r.jan && r.model_id) void learnSku(r.jan, r.model_id, r.storage, r.color);
    setBusy(false);
    setPostError(problems.length ? `Products saved, but: ${problems.join("; ")}. Add them from each phone's details page.` : "");
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
        battery: Number(rows.find((r) => r.imei === p.imei)?.battery) || null,
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
          <Button onClick={() => { printLabels(); for (const l of saved) logEvent("label_printed", "products", l.product_code, { product_code: l.product_code, imei: l.imei }); }}>{saved.length > 1 ? "Print all labels" : "Print Label"}</Button>
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
        <SupplierSelect value={supplier} onChange={setSupplier} />
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
      <div className="space-y-2 rounded-md border p-3 sm:col-span-2">
        <Label htmlFor="invoice-file">Supplier invoice (optional — PDF or photo)</Label>
        <Input id="invoice-file" type="file" accept="application/pdf,image/*" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
        {invoiceFile && (
          <div className="grid gap-2 sm:grid-cols-4">
            <Input aria-label="Invoice number" placeholder="Invoice no." value={invoiceNo} maxLength={50} onChange={(e) => setInvoiceNo(e.target.value)} />
            <Input aria-label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            <Input aria-label="T-number" placeholder="T-number (T + 13 digits)" value={invoiceT} maxLength={16} onChange={(e) => setInvoiceT(e.target.value)} />
            <Input aria-label="Invoice total" placeholder="Invoice total ¥" inputMode="numeric" value={invoiceTotal} onChange={(e) => setInvoiceTotal(e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
        {bulk && invoiceFile && <p className="text-xs text-muted-foreground">This invoice will be linked to every product in this batch.</p>}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="page-toolbar">
        <h1 className="mr-auto text-2xl font-bold">Add Product</h1>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={bulk} onChange={(e) => { setBulk(e.target.checked); setError(""); }} />
          Bulk mode
        </label>
      </div>
      <LoggedInStaff me={me} value={staffCode} onChange={(c) => setStaffCode(c)} onVerified={focusImei} />

      {!bulk ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {shared}
            {activeCategories.length > 0 && (
              <Field label="Category">
                <select aria-label="Category" className="field" value={category} onChange={(e) => { setCategory(e.target.value); setBrand(""); setModelId(""); setStorage(""); setColor(""); }}>
                  <option value="">All categories</option>
                  {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label={`${idLabel} (scan or type)`}>
              <Input
                ref={imeiRef}
                aria-label="IMEI"
                inputMode={kind === "phone" ? "numeric" : "text"}
                maxLength={40}
                autoComplete="off"
                lang="en"
                value={imei}
                onChange={(e) => { setImei(cleanId(e.target.value)); setScanProblem(""); setScanNote(""); setAutoFilled([]); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void acceptImei(imei); } }}
                onPaste={(e) => { e.preventDefault(); void acceptImei(e.clipboardData.getData("text")); }}
                placeholder={kind === "phone" ? "Scan the IMEI barcode" : isComputer ? "Scan the serial number" : "Scan IMEI or serial"}
              />
              {scanProblem ? <p role="alert" className="text-xs font-semibold text-destructive">{scanProblem}</p> : imeiError && imei.length >= 15 && <p role="alert" className="text-xs text-destructive">{imeiError}</p>}
              {scanNote && !scanProblem && <p className="text-xs text-primary">{scanNote}</p>}
              <CameraScan onScan={c => void acceptImei(c)} accept={(c) => { const t = toHalfWidth(c).trim().toUpperCase(); if (isJanCode(t)) return t === jan ? "Box barcode already read — now hold the IMEI barcode in the frame (cover the big box barcode with your finger)" : true; if (extractImei(t).imei) return true; if (kind !== "phone" && SERIAL_RE.test(t.replace(/\s/g, ""))) return true; return extractImei(t).problem || "Not an IMEI — keep scanning"; }} />
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
              <select className={`field ${autoFilled.includes("model") ? "ring-2 ring-amber-400" : ""}`} value={modelId} onChange={(e) => { setModelId(e.target.value); setAutoFilled((a) => a.filter((x) => x !== "model")); }} disabled={!brand}>
                <option value="">Select model</option>
                {brandModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.model}</option>
                ))}
              </select>
            </Field>
            <Field label="Color">
              <div className={autoFilled.includes("color") ? "rounded-md ring-2 ring-amber-400" : ""}><ColorSelect value={color} onChange={(v) => { setColor(v); setAutoFilled((a) => a.filter((x) => x !== "color")); }} options={isComputer ? COMPUTER_COLORS : PHONE_COLORS} /></div>
            </Field>
            <Field label={isComputer ? "Storage (SSD / HDD)" : "Storage"}>
              <div className={autoFilled.includes("storage") ? "rounded-md ring-2 ring-amber-400" : ""}><OptionSelect label="Storage" value={storage} onChange={(v) => { setStorage(v); setAutoFilled((a) => a.filter((x) => x !== "storage")); }} options={isComputer ? COMPUTER_DISK : PHONE_STORAGE} placeholder="Select storage" /></div>
            </Field>
            {isComputer && (
              <>
                <Field label="Processor">
                  <OptionSelect label="Processor" value={specs.processor} onChange={(v) => setSpecs((s) => ({ ...s, processor: v }))} options={COMPUTER_PROCESSORS} placeholder="Select processor" />
                </Field>
                <Field label="Generation">
                  <OptionSelect label="Generation" value={specs.generation} onChange={(v) => setSpecs((s) => ({ ...s, generation: v }))} options={COMPUTER_GENERATIONS} placeholder="Select generation" />
                </Field>
                <Field label="RAM">
                  <OptionSelect label="RAM" value={specs.ram} onChange={(v) => setSpecs((s) => ({ ...s, ram: v }))} options={COMPUTER_RAM} placeholder="Select RAM" />
                </Field>
                <Field label="Display size">
                  <OptionSelect label="Display size" value={specs.display} onChange={(v) => setSpecs((s) => ({ ...s, display: v }))} options={COMPUTER_DISPLAY} placeholder="Select display size" />
                </Field>
              </>
            )}
            <Field label="Condition">
              <select className="field" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Battery health (%)">
              <select className="field" aria-label="Battery health" value={battery} onChange={(e) => setBattery(e.target.value)}>
                <option value="">Not checked</option>
                {BATTERY_OPTIONS.map((n) => <option key={n} value={n}>{n}%</option>)}
              </select>
            </Field>
            <Field label="Purchase price (¥)">
              <Input ref={purchaseRef} inputMode="numeric" value={purchase} onChange={(e) => setPurchase(e.target.value.replace(/\D/g, ""))} />
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
          <Button type="submit" disabled={busy || !staffCode || Boolean(imeiError) || Boolean(supplierProblem(supplier, activeSuppliers))} className="w-full sm:w-auto">
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
                  <th className="p-2">IMEI / Serial</th>
                  <th className="p-2">Color</th>
                  <th className="p-2">Storage</th>
                  <th className="p-2">Cond.</th>
                  <th className="p-2">Battery</th>
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
                        maxLength={40}
                        autoComplete="off"
                        lang="en"
                        value={r.imei}
                        onChange={(e) => { const v = toHalfWidth(e.target.value).toUpperCase(); setRow(i, { imei: modelKind(r.model_id) === "phone" ? v.replace(/\D/g, "").slice(0, 32) : v.replace(/[^A-Z0-9-]/g, "").slice(0, 32) }); }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            if (!(await acceptRowImei(i, r.imei))) return;
                            if (i === rows.length - 1) setRows((rs) => [...rs, { ...emptyRow(), model_id: r.model_id, color: r.color, storage: r.storage, condition: r.condition, battery: r.battery, jan: r.jan, purchase_price: r.purchase_price, selling_price: r.selling_price }]);
                            else bulkImeiRefs.current[i + 1]?.focus();
                          }
                        }}
                      />
                    </td>
                    <td className="p-1"><div className="min-w-32"><ColorSelect value={r.color} onChange={(v) => setRow(i, { color: v })} options={modelKind(r.model_id) === "computer" ? COMPUTER_COLORS : PHONE_COLORS} /></div></td>
                    <td className="p-1"><select className="field min-w-24" aria-label="Storage" value={r.storage} onChange={(e) => setRow(i, { storage: e.target.value })}><option value="">—</option>{(modelKind(r.model_id) === "computer" ? COMPUTER_DISK : PHONE_STORAGE).map((o) => <option key={o} value={o}>{o}</option>)}{r.storage && !(modelKind(r.model_id) === "computer" ? COMPUTER_DISK : PHONE_STORAGE).includes(r.storage) && <option value={r.storage}>{r.storage}</option>}</select></td>
                    <td className="p-1">
                      <select className="field min-w-24" value={r.condition} onChange={(e) => setRow(i, { condition: e.target.value })}>
                        {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-1"><select className="field min-w-20" aria-label="Battery health" value={r.battery ?? ""} onChange={(e) => setRow(i, { battery: e.target.value })}><option value="">—</option>{BATTERY_OPTIONS.map((n) => <option key={n} value={n}>{n}%</option>)}</select></td>
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
          <CameraScan accept={(c) => { const t = toHalfWidth(c).trim().toUpperCase(); if (isJanCode(t) && rows.some((r) => r.jan === t && !r.imei)) return "Box barcode already read — now hold the IMEI barcode in the frame"; return isJanCode(t) || Boolean(extractImei(t).imei) || SERIAL_RE.test(t) || (extractImei(t).problem || "Not an IMEI — keep scanning"); }} onScan={c => { const i = rows.findIndex(r => !r.imei); if (i >= 0) void acceptRowImei(i, c); else { setRows(rs => [...rs, emptyRow()]); setTimeout(() => void acceptRowImei(rows.length, c), 0); } }} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>Add row</Button>
            <Button variant="outline" disabled={rows.length <= 1} onClick={() => { setRows((rs) => rs.slice(0, -1)); setRowPhotos((all) => { all[rows.length - 1]?.forEach((x) => URL.revokeObjectURL(x.url)); return all.slice(0, rows.length - 1); }); }}>Remove last row</Button>
            <Button onClick={saveAll} disabled={busy || !staffCode || Boolean(supplierProblem(supplier, activeSuppliers))}>{busy ? "Saving…" : `Save all (${rows.length})`}</Button>
          </div>
        </div>
      )}
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
