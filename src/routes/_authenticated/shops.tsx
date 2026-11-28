import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shopsQuery, meQuery } from "@/lib/app";
import { settingsQuery, useCurrentShop } from "@/lib/shop-context";
import { pageMeta } from "@/lib/metadata";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShopLogo } from "@/components/ShopLogo";
import { db } from "@/lib/catalog";
import { getPosition } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/shops")({
  head: () => pageMeta("Shops — Mobile Shop Manager", "Manage shop contact details, receipt profiles and transfer time limits."),
  beforeLoad: async ({ context }) => { const me = await context.queryClient.ensureQueryData(meQuery); if (me?.role !== "owner") throw redirect({ to: "/sell" }); },
  component: Shops,
});
const blank = { name: "", address: "", postal_code: "", phone: "", email: "", receipt_footer: "", logo: "" };
function Shops() {
  const qc = useQueryClient();
  const { shopId, setShopId } = useCurrentShop();
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: limit = 24 } = useQuery(settingsQuery);
  const [id, setId] = useState(shopId);
  const [profile, setProfile] = useState(blank);
  const [hours, setHours] = useState("24");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setHours(String(limit)); }, [limit]);
  useEffect(() => { if (!id && shops[0]) setId(shops[0].id); }, [id, shops]);
  useEffect(() => { const s = shops.find(s => s.id === id); if (s) setProfile({ ...s, logo: s.logo ?? "" }); setFile(null); }, [id, shops]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      let logo = profile.logo;
      if (file) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("Choose a PNG, JPEG or WebP logo under 2 MB");
        logo = `${id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
        const upload = await supabase.storage.from("shop-logos").upload(logo, file);
        if (upload.error) throw upload.error;
      }
      const { error } = await supabase.rpc("save_shop_profile", { _id: id, _name: profile.name, _address: profile.address, _postal_code: profile.postal_code, _phone: profile.phone, _email: profile.email, _receipt_footer: profile.receipt_footer, _logo: logo });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["shops"] }); setProfile(p => ({ ...p, logo })); setFile(null); setMessage("Shop profile saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save shop"); } finally { setBusy(false); }
  }
  async function saveLimit() {
    setError(""); setMessage("");
    const value = Number(hours);
    if (!Number.isInteger(value) || value < 1 || value > 8760) return setError("Enter a limit between 1 and 8760 hours");
    setBusy(true);
    const { error } = await supabase.rpc("save_transit_limit", { _hours: value });
    setBusy(false); if (error) return setError(error.message);
    await qc.invalidateQueries({ queryKey: ["settings"] }); await qc.invalidateQueries({ queryKey: ["transfers"] }); setMessage("Transfer time limit saved");
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Shops</h1><select aria-label="Shop profile" className="field sm:max-w-sm" value={id} onChange={e => { setId(e.target.value); setShopId(e.target.value); setMessage(""); setError(""); }}>{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    <form onSubmit={save} className="space-y-4"><ShopLogo path={profile.logo} name={profile.name} /><div className="grid gap-4 sm:grid-cols-2">{([['name','Shop name'],['address','Address'],['postal_code','Postal code'],['phone','Phone'],['email','Email']] as const).map(([key,label]) => <div className="space-y-1" key={key}><Label htmlFor={`shop-${key}`}>{label}</Label><Input id={`shop-${key}`} type={key === 'email' ? 'email' : 'text'} value={profile[key]} required={key === 'name'} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></div>)}<div className="space-y-1"><Label htmlFor="shop-logo">Logo (optional)</Label><Input id="shop-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div></div><div className="space-y-1"><Label htmlFor="shop-footer">Receipt footer</Label><textarea id="shop-footer" className="w-full rounded-md border bg-background p-3 text-sm" rows={3} value={profile.receipt_footer} onChange={e => setProfile(p => ({ ...p, receipt_footer: e.target.value }))} /></div><Button type="submit" disabled={busy || !id}>Save shop profile</Button></form>
    {id && <ShopLocation shopId={id} />}
    <div className="space-y-3 border-t pt-5"><h2 className="text-lg font-semibold">Transfer time limit</h2><Label htmlFor="transit-hours">Hours</Label><div className="flex gap-2"><Input id="transit-hours" className="w-28" type="number" min={1} max={8760} value={hours} onChange={e => setHours(e.target.value)} /><Button onClick={saveLimit} disabled={busy}>Save time limit</Button></div></div>{error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status" className="text-primary">{message}</p>}</div>;
}
function ShopLocation({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const { data, error: loadError } = useQuery({
    queryKey: ["shop-location", shopId],
    queryFn: async () => {
      const { data, error } = await db.from("shops").select("lat, lng, geofence_m").eq("id", shopId).maybeSingle();
      if (error) throw new Error("Run the attendance database update first");
      return data as { lat: number | null; lng: number | null; geofence_m: number } | null;
    },
  });
  const [coords, setCoords] = useState("");
  const [radius, setRadius] = useState("150");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setCoords(data?.lat != null ? `${data.lat}, ${data.lng}` : ""); setRadius(String(data?.geofence_m ?? 150)); setMsg(""); }, [data]);
  async function here() {
    setBusy(true); setMsg("");
    try { const p = await getPosition(); setCoords(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`); setMsg(`Got your location (±${Math.round(p.coords.accuracy)} m). Press Save.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not get location"); }
    finally { setBusy(false); }
  }
  async function save() {
    const m = coords.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return setMsg("Enter the location like 35.729500, 139.710900 (copy it from Google Maps)");
    setBusy(true); setMsg("");
    const { error } = await db.rpc("set_shop_location", { _shop_id: shopId, _lat: Number(m[1]), _lng: Number(m[2]), _radius: Number(radius) });
    setBusy(false);
    if (error) return setMsg(error.message);
    await qc.invalidateQueries({ queryKey: ["shop-location", shopId] });
    setMsg("Shop location saved. Staff can clock in within " + radius + " m of it.");
  }
  return (
    <div className="space-y-3 border-t pt-5">
      <h2 className="text-lg font-semibold">Shop location (for attendance)</h2>
      <p className="text-sm text-muted-foreground">Stand inside the shop and press "Use my location", or paste the shop's coordinates from Google Maps (right-click the shop → copy the numbers). Staff can only clock in near this point.</p>
      {loadError ? <p className="text-sm text-destructive">{(loadError as Error).message}</p> : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">Coordinates<Input className="w-64" value={coords} placeholder="35.729500, 139.710900" onChange={(e) => setCoords(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Allowed distance (m)<Input className="w-28" type="number" min={30} max={2000} value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void here()}>Use my location</Button>
            <Button type="button" disabled={busy} onClick={() => void save()}>Save location</Button>
            {data?.lat != null && <a className="text-sm text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${data.lat},${data.lng}`}>Check on map</a>}
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </>
      )}
    </div>
  );
}
