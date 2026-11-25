import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { jstDate, jstDateTime, meQuery, shopsQuery, yen } from "@/lib/app";
import { pageMeta } from "@/lib/metadata";
import { db } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/web-requests")({
  head: () => pageMeta("Website Requests — Mobile Shop Manager", "Buyback requests and repair bookings from kaitorinihon.jp."),
  component: WebRequests,
});

type Kind = "buyback" | "repair";
type Buyback = { id: string; request_no: string; method: string; model_text: string; storage: string | null; grade: string | null; quoted_price: number | null; condition_note: string | null; name: string; phone: string | null; email: string | null; postal_code: string | null; address: string | null; shop_id: string | null; preferred_date: string | null; message: string | null; status: string; staff_note: string | null; created_at: string };
type Repair = { id: string; booking_no: string; model_text: string; problem: string; shop_id: string | null; preferred_at: string | null; name: string; phone: string | null; email: string | null; message: string | null; status: string; staff_note: string | null; created_at: string };

const STATUSES: Record<Kind, { value: string; label: string }[]> = {
  buyback: [{ value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "received", label: "Phone received" }, { value: "bought", label: "Bought" }, { value: "cancelled", label: "Cancelled" }],
  repair: [{ value: "new", label: "New" }, { value: "confirmed", label: "Confirmed" }, { value: "done", label: "Done" }, { value: "cancelled", label: "Cancelled" }],
};
const GRADE_JA: Record<string, string> = { unused: "未使用", used_a: "中古A", used_b: "中古B", used_c: "中古C", junk: "ジャンク" };
const badge: Record<string, string> = { new: "bg-amber-100 text-amber-900", contacted: "bg-blue-100 text-blue-900", confirmed: "bg-blue-100 text-blue-900", received: "bg-blue-100 text-blue-900", bought: "bg-green-100 text-green-900", done: "bg-green-100 text-green-900", cancelled: "bg-muted text-foreground" };

function WebRequests() {
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const [kind, setKind] = useState<Kind>("buyback");
  const [status, setStatus] = useState("open");
  const [edit, setEdit] = useState<{ kind: Kind; id: string; no: string; status: string; note: string } | null>(null);
  const shopName = (id: string | null) => (id ? shops.find((s) => s.id === id)?.name ?? "" : "Any shop");

  const { data: buybacks = [], error: e1 } = useQuery({
    queryKey: ["web-requests", "buyback"],
    queryFn: async () => {
      const { data, error } = await db.from("buyback_requests").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error; return (data ?? []) as Buyback[];
    },
    refetchInterval: 60_000,
  });
  const { data: repairs = [], error: e2 } = useQuery({
    queryKey: ["web-requests", "repair"],
    queryFn: async () => {
      const { data, error } = await db.from("repair_bookings").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error; return (data ?? []) as Repair[];
    },
    refetchInterval: 60_000,
  });
  const open = (s: string) => !["bought", "done", "cancelled"].includes(s);
  const filter = <T extends { status: string }>(rows: T[]) => rows.filter((r) => status === "" || (status === "open" ? open(r.status) : r.status === status));
  const newCount = { buyback: buybacks.filter((r) => r.status === "new").length, repair: repairs.filter((r) => r.status === "new").length };

  return (
    <div className="space-y-4">
      <div className="page-toolbar">
        <h1 className="mr-auto text-2xl font-bold">Website Requests</h1>
        <select className="field w-full sm:w-44" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open (not finished)</option>
          <option value="">All</option>
          {STATUSES[kind].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={kind === "buyback" ? "default" : "outline"} onClick={() => { setKind("buyback"); setStatus("open"); }}>Buyback requests 買取申込 {newCount.buyback > 0 && `(${newCount.buyback} new)`}</Button>
        <Button variant={kind === "repair" ? "default" : "outline"} onClick={() => { setKind("repair"); setStatus("open"); }}>Repair bookings 修理予約 {newCount.repair > 0 && `(${newCount.repair} new)`}</Button>
      </div>
      {(e1 || e2) && <p role="alert" className="text-destructive">Could not load requests. Run the website database update first.</p>}

      <div className="space-y-3">
        {kind === "buyback" && filter(buybacks).map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{r.request_no}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.status] ?? ""}`}>{STATUSES.buyback.find((s) => s.value === r.status)?.label}</span>
              <span className="text-muted-foreground">{jstDateTime(r.created_at)} · {r.method === "mail" ? "Mail-in 郵送買取" : "In store 店頭買取"} · {shopName(r.shop_id)}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEdit({ kind: "buyback", id: r.id, no: r.request_no, status: r.status, note: r.staff_note ?? "" })}>Update</Button>
            </div>
            <p className="mt-2 text-base font-semibold">{r.model_text} {r.storage} {r.grade ? GRADE_JA[r.grade] : ""} {r.quoted_price != null && <span className="text-primary">· Website price {yen(r.quoted_price)}</span>}</p>
            <p>{r.name} · {r.phone} {r.email}</p>
            {r.preferred_date && <p>Preferred date: {jstDate(r.preferred_date)}</p>}
            {r.address && <p>Address: {r.postal_code} {r.address}</p>}
            {r.condition_note && <p>Condition: {r.condition_note}</p>}
            {r.message && <p className="text-muted-foreground">“{r.message}”</p>}
            {r.staff_note && <p className="mt-1 text-xs text-primary">Staff note: {r.staff_note}</p>}
            {r.status === "received" && <Link to="/add" className="mt-2 inline-block text-primary underline">Add this phone to stock →</Link>}
          </div>
        ))}
        {kind === "repair" && filter(repairs).map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{r.booking_no}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.status] ?? ""}`}>{STATUSES.repair.find((s) => s.value === r.status)?.label}</span>
              <span className="text-muted-foreground">{jstDateTime(r.created_at)} · {shopName(r.shop_id)}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEdit({ kind: "repair", id: r.id, no: r.booking_no, status: r.status, note: r.staff_note ?? "" })}>Update</Button>
            </div>
            <p className="mt-2 text-base font-semibold">{r.model_text} — {r.problem}</p>
            <p>{r.name} · {r.phone} {r.email}</p>
            {r.preferred_at && <p>Preferred time: {jstDateTime(r.preferred_at)}</p>}
            {r.message && <p className="text-muted-foreground">“{r.message}”</p>}
            {r.staff_note && <p className="mt-1 text-xs text-primary">Staff note: {r.staff_note}</p>}
          </div>
        ))}
        {((kind === "buyback" && !filter(buybacks).length) || (kind === "repair" && !filter(repairs).length)) && <p className="text-muted-foreground">Nothing here.</p>}
      </div>
      {edit && <UpdateRequest {...edit} staffName={me?.name ?? ""} onClose={() => setEdit(null)} />}
    </div>
  );
}

function UpdateRequest({ kind, id, no, status: initial, note: initialNote, onClose }: { kind: Kind; id: string; no: string; status: string; note: string; staffName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const { error } = await db.rpc("update_web_request", { _kind: kind, _id: id, _status: status, _note: note });
    setBusy(false);
    if (error) return setError(error.message);
    await qc.invalidateQueries({ queryKey: ["web-requests"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent>
        <DialogTitle>Update {no}</DialogTitle>
        <select className="field" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES[kind].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Input aria-label="Staff note" placeholder="Note (e.g. called, coming Saturday)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
