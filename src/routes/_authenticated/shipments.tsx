import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { meQuery, shopsQuery, jstDate, jstDateTime, yen } from "@/lib/app";
import { useCurrentShop } from "@/lib/shop-context";
import { pageMeta } from "@/lib/metadata";
import { db, SHIPMENT_STATUSES } from "@/lib/catalog";
import { TrackButton, TrackingFields } from "@/components/TrackingEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/shipments")({
  head: () => pageMeta("Shipments — Mobile Shop Manager", "Online and COD orders: tracking numbers and delivery status."),
  component: Shipments,
});

type Shipment = {
  id: string; receipt_id: string; shop_id: string; platform: string | null; carrier: string | null; tracking_number: string | null;
  status: string; recipient_name: string | null; recipient_phone: string | null; postal_code: string | null; address: string | null;
  cod: boolean; cod_amount: number; note: string | null; shipped_at: string | null; delivered_at: string | null; created_at: string;
  receipts: { receipt_no: string; total: number; staff_name: string; items: { model?: string; storage?: string; imei?: string }[] | null } | null;
  shops: { name: string } | null;
};

const OVERDUE_DAYS = 5;
const statusLabel = (v: string) => SHIPMENT_STATUSES.find((s) => s.value === v)?.label ?? v;
const statusClass: Record<string, string> = {
  preparing: "bg-amber-100 text-amber-900", shipped: "bg-blue-100 text-blue-900", in_transit: "bg-blue-100 text-blue-900",
  delivered: "bg-green-100 text-green-900", returned: "bg-muted text-foreground", problem: "bg-red-100 text-red-900",
};

function isOverdue(s: Pick<Shipment, "status" | "shipped_at">, now = Date.now()) {
  return (s.status === "shipped" || s.status === "in_transit") && !!s.shipped_at && now - new Date(s.shipped_at).getTime() > OVERDUE_DAYS * 86_400_000;
}

function Shipments() {
  const { data: me } = useQuery(meQuery);
  const isOwner = me?.role === "owner";
  const { data: shops = [] } = useQuery(shopsQuery);
  const { shopId: currentShop } = useCurrentShop();
  const [ownerShop, setOwnerShop] = useState("");
  const shop = isOwner ? ownerShop : currentShop;
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Shipment | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["shipments", shop],
    queryFn: async () => {
      let q = db.from("shipments").select("*, receipts(receipt_no, total, staff_name, items), shops(name)").order("created_at", { ascending: false }).limit(1000);
      if (shop) q = q.eq("shop_id", shop);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Shipment[];
    },
  });

  const q = search.trim().toLowerCase();
  const list = rows.filter((s) => {
    if (status === "open" && (s.status === "delivered" || s.status === "returned")) return false;
    if (status === "overdue" && !isOverdue(s)) return false;
    if (status !== "open" && status !== "overdue" && status && s.status !== status) return false;
    if (!q) return true;
    return [s.receipts?.receipt_no, s.tracking_number, s.recipient_name, s.recipient_phone, s.platform, ...(s.receipts?.items ?? []).map((i) => `${i.model} ${i.imei}`)].join(" ").toLowerCase().includes(q);
  });
  const overdue = rows.filter((s) => isOverdue(s)).length;
  const codOpen = rows.filter((s) => s.cod && s.status !== "delivered" && s.status !== "returned").reduce((a, s) => a + s.cod_amount, 0);

  return (
    <div className="space-y-4">
      <div className="page-toolbar">
        <h1 className="mr-auto text-2xl font-bold">Shipments ({list.length})</h1>
        <Input className="w-full sm:w-56" placeholder="Search receipt, tracking, name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="field w-full sm:w-44" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Not delivered yet</option>
          <option value="overdue">Late (over {OVERDUE_DAYS} days)</option>
          <option value="">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isOwner && (
          <select className="field w-full sm:w-48" aria-label="Filter by shop" value={ownerShop} onChange={(e) => setOwnerShop(e.target.value)}>
            <option value="">All shops</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {overdue > 0 && <span className="font-semibold text-destructive">{overdue} late shipment{overdue > 1 ? "s" : ""} · </span>}
        COD still to collect: <span className="font-semibold text-foreground">{yen(codOpen)}</span>
      </p>
      {error && <p role="alert" className="text-destructive">Could not load shipments. If this is new, the database update has not been run yet.</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Date</th><th className="p-2">Receipt / items</th><th className="p-2">Customer</th><th className="p-2">Platform</th><th className="p-2 text-right">COD</th><th className="p-2">Tracking</th><th className="p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={8}>Loading…</td></tr>}
            {!isLoading && !list.length && <tr><td className="p-4 text-muted-foreground" colSpan={8}>No shipments.</td></tr>}
            {list.map((s) => (
              <tr key={s.id} className={`border-t align-top ${isOverdue(s) ? "bg-red-50" : ""}`}>
                <td className="p-2 whitespace-nowrap">{jstDate(s.created_at)}{isOwner && <div className="text-xs text-muted-foreground">{s.shops?.name}</div>}</td>
                <td className="p-2">
                  <div className="font-mono">{s.receipts?.receipt_no}</div>
                  {(s.receipts?.items ?? []).filter((i) => i.model && !/^Shipping fee/.test(i.model)).map((i, k) => <div key={k} className="text-xs text-muted-foreground">{i.model} {i.storage}</div>)}
                </td>
                <td className="p-2">{s.recipient_name || "—"}{s.recipient_phone && <div className="text-xs">{s.recipient_phone}</div>}{s.address && <div className="max-w-56 text-xs text-muted-foreground">{s.postal_code} {s.address}</div>}</td>
                <td className="p-2">{s.platform || "—"}</td>
                <td className="p-2 text-right">{s.cod ? yen(s.cod_amount) : "—"}</td>
                <td className="p-2">
                  {s.tracking_number ? <div className="space-y-1"><div className="font-mono text-xs">{s.carrier} {s.tracking_number}</div><TrackButton carrier={s.carrier} number={s.tracking_number} /></div> : <span className="text-muted-foreground">Not added</span>}
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[s.status] ?? ""}`}>{statusLabel(s.status)}</span>
                  {isOverdue(s) && <div className="mt-1 text-xs font-semibold text-destructive">Not delivered after {OVERDUE_DAYS} days</div>}
                  {s.delivered_at && <div className="mt-1 text-xs text-muted-foreground">Delivered {jstDateTime(s.delivered_at)}</div>}
                  {s.note && <div className="mt-1 text-xs text-muted-foreground">{s.note}</div>}
                </td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => setEdit(s)}>Update</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <UpdateShipment shipment={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function UpdateShipment({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(shipment.status);
  const [carrier, setCarrier] = useState(shipment.carrier ?? "");
  const [tracking, setTracking] = useState(shipment.tracking_number ?? "");
  const [note, setNote] = useState(shipment.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const { error } = await db.rpc("update_shipment", { _id: shipment.id, _status: status, _carrier: carrier, _tracking_number: tracking, _note: note });
    setBusy(false);
    if (error) return setError(error.message);
    await qc.invalidateQueries({ queryKey: ["shipments"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent>
        <DialogTitle>Shipment {shipment.receipts?.receipt_no}</DialogTitle>
        <label className="space-y-1 text-sm">Status
          <select className="field" aria-label="Shipment status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {SHIPMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <div className="space-y-1 text-sm">Carrier and tracking number
          <TrackingFields carrier={carrier} number={tracking} onCarrier={setCarrier} onNumber={setTracking} />
        </div>
        <Input aria-label="Note" placeholder="Note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
