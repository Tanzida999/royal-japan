import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Map as MapIcon } from "lucide-react";
import { meQuery } from "@/lib/app";
import { db } from "@/lib/catalog";
import { pageMeta } from "@/lib/metadata";
import { friendlyError, hm, jstTime, KIND_LABEL, type AttEvent } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/attendance-report")({
  head: () => pageMeta("Attendance report — Mobile Shop Manager", "Monthly staff hours, trips and missed clock-outs."),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner" && !me?.manager) throw redirect({ to: "/attendance" });
  },
  component: Report,
});

type Day = { staff_id: string; name: string; staff_code: string; day: string; first_in: string | null; last_out: string | null; worked_min: number; outside_min: number; trips: number; open_day: boolean; outside_fence: boolean | null; manual: boolean | null };
type Ev = AttEvent & { id: string; staff_id: string; lat: number | null; lng: number | null; note: string };

const thisMonth = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
const weekday = (d: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${d}T12:00:00+09:00`).getUTCDay()];

function Report() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(thisMonth());
  const [open, setOpen] = useState<string>("");
  const [dayView, setDayView] = useState<{ staff_id: string; name: string; day: string } | null>(null);
  const [fix, setFix] = useState<{ staff_id: string; name: string; day: string } | null>(null);
  const [message, setMessage] = useState("");

  const { data: rows = [], error, isLoading } = useQuery({
    queryKey: ["attendance-month", month],
    queryFn: async () => {
      const { data, error: e } = await db.rpc("attendance_month", { _month: `${month}-01` });
      if (e) throw new Error(friendlyError(e.message));
      return data as Day[];
    },
  });

  const staff = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code: string; days: Day[]; worked: number; outside: number; trips: number; open: number }>();
    for (const r of rows) {
      const s = m.get(r.staff_id) ?? { id: r.staff_id, name: r.name, code: r.staff_code, days: [], worked: 0, outside: 0, trips: 0, open: 0 };
      s.days.push(r); s.worked += r.worked_min; s.outside += r.outside_min; s.trips += r.trips; if (r.open_day) s.open += 1;
      m.set(r.staff_id, s);
    }
    return [...m.values()];
  }, [rows]);

  function csv() {
    const head = ["Staff", "Code", "Date", "Day", "Clock in", "Clock out", "Hours", "Outside (h:mm)", "Trips", "Missing clock-out", "Outside shop area", "Fixed by manager"];
    const lines = rows.map((r) => [r.name, r.staff_code, r.day, weekday(r.day), jstTime(r.first_in), jstTime(r.last_out), (r.worked_min / 60).toFixed(2), hm(r.outside_min), r.trips, r.open_day ? "YES" : "", r.outside_fence ? "YES" : "", r.manual ? "YES" : ""]);
    const total = staff.map((s) => [s.name, s.code, "TOTAL", "", "", "", (s.worked / 60).toFixed(2), hm(s.outside), s.trips, s.open || "", "", ""]);
    const text = [head, ...lines, [], ...total].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = `attendance-${month}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  async function resetDevice(id: string, name: string) {
    setMessage("");
    const { error: e } = await db.rpc("reset_attendance_device", { _staff_id: id });
    setMessage(e ? friendlyError(e.message) : `Fingerprint reset for ${name}. They can set it up again on their phone.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-2xl font-bold">Attendance report</h1>
        <label className="text-sm">Month <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></label>
        <Button variant="outline" disabled={!rows.length} onClick={csv}><Download /> Download CSV</Button>
      </div>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="text-destructive">{(error as Error).message}</p>}
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : staff.length === 0 ? <p className="text-muted-foreground">No attendance this month.</p> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Staff</th><th className="p-2">Days</th><th className="p-2">Hours</th><th className="p-2">Outside</th><th className="p-2">Trips</th><th className="p-2">Missing clock-out</th><th className="p-2" /></tr></thead>
            <tbody>
              {staff.map((s) => (
                <Fragment key={s.id}>
                  <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpen(open === s.id ? "" : s.id)}>
                    <td className="p-2 font-semibold">{open === s.id ? <ChevronDown className="inline size-4" /> : <ChevronRight className="inline size-4" />} {s.name} <span className="text-xs text-muted-foreground">{s.code}</span></td>
                    <td className="p-2">{s.days.length}</td>
                    <td className="p-2 font-mono">{hm(s.worked)}</td>
                    <td className="p-2 font-mono">{hm(s.outside)}</td>
                    <td className="p-2">{s.trips}</td>
                    <td className={`p-2 ${s.open ? "font-semibold text-destructive" : ""}`}>{s.open || "—"}</td>
                    <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void resetDevice(s.id, s.name); }}>Reset fingerprint</Button></td>
                  </tr>
                  {open === s.id && s.days.map((d) => (
                    <tr key={d.day} className="border-t bg-muted/20">
                      <td className="p-2 pl-8">{d.day.slice(5)} ({weekday(d.day)})</td>
                      <td className="p-2 font-mono" colSpan={1}>{jstTime(d.first_in)}–{d.open_day && !d.last_out ? "?" : jstTime(d.last_out)}</td>
                      <td className="p-2 font-mono">{hm(d.worked_min)}</td>
                      <td className="p-2 font-mono">{hm(d.outside_min)}</td>
                      <td className="p-2">{d.trips || ""}</td>
                      <td className="p-2 text-xs">
                        {d.open_day && <span className="mr-1 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">No clock-out</span>}
                        {d.outside_fence && <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Outside shop area</span>}
                        {d.manual && <span className="rounded bg-muted px-1.5 py-0.5">Fixed</span>}
                      </td>
                      <td className="space-x-1 p-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setDayView({ staff_id: s.id, name: s.name, day: d.day })}><MapIcon /> Details</Button>
                        <Button size="sm" variant="ghost" onClick={() => setFix({ staff_id: s.id, name: s.name, day: d.day })}>Add missed</Button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Hours = clock in → clock out (time outside the shop is included). A day with no clock-out counts 0 hours until you add the missed clock-out. Times are Japan time.</p>
      {dayView && <DayDetail {...dayView} onClose={() => setDayView(null)} />}
      {fix && <FixDialog {...fix} onClose={() => setFix(null)} onSaved={() => { setFix(null); void qc.invalidateQueries({ queryKey: ["attendance-month"] }); }} />}
    </div>
  );
}

const dayRange = (day: string) => [new Date(`${day}T00:00:00+09:00`).toISOString(), new Date(`${day}T23:59:59.999+09:00`).toISOString()];

function DayDetail({ staff_id, name, day, onClose }: { staff_id: string; name: string; day: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-day", staff_id, day],
    queryFn: async () => {
      const [from, to] = dayRange(day);
      const { data: ev, error } = await db.from("attendance_events").select("*").eq("staff_id", staff_id).gte("at", from).lte("at", to).order("at");
      if (error) throw error;
      const trips = (ev as Ev[]).filter((e) => e.kind === "out_start").map((e) => e.id);
      const { data: pts } = trips.length ? await db.from("attendance_points").select("trip_id, at, lat, lng").in("trip_id", trips).order("at") : { data: [] };
      return { ev: ev as Ev[], pts: (pts ?? []) as { trip_id: string; at: string; lat: number; lng: number }[] };
    },
  });
  const route = (tripId: string) => {
    const p = data?.pts.filter((x) => x.trip_id === tripId) ?? [];
    if (!p.length) return "";
    const step = Math.max(1, Math.ceil(p.length / 10)); // Google Maps allows ~10 stops in a link
    const pick = p.filter((_, i) => i % step === 0); if (pick[pick.length - 1] !== p[p.length - 1]) pick.push(p[p.length - 1]);
    return `https://www.google.com/maps/dir/${pick.map((x) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`).join("/")}`;
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>{name} · {day}</DialogTitle>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
          <ul className="divide-y rounded-lg border text-sm">
            {data?.ev.map((e) => (
              <li key={e.id} className="space-y-1 p-3">
                <div className="flex gap-3"><span className="w-14 font-mono">{jstTime(e.at)}</span><span className="mr-auto font-medium">{KIND_LABEL[e.kind]}{e.reason ? ` · ${e.reason}` : ""}</span>
                  {e.lat != null && <a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}>Map</a>}</div>
                <div className="pl-[4.25rem] text-xs text-muted-foreground">
                  {e.manual ? `Added by manager: ${e.note}` : e.distance_m != null ? `${e.distance_m} m from shop${e.in_fence === false ? " (outside shop area)" : ""}` : ""}
                  {e.kind === "out_start" && (route(e.id)
                    ? <> · {data.pts.filter((x) => x.trip_id === e.id).length} location points · <a className="text-primary underline" target="_blank" rel="noreferrer" href={route(e.id)}>Open route in Google Maps</a></>
                    : " · no location points (page was closed)")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixDialog({ staff_id, name, day, onClose, onSaved }: { staff_id: string; name: string; day: string; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<AttEvent["kind"]>("clock_out");
  const [time, setTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    const { error: e } = await db.rpc("attendance_add_manual", { _staff_id: staff_id, _kind: kind, _at: new Date(`${day}T${time}:00+09:00`).toISOString(), _note: note });
    setBusy(false);
    if (e) return setError(friendlyError(e.message));
    onSaved();
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent>
        <DialogTitle>Add missed punch · {name} · {day}</DialogTitle>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">What<select className="field" value={kind} onChange={(e) => setKind(e.target.value as AttEvent["kind"])}>{(Object.keys(KIND_LABEL) as AttEvent["kind"][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
          <label className="space-y-1 text-sm">Time (Japan)<Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <label className="space-y-1 text-sm">Reason (saved in the activity log)<Input value={note} maxLength={300} placeholder="Forgot to clock out — confirmed with staff" onChange={(e) => setNote(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button disabled={busy || note.trim().length < 3 || !time} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
      </DialogContent>
    </Dialog>
  );
}
