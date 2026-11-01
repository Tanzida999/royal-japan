import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime, meQuery, PRODUCT_SELECT, yen, type ProductRow } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [{ title: "Sell — Phone Shop" }] }),
  component: Sell,
});

type Receipt = {
  shop: string;
  receipt_no: string;
  date: string;
  item: string;
  imei: string;
  price: number;
  payment: string;
  customer: string;
  staff: string;
};

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
    if (!Number.isInteger(sp) || sp < 0 || price === "") return setError("Enter a valid sale price");
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("complete_sale", {
      _product_id: product.id,
      _sale_price: sp,
      _customer_name: customer.trim().slice(0, 100),
      _payment: payment,
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
      staff: me?.name ?? "",
    });
    setProduct(null);
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (receipt) {
    return (
      <div className="space-y-4">
        <div className="print-area receipt-print mx-auto max-w-xs space-y-2 rounded-xl border bg-card p-4 font-mono text-sm">
          <div className="text-center text-base font-bold">{receipt.shop}</div>
          <div className="text-center text-xs">Receipt {receipt.receipt_no}</div>
          <div className="text-xs">{receipt.date}</div>
          <hr />
          <div>{receipt.item}</div>
          <div className="text-xs">IMEI: {receipt.imei}</div>
          <hr />
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{yen(receipt.price)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Payment</span>
            <span>{receipt.payment}</span>
          </div>
          {receipt.customer && <div className="text-xs">Customer: {receipt.customer}</div>}
          <div className="text-xs">Staff: {receipt.staff}</div>
          <div className="pt-2 text-center text-xs">Thank you!</div>
        </div>
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
