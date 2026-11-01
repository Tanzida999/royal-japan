import { pageMeta } from "@/lib/metadata";
import { useCurrentShop, settingsQuery } from "@/lib/shop-context";
import { ShopSelect } from "@/components/ShopSelect";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime, meQuery, shopsQuery } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => pageMeta("Transfers — Mobile Shop Manager", "Request, accept and receive phone transfers between shops."),
  component: Transfers,
});

type T = {
  id: string;
  product_id: string;
  from_shop_id: string;
  to_shop_id: string;
  status: string;
  requested_by: string;
  reject_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  received_at: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  products: { product_code: string; imei: string; storage: string; color: string; models: { brand: string; model: string } | null } | null;
};

const STATUSES = ["requested", "accepted", "rejected", "received", "cancelled", "expired"];

function Transfers() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const isOwner = me?.role === "owner";
  const { shopId: myShop } = useCurrentShop();
  const { data: limit = 24 } = useQuery(settingsQuery);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fStatus, setFStatus] = useState("");
  const fShop = myShop;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transfers", "list"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("id, product_id, from_shop_id, to_shop_id, status, requested_by, reject_reason, created_at, accepted_at, received_at, cancel_reason, cancelled_at, products(product_code, imei, storage, color, models(brand, model))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as T[];
    },
  });

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "?";
  const phone = (t: T) => `${t.products?.models?.brand ?? ""} ${t.products?.models?.model ?? ""} ${t.products?.storage ?? ""} ${t.products?.color ?? ""}`;

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await p;
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: ok });
    qc.invalidateQueries({ queryKey: ["transfers"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["find-products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const effectiveRows = rows.map(t => t.status === "requested" && new Date(t.created_at).getTime() + limit * 3_600_000 <= now.getTime() ? { ...t, status: "expired" } : t);
  const incoming = effectiveRows.filter((t) => t.status === "requested" && t.from_shop_id === myShop);
  const coming = effectiveRows.filter((t) => t.status === "accepted" && t.to_shop_id === myShop);
  const all = effectiveRows.filter((t) => (!fStatus || t.status === fStatus) && (!fShop || t.from_shop_id === fShop || t.to_shop_id === fShop));

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transfers</h1>
      {msg && <p className={`font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}

      {myShop && (
        <>
          <Section title={`Incoming requests (${incoming.length})`}>
            {incoming.map((t) => (
              <Row key={t.id} t={t} phone={phone(t)} shopName={shopName} limit={limit} now={now}>
                <IncomingActions
                  onAccept={() => run(supabase.rpc("respond_transfer", { _transfer_id: t.id, _accept: true, _reason: "" }), `Accepted ${t.products?.product_code} — now in transit`)}
                  onReject={(r) => run(supabase.rpc("respond_transfer", { _transfer_id: t.id, _accept: false, _reason: r }), `Rejected ${t.products?.product_code}`)}
                />
              </Row>
            ))}
          </Section>

          <Section title={`Coming to my shop (${coming.length})`}>
            {coming.map((t) => (
              <Row key={t.id} t={t} phone={phone(t)} shopName={shopName} limit={limit} now={now}>
                <ReceiveScan onReceive={(c) => run(supabase.rpc("receive_transfer", { _transfer_id: t.id, _code: c }), `Received ${t.products?.product_code}`)} />
              </Row>
            ))}
          </Section>
        </>
      )}

      <Section
        title={isOwner ? `All transfers (${all.length})` : `My shop's transfers (${all.length})`}
        filters={
          <div className="flex flex-wrap gap-2">
            <select className="field w-36" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {isOwner && (
              <ShopSelect />
            )}
          </div>
        }
      >
        {all.map((t) => (
          <Row key={t.id} t={t} phone={phone(t)} shopName={shopName} limit={limit} now={now}>
            {isOwner && t.status === "accepted" && t.accepted_at && new Date(t.accepted_at).getTime() + limit * 3_600_000 < now.getTime() && <OverdueCancel onCancel={reason => run(supabase.rpc("cancel_overdue_transfer", { _transfer_id: t.id, _reason: reason }), `Cancelled ${t.products?.product_code} — returned to source shop`)} />}
            {t.status === "requested" && t.requested_by === me?.id && (
              <Button size="sm" variant="outline" onClick={() => run(supabase.rpc("cancel_transfer", { _transfer_id: t.id }), `Cancelled ${t.products?.product_code}`)}>
                Cancel
              </Button>
            )}
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, filters, children }: { title: string; filters?: React.ReactNode; children: React.ReactNode[] }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted p-2">
        <span className="mr-auto text-sm font-semibold">{title}</span>
        {filters}
      </div>
      <ul className="divide-y text-sm">
        {children.length === 0 && <li className="p-3 text-muted-foreground">None</li>}
        {children}
      </ul>
    </div>
  );
}

function Row({ t, phone, shopName, children, limit, now }: { limit: number; now: Date; t: T; phone: string; shopName: (id: string) => string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="mr-auto">
        <div>
          <span className="font-mono">{t.products?.product_code}</span> {phone}
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-semibold">{t.status}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {shopName(t.from_shop_id)} → {shopName(t.to_shop_id)} · requested {jstDateTime(t.created_at)}
          {t.accepted_at && ` · ${t.status === "rejected" ? "rejected" : "accepted"} ${jstDateTime(t.accepted_at)}`}
          {t.received_at && ` · received ${jstDateTime(t.received_at)}`}
          {t.reject_reason && ` · reason: ${t.reject_reason}`}
          {t.cancel_reason && ` · cancellation: ${t.cancel_reason} · ${jstDateTime(t.cancelled_at ?? t.created_at)}`}
        </div>
      </div>
      {t.status === "accepted" && t.accepted_at && <TimeRemaining start={t.accepted_at} limit={limit} now={now} />}
      {children}
    </li>
  );
}

function IncomingActions({ onAccept, onReject }: { onAccept: () => void; onReject: (reason: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (rejecting)
    return (
      <div className="flex gap-2">
        <Input className="w-48" placeholder="Reason (required)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus />
        <Button size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => onReject(reason)}>Confirm reject</Button>
        <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>Back</Button>
      </div>
    );
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onAccept}>Accept</Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>Reject</Button>
    </div>
  );
}

function ReceiveScan({ onReceive }: { onReceive: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) onReceive(code.trim().toUpperCase());
        setCode("");
      }}
    >
      <Input className="w-48" placeholder="Scan phone barcode" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
      <Button size="sm" type="submit">Received</Button>
    </form>
  );
}

function TimeRemaining({ start, limit, now }: { start: string; limit: number; now: Date }) {
  const ms = new Date(start).getTime() + limit * 3_600_000 - now.getTime();
  const minutes = Math.ceil(Math.abs(ms) / 60_000);
  return <span className={`text-sm font-semibold ${ms < 0 ? "text-destructive" : "text-primary"}`}>{ms < 0 ? "Overdue by" : "Remaining"} {Math.floor(minutes / 60)}h {minutes % 60}m</span>;
}
function OverdueCancel({ onCancel }: { onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("");
  return open ? <div className="flex flex-wrap gap-2"><Input aria-label="Cancellation reason" placeholder="Cancellation reason" className="w-48" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /><Button variant="destructive" size="sm" disabled={!reason.trim()} onClick={() => onCancel(reason)}>Confirm cancellation</Button><Button variant="outline" size="sm" onClick={() => setOpen(false)}>Back</Button></div> : <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Cancel transfer</Button>;
}
