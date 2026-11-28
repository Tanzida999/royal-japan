import { db } from "@/lib/catalog";

export type AttState = "off" | "in" | "out";
export type AttEvent = { kind: "clock_in" | "out_start" | "out_end" | "clock_out"; at: string; reason: string; shop_id: string | null; in_fence: boolean | null; distance_m: number | null; manual: boolean };
export type MyAttendance = { state: AttState; since: string | null; shop_id: string | null; trip_id: string | null; devices: string[]; today: AttEvent[] };

export const OUT_REASONS = ["Delivery", "Buying stock", "Bank / post office", "Customer visit", "Other shop", "Lunch outside", "Other"];
export const KIND_LABEL: Record<AttEvent["kind"], string> = { clock_in: "Clocked in", out_start: "Went out", out_end: "Back", clock_out: "Clocked out" };

const DEVICE_KEY = "rj-att-credential";

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

export function fingerprintSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

export function savedCredential() {
  try { return localStorage.getItem(DEVICE_KEY) ?? ""; } catch { return ""; }
}

/** Set up fingerprint / Face ID / phone PIN on this phone (a passkey only this site can use). */
export async function registerFingerprint(user: { id: string; email: string; name: string }) {
  if (!fingerprintSupported()) throw new Error("This phone or browser can't use fingerprint / Face ID. Use Chrome or Safari on your own phone.");
  const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
  if (ok === false) throw new Error("Turn on a screen lock (fingerprint, Face ID or PIN) on this phone first.");
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "Royal Japan Attendance", id: location.hostname },
      user: { id: new TextEncoder().encode(user.id), name: user.email || user.name, displayName: user.name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Fingerprint setup was cancelled");
  const id = b64url(cred.rawId);
  const label = `${/iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Device"} · ${new Date().toLocaleDateString("ja-JP")}`;
  const { error } = await db.rpc("register_attendance_device", { _credential_id: id, _label: label });
  if (error) throw new Error(error.message);
  try { localStorage.setItem(DEVICE_KEY, id); } catch { /* ignore */ }
  return id;
}

/** Ask for fingerprint / Face ID. Returns the credential id that was used. */
export async function verifyFingerprint(registered: string[]) {
  if (!registered.length) throw new Error("Set up fingerprint on this phone first");
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: location.hostname,
      allowCredentials: registered.map((id) => ({ type: "public-key" as const, id: fromB64url(id) })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Fingerprint check was cancelled");
  const data = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
  if (!(data[32] & 0x04)) throw new Error("Fingerprint / Face ID was not confirmed. Try again.");
  return b64url(cred.rawId);
}

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This phone can't share its location"));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(
      e.code === 1 ? "Location is blocked. Allow location for this site in the browser settings, then try again."
        : e.code === 3 ? "GPS took too long. Go near a window and try again." : "Could not get your location. Turn on GPS and try again.",
    )), { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
}

export function friendlyError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/NotAllowedError|not allowed|cancel/i.test(m) && !/Location/.test(m)) return "Fingerprint check was cancelled or timed out. Try again.";
  if (/attendance_punch|my_attendance|register_attendance_device|schema cache/.test(m)) return "Ask the owner to run the latest database update (attendance).";
  return m;
}

export const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
export const jstTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) : "—");
