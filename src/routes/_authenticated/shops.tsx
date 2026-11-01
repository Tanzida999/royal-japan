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
    <div className="space-y-3 border-t pt-5"><h2 className="text-lg font-semibold">Transfer time limit</h2><Label htmlFor="transit-hours">Hours</Label><div className="flex gap-2"><Input id="transit-hours" className="w-28" type="number" min={1} max={8760} value={hours} onChange={e => setHours(e.target.value)} /><Button onClick={saveLimit} disabled={busy}>Save time limit</Button></div></div>{error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status" className="text-primary">{message}</p>}</div>;
}