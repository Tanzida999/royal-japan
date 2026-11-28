import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Fingerprint, LogIn, LogOut, MapPin, Navigation, Undo2 } from "lucide-react";
import { meQuery, shopsQuery } from "@/lib/app";
import { db } from "@/lib/catalog";
import { pageMeta } from "@/lib/metadata";
import {
  fingerprintSupported, friendlyError, getPosition, jstTime, KIND_LABEL, OUT_REASONS, registerFingerprint, savedCredential, verifyFingerprint,
  type AttEvent, type MyAttendance,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => pageMeta("Attendance — Mobile Shop Manager", "Clock in and out with GPS and fingerprint."),
  component: Attendance,
});

const myQuery = {
  queryKey: ["my-attendance"],
  queryFn: async () => {
    const { data, error } = await db.rpc("my_attendance");
    if (error) throw new Error(friendlyError(error.message));
    return data as MyAttendance;
  },
  refetchInterval: 60_000,
};

function Attendance() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: att, error: loadError, isLoading } = useQuery(myQuery);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(false);
  const [tracking, setTracking] = useState<{ sent: number; last: string; problem: string }>({ sent: 0, last: "", problem: "" });

  const state = att?.state ?? "off";
  const devices = att?.devices ?? [];
  const thisPhone = savedCredential();
  const hasDevice = devices.length > 0;
  const shopName = (id: string | null) => shops.find((s) => s.id === id)?.name ?? "";

  async function setup() {
    if (!me) return;
    setBusy("setup"); setError("");
    try { await registerFingerprint(me); await qc.invalidateQueries({ queryKey: ["my-attendance"] }); }
    catch (e) { setError(friendlyError(e)); }
    finally { setBusy(""); }
  }

  async function punch(kind: AttEvent["kind"], why = "") {
    setBusy(kind); setError("");
    try {
      // fingerprint first (so the GPS reading is fresh), then location
      const credential = await verifyFingerprint(thisPhone && devices.includes(thisPhone) ? [thisPhone] : devices);
      const pos = await getPosition();
      const { data, error: e } = await db.rpc("attendance_punch", {
        _kind: kind, _lat: pos.coords.latitude, _lng: pos.coords.longitude, _accuracy: pos.coords.accuracy, _credential_id: credential, _reason: why,
      });
      if (e) throw new Error(e.message);
      qc.setQueryData(["my-attendance"], data);
      setPicking(false); setReason("");
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(""); }
  }

  // Live location while out: only while this page stays open
  const lastSent = useRef(0);
  useEffect(() => {
    if (state !== "out" || !navigator.geolocation) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    const watch = navigator.geolocation.watchPosition(async (pos) => {
      if (Date.now() - lastSent.current < 60_000) return;
      lastSent.current = Date.now();
      const { data, error: e } = await db.rpc("attendance_track", { _lat: pos.coords.latitude, _lng: pos.coords.longitude, _accuracy: pos.coords.accuracy });
      setTracking((t) => ({ sent: t.sent + (data ? 1 : 0), last: data ? new Date().toISOString() : t.last, problem: e ? e.message : "" }));
    }, (e) => setTracking((t) => ({ ...t, problem: e.code === 1 ? "Location is blocked — allow it in the browser settings" : "Waiting for GPS…" })), { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 });
    return () => { navigator.geolocation.clearWatch(watch); void lock?.release(); };
  }, [state]);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (loadError) return <p role="alert" className="text-destructive">{(loadError as Error).message}</p>;

  const badge = state === "in" ? "bg-emerald-600" : state === "out" ? "bg-amber-500" : "bg-muted-foreground";
  const label = state === "in" ? `At work${att?.shop_id ? ` · ${shopName(att.shop_id)}` : ""}` : state === "out" ? "Out of the shop" : "Not clocked in";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Attendance</h1>

      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <span className={`size-4 shrink-0 rounded-full ${badge}`} aria-hidden />
        <div className="mr-auto">
          <div className="text-lg font-semibold">{label}</div>
          {att?.since && state !== "off" && <div className="text-sm text-muted-foreground">since {jstTime(att.since)}</div>}
        </div>
        <div className="text-right text-sm text-muted-foreground">{me?.name}</div>
      </div>

      {!fingerprintSupported() ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">This browser can't use fingerprint / Face ID. Open the app in Chrome (Android) or Safari (iPhone) on your own phone.</p>
      ) : !hasDevice ? (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="font-semibold">First time: set up fingerprint on your phone</p>
          <p className="text-sm text-muted-foreground">Do this on your own phone. Your fingerprint / Face ID stays on the phone — the app only checks that it is you.</p>
          <Button className="h-14 w-full text-base" disabled={busy !== ""} onClick={() => void setup()}><Fingerprint /> {busy === "setup" ? "Waiting for fingerprint…" : "Set up fingerprint"}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state === "off" && (
            <Button className="h-20 w-full text-xl" disabled={busy !== ""} onClick={() => void punch("clock_in")}><LogIn className="size-6" /> {busy === "clock_in" ? "Checking…" : "Clock in"}</Button>
          )}
          {state === "in" && !picking && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 text-lg" disabled={busy !== ""} onClick={() => setPicking(true)}><Navigation /> Go out</Button>
              <Button variant="destructive" className="h-20 text-lg" disabled={busy !== ""} onClick={() => void punch("clock_out")}><LogOut /> {busy === "clock_out" ? "Checking…" : "Clock out"}</Button>
            </div>
          )}
          {state === "in" && picking && (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="font-semibold">Why are you going out?</p>
              <div className="grid grid-cols-2 gap-2">
                {OUT_REASONS.map((r) => <Button key={r} type="button" variant={reason === r ? "default" : "outline"} className="h-12" onClick={() => setReason(r)}>{r}</Button>)}
              </div>
              <p className="text-xs text-muted-foreground">While you are out, your location is saved every minute. Keep this page open on screen.</p>
              <div className="flex gap-2">
                <Button className="h-12 flex-1" disabled={!reason || busy !== ""} onClick={() => void punch("out_start", reason)}><Fingerprint /> {busy === "out_start" ? "Checking…" : "Confirm and go out"}</Button>
                <Button variant="ghost" className="h-12" onClick={() => { setPicking(false); setReason(""); }}>Cancel</Button>
              </div>
            </div>
          )}
          {state === "out" && (
            <>
              <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="flex items-center gap-2 font-semibold"><MapPin className="size-4" /> Sharing location while out</p>
                <p>Keep this page open. If you close it or lock the phone, tracking pauses until you open it again.</p>
                <p className="mt-1 text-xs">{tracking.last ? `Last sent ${jstTime(tracking.last)}` : "Waiting for GPS…"}{tracking.problem ? ` · ${tracking.problem}` : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-20 text-lg" disabled={busy !== ""} onClick={() => void punch("out_end")}><Undo2 /> {busy === "out_end" ? "Checking…" : "I'm back"}</Button>
                <Button variant="destructive" className="h-20 text-lg" disabled={busy !== ""} onClick={() => void punch("clock_out")}><LogOut /> {busy === "clock_out" ? "Checking…" : "Finish for today"}</Button>
              </div>
            </>
          )}
          {thisPhone && !devices.includes(thisPhone) && <p className="text-xs text-muted-foreground">Fingerprint was set up on a different phone. Use that phone, or ask the manager to reset it.</p>}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <h2 className="font-semibold">Today</h2>
        {(att?.today ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet today.</p> : (
          <ul className="divide-y rounded-lg border">
            {att!.today.map((e, i) => (
              <li key={i} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-14 font-mono">{jstTime(e.at)}</span>
                <span className="mr-auto font-medium">{KIND_LABEL[e.kind]}{e.reason ? ` · ${e.reason}` : ""}{e.manual ? " (added by manager)" : ""}</span>
                {e.in_fence === false && <span className="text-xs text-amber-600">{e.distance_m} m from shop</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Your location is only recorded when you press a button and while you are out. The owner and managers can see your times and trips.</p>
    </div>
  );
}
