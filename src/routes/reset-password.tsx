import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/app";
import { homeFor } from "@/lib/accounts";
import { logEvent, setRemember } from "@/lib/audit";
import { pageMeta } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => pageMeta("Set your password — Royal Japan Stock Management", "Choose a password for your Royal Japan stock management account."),
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) setReady(true);
    });
    const t = setTimeout(() => supabase.auth.getSession().then(({ data }) => setReady(!!data.session)), 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) return setError("Password must be at least 8 characters");
    if (pw !== pw2) return setError("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setBusy(false); return setError(error.message); }
    setRemember(true);
    qc.clear();
    const me = await qc.fetchQuery(meQuery);
    await logEvent("password_changed", "auth", me?.id ?? "");
    navigate({ to: homeFor(me?.role), replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form method="post" onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/favicon.svg" alt="Royal Japan logo" className="size-14" />
          <h1 className="text-xl font-bold">Set your password</h1>
        </div>
        {ready === false ? (
          <p className="text-sm text-destructive">This link is invalid or has expired. Ask for a new one from the sign-in page.</p>
        ) : (
          <>
            <div className="space-y-1"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="pw2">Repeat password</Label><Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !ready}>{busy ? "Saving…" : "Save password"}</Button>
          </>
        )}
        <a href="/auth" className="block text-center text-sm text-primary">Back to sign in</a>
      </form>
    </div>
  );
}
