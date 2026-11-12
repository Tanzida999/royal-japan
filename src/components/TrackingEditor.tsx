import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CARRIERS, trackingUrl } from "@/lib/product-extras";

export function TrackButton({ carrier, number }: { carrier: string | null; number: string | null }) {
  const url = trackingUrl(carrier, number);
  if (!url) return null;
  return <Button asChild size="sm" variant="outline"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Track</a></Button>;
}

/** Carrier + tracking number inputs (controlled). */
export function TrackingFields({ carrier, number, onCarrier, onNumber }: { carrier: string; number: string; onCarrier: (v: string) => void; onNumber: (v: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select aria-label="Carrier" className="field" value={carrier} onChange={(e) => onCarrier(e.target.value)}>
        <option value="">No shipping</option>
        {CARRIERS.map((c) => <option key={c}>{c}</option>)}
      </select>
      <Input aria-label="Tracking number" placeholder="Tracking number" value={number} maxLength={40} onChange={(e) => onNumber(e.target.value)} />
    </div>
  );
}

export function TrackingEditor({ productId, carrier, number }: { productId: string; carrier: string | null; number: string | null }) {
  const qc = useQueryClient();
  const [c, setC] = useState(carrier ?? "");
  const [n, setN] = useState(number ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("set_product_tracking", { _product_id: productId, _carrier: c, _tracking_number: n });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Shipping saved" });
    ["product", "stock", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }
  return (
    <div className="space-y-2">
      <TrackingFields carrier={c} number={n} onCarrier={setC} onNumber={setN} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save shipping"}</Button>
        <TrackButton carrier={carrier} number={number} />
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
