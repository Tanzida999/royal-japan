import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime, meQuery, PRODUCT_SELECT, yen, type ProductRow } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt as ReceiptView, type ReceiptData } from "@/components/Receipt";
import { StaffScan } from "@/components/StaffScan";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [{ title: "Sell — Mobile Shop Manager" }] }),
  component: Sell,
});

type Receipt = ReceiptData;

function Sell() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffCode, setStaffCode] = useState("");
  const [staffName, setStaffName] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!product && !receipt) scanRef.current?.focus();
  }, [product, receipt]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const q = code.trim().toUpperCase();
    setError("");
    setProduct(null);
    if (!q) return;
    const col = /^\d{15}$/.test(q) ? "imei" : "product_code";
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq(col, q).maybeSingle();
    setCode("");
    if (error) return setError(error.message);
    if (!data) return setError(`Not found: ${q}`);
    const p = data as unknown as ProductRow;
    if (p.status !== "in_stock") return setError(`Already sold: ${p.product_code} (${p.models?.brand} ${p.models?.model})`);
    setProduct(p);
    setPrice(String(p.selling_price));
    setCustomer("");
    setPayment("Cash");
  }

  async function complete() {
    if (!product) return;
    const sp = Number(price);
    if (!staffCode) return setError("Scan your staff code first");
    if (!Number.isInteger(sp) || sp < 0 || price === "") return setError("Enter a valid sale price");
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("complete_sale", {
      _product_id: product.id,
      _sale_price: sp,
      _customer_name: customer.trim().slice(0, 100),
      _payment: payment,
      _staff_code: staffCode,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setReceipt({
      shop: product.shops?.name ?? "",
      receipt_no: data.receipt_no,
      date: jstDateTime(data.created_at),
      item: `${product.models?.brand} ${product.models?.model} ${product.storage} ${product.color} (${product.condition})`,
      imei: product.imei,
      price: sp,
      payment,
      customer: customer.trim(),
      staff: staffName || me?.name || "",
    });
    setProduct(null);
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (receipt) {
    return (
      <div className="space-y-4">
        <ReceiptView receipt={receipt} />
        <div className="no-print flex justify-center gap-2">
          <Button onClick={() => window.print()}>Print</Button>
          <Button variant="outline" onClick={() => setReceipt(null)}>
            New sale
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="rounded-xl border bg-card p-4 sm:p-6">
        <Label htmlFor="scan" className="text-lg font-bold">Scan barcode</Label>
        <Input
          id="scan"
          ref={scanRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Product code or IMEI, then Enter"
          className="mt-2 h-14 text-xl"
          autoComplete="off"
          autoFocus
        />
      </form>

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-lg font-semibold text-destructive">
          {error}
        </div>
      )}

      {product && (
        <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
          <div>
            <div className="text-xl font-bold">
              {product.models?.brand} {product.models?.model}
            </div>
            <div className="text-muted-foreground">
              {product.storage} · {product.color} · {product.condition} · {product.shops?.name}
            </div>
            <div className="font-mono text-sm">
              {product.product_code} · IMEI {product.imei}
            </div>
            <div className="mt-2 text-3xl font-bold">{yen(product.selling_price)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StaffScan value={staffCode} onChange={(c, n) => { setStaffCode(c); setStaffName(n); }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Customer name</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>Payment</Label>
              <select className="field" value={payment} onChange={(e) => setPayment(e.target.value)}>
                {["Cash", "Card", "PayPay"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Sale price (¥)</Label>
              <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="lg" onClick={complete} disabled={busy}>
              {busy ? "Saving…" : "Complete Sale"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => setProduct(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
