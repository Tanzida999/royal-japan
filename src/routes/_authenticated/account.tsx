import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/app";
import { logEvent } from "@/lib/audit";
import { pageMeta } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => pageMeta("My account — Royal Japan Stock Management", "Your profile and password."),
  component: Account,
});

function Account() {
  const { data: me } = useQuery(meQuery);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters" });
    if (pw !== pw2) return setMsg({ ok: false, text: "Passwords do not match" });
    setBusy(true);
    try {
      const { error: ce } = await supabase.auth.signInWithPassword({ email: me?.email ?? "", password: cur });
      if (ce) throw new Error("Current password is wrong");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await logEvent("password_changed", "auth", me?.id ?? "");
      setCur(""); setPw(""); setPw2("");
      setMsg({ ok: true, text: "Password changed" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not change password" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h1 className="text-2xl font-bold">My account</h1>
        <p className="text-sm text-muted-foreground">{me?.name} · {me?.email} · {me?.manager ? "manager" : me?.role}</p>
      </div>
      <form onSubmit={submit} className="max-w-sm space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1"><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="npw">New password</Label><Input id="npw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="npw2">Repeat new password</Label><Input id="npw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
      </form>
    </div>
  );
}
