import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/app";
import { homeFor } from "@/lib/accounts";
import { logEvent, setRemember } from "@/lib/audit";
import { recordFailedLogin, requestPasswordReset } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Royal Japan Stock Management" },
      { name: "description", content: "Sign in to manage stock, sales and transfers across Royal Japan shops." },
      { property: "og:title", content: "Sign in — Royal Japan Stock Management" },
      { property: "og:description", content: "Sign in to manage stock, sales and transfers across Royal Japan shops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const failed = useServerFn(recordFailedLogin);
  const reset = useServerFn(requestPasswordReset);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRememberState] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      failed({ data: { email: email.trim() } }).catch(() => undefined);
      return setError(/banned/i.test(error.message) ? "This account is disabled. Ask the owner." : "Wrong email or password");
    }
    setRemember(remember);
    qc.clear();
    const me = await qc.fetchQuery(meQuery);
    if (me?.disabled) {
      await supabase.auth.signOut();
      setBusy(false);
      return setError("This account is disabled. Ask the owner.");
    }
    await logEvent("login", "auth", me?.id ?? "");
    setBusy(false);
    navigate({ to: homeFor(me?.role), replace: true });
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await reset({ data: { email: email.trim() } });
      setInfo("If this email has an account, a reset link is on its way.");
    } catch {
      setError("Enter a valid email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form method="post" onSubmit={mode === "login" ? submit : forgot} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/favicon.svg" alt="Royal Japan logo" className="size-14" />
          <h1 className="text-xl font-bold">Royal Japan Stock Management</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "Sign in to continue" : "Get a password reset link"}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "login" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRememberState(e.target.checked)} /> Remember me
              </label>
              <button type="button" className="text-primary" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}>Forgot password?</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Send reset link"}
        </Button>
        {mode === "forgot" && (
          <button type="button" className="w-full text-sm text-primary" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Back to sign in</button>
        )}
        <p className="text-center text-xs text-muted-foreground">Accounts are created by invitation only.</p>
      </form>
    </div>
  );
}
