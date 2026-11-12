import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDate, meQuery, PRODUCT_SELECT, yen, type ProductRow } from "@/lib/app";
import { pageMeta } from "@/lib/metadata";
import { MAX_PHOTOS } from "@/lib/product-extras";
import { uploadProductPhotos } from "@/lib/product-photos";
import { ProductHistory } from "@/components/ProductHistory";
import { ProductPhotos } from "@/components/ProductPhotos";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { TrackButton, TrackingEditor } from "@/components/TrackingEditor";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/product/$id")({
  head: () => pageMeta("Phone details — Mobile Shop Manager", "Condition photos, location and shipping tracking for one phone."),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as ProductRow | null;
    },
  });
  const { data: photoCount = 0 } = useQuery({
    queryKey: ["product-photos", id, "count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("product_photos").select("id", { count: "exact", head: true }).eq("product_id", id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!p) return <p>Phone not found. <Link to="/stock" className="text-primary">Back to stock</Link></p>;
  const canEdit = me?.role === "owner" || (me?.shop_id != null && (me.shop_id === p.shop_id || me.shop_id === p.current_shop_id));
  async function savePhotos() {
    setBusy(true);
    setMsg(null);
    try {
      await uploadProductPhotos(id, picked.map((x) => x.blob));
      setPicked([]);
      setMsg({ ok: true, text: "Photos saved" });
      qc.invalidateQueries({ queryKey: ["product-photos", id] });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Photos not saved" }); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <Link to="/stock" className="text-sm text-primary">← Stock</Link>
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h1 className="text-2xl font-bold">{p.models?.brand} {p.models?.model}</h1>
        <p className="text-muted-foreground">{p.storage} · {p.color} · {p.condition} · {yen(p.selling_price)}</p>
        <p className="font-mono text-sm">{p.product_code} · IMEI {p.imei}</p>
        <p className="text-sm">Status: <span className="font-semibold">{p.status}</span> · At {p.shops?.name} · Added {jstDate(p.created_at)}</p>
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Condition photos</h2>
        <ProductPhotos productId={id} size="lg" />
        {canEdit && photoCount < MAX_PHOTOS && (
          <div className="space-y-2 border-t pt-3">
            <PhotoPicker photos={picked} onChange={setPicked} max={MAX_PHOTOS - photoCount} />
            {picked.length > 0 && <Button onClick={savePhotos} disabled={busy}>{busy ? "Uploading…" : `Save ${picked.length} photo(s)`}</Button>}
          </div>
        )}
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Shipping tracking</h2>
        {canEdit ? <TrackingEditor key={`${p.carrier}-${p.tracking_number}`} productId={id} carrier={p.carrier} number={p.tracking_number} /> : <div className="flex items-center gap-2 text-sm">{p.carrier ? `${p.carrier} ${p.tracking_number}` : "No tracking"}<TrackButton carrier={p.carrier} number={p.tracking_number} /></div>}
      </div>
      {me?.role === "owner" && (
        <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">History</h2>
          <ProductHistory productId={id} productCode={p.product_code} />
        </div>
      )}
    </div>
  );
}
