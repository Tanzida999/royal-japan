import { supabase } from "@/integrations/supabase/client";

/** Convert full-width digits/letters (typed when Japanese input is on) to normal ones. */
export const toHalfWidth = (s: string) =>
  s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");

/** Luhn check digit for the first 14 digits of an IMEI. */
export function imeiCheckDigit(d14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = Number(d14[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return String((10 - (sum % 10)) % 10);
}
export const isValidImei = (s: string) => /^\d{15}$/.test(s) && imeiCheckDigit(s.slice(0, 14)) === s[14];

/**
 * Pull a real IMEI out of whatever a scanner or camera produced.
 * Handles: "IMEI: 35…", full-width digits, IMEISV (16 digits), two IMEIs joined (30 digits),
 * and explains common wrong barcodes on phone boxes.
 */
export function extractImei(raw: string): { imei: string; problem: string; warning?: string } {
  const text = toHalfWidth(raw).trim();
  const runs = text.match(/\d+/g) ?? [];
  for (const r of runs) {
    if (r.length === 15 && isValidImei(r)) return { imei: r, problem: "" };
    if (r.length === 16) { const im = r.slice(0, 14) + imeiCheckDigit(r.slice(0, 14)); return { imei: im, problem: "" }; } // IMEISV
    if (r.length === 30 && isValidImei(r.slice(0, 15))) return { imei: r.slice(0, 15), problem: "" }; // IMEI1+IMEI2
  }
  const r = runs.sort((a, b) => b.length - a.length)[0] ?? "";
  if (r.length === 15) return { imei: r, problem: "", warning: "Check: the last digit of this IMEI looks unusual. Compare it with the box/phone before saving." };
  if (r.length < 8 && /[A-Z]/i.test(text) && /[A-Z0-9]{8,}/i.test(text)) return { imei: "", problem: `"${text.slice(0, 20)}" is a serial or part number, not the IMEI. Scan the barcode labelled IMEI.` };
  if (r.length === 32) return { imei: "", problem: "That barcode is the EID, not the IMEI. Scan the barcode labelled IMEI." };
  if (r.length === 19 || r.length === 20) return { imei: "", problem: "That barcode is a SIM card number (ICCID), not the IMEI." };
  if (r.length === 12 || r.length === 13 || r.length === 8) return { imei: "", problem: "That is the product (JAN/UPC) barcode on the box, not the IMEI. Scan the barcode labelled IMEI." };
  return { imei: "", problem: r ? `Scanned ${r.length} digits. An IMEI has 15 digits.` : "Nothing readable was scanned. Try again." };
}

export type ImeiGuess = { model_id: string; storage: string; color: string; matches: number };

/**
 * The first 8 digits of an IMEI (TAC) identify the phone model. Look at phones already
 * added (in any shop) with the same TAC and reuse their model, and the latest storage/colour.
 */
export async function guessFromImei(imei: string): Promise<ImeiGuess | null> {
  if (!/^\d{15}$/.test(imei)) return null;
  const rpc = await (supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: unknown; error: unknown }> })
    .rpc("imei_model_hint", { _imei: imei });
  if (!rpc.error) {
    const row = (rpc.data as { model_id: string; storage: string | null; color: string | null; matches: number }[] | null)?.[0];
    return row?.model_id ? { model_id: row.model_id, storage: row.storage ?? "", color: row.color ?? "", matches: row.matches } : null;
  }
  // Older database: look only at phones this login can see
  const { data, error } = await supabase
    .from("products")
    .select("model_id, storage, color, created_at")
    .like("imei", `${imei.slice(0, 8)}%`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data?.length) return null;
  const counts = new Map<string, number>();
  for (const d of data) if (d.model_id) counts.set(d.model_id, (counts.get(d.model_id) ?? 0) + 1);
  const model = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!model) return null;
  const same = data.filter((d) => d.model_id === model);
  return { model_id: model, storage: same.find((d) => d.storage)?.storage ?? "", color: same.find((d) => d.color)?.color ?? "", matches: same.length };
}

/** Short beep: high = scan OK, low = problem. Silent if the browser blocks audio. */
export function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 300; g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination); o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    o.onended = () => void ctx.close();
  } catch { /* no sound available */ }
}

/**
 * Clean any scanned/typed code (IMEI, product code, serial, SKU):
 * full-width → normal, uppercase, no spaces. If it contains a real IMEI
 * ("IMEI: 35…", IMEISV, two IMEIs joined) the IMEI is returned.
 */
export function normalizeScan(raw: string): string {
  const text = toHalfWidth(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!text) return "";
  if (/\d{15}/.test(text)) {
    const { imei } = extractImei(text);
    if (imei) return imei;
  }
  return text.replace(/^IMEI[:：]?/, "");
}

/** True for a valid JAN/EAN-13, EAN-8 or UPC-A box barcode (check digit verified). */
export function isJanCode(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== check) return false;
  return !isStoreCode(code);
}

/**
 * Shop-internal / price-sticker barcodes (EAN-13 starting with 2, UPC starting with 2 or 4,
 * EAN-8 starting with 0 or 2). They are reused for different items, so they must never be
 * treated as a product's box barcode.
 */
export function isStoreCode(code: string): boolean {
  if (code.length === 13) return code[0] === "2" || /^0[24]/.test(code);
  if (code.length === 12) return code[0] === "2" || code[0] === "4";
  if (code.length === 8) return code[0] === "0" || code[0] === "2";
  return false;
}

export type Sku = { jan: string; model_id: string; storage: string; color: string };

/** Model / storage / colour saved for a box barcode, or null if this box was never added. */
export async function lookupSku(jan: string): Promise<Sku | null> {
  const db = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Sku | null; error: unknown }> } } } };
  const { data, error } = await db.from("product_skus").select("jan, model_id, storage, color").eq("jan", jan).maybeSingle();
  return error ? null : data;
}

/** Remember which model/storage/colour a box barcode is (ignored if the database isn't updated yet). */
export async function learnSku(jan: string, modelId: string, storage: string, color: string) {
  if (!jan || !modelId) return;
  const db = supabase as unknown as { rpc: (f: string, a: object) => Promise<unknown> };
  try { await db.rpc("learn_sku", { _jan: jan, _model_id: modelId, _storage: storage, _color: color }); } catch { /* not critical */ }
}
