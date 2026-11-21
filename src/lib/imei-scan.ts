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
export function extractImei(raw: string): { imei: string; problem: string } {
  const text = toHalfWidth(raw).trim();
  const runs = text.match(/\d+/g) ?? [];
  for (const r of runs) {
    if (r.length === 15 && isValidImei(r)) return { imei: r, problem: "" };
    if (r.length === 16) { const im = r.slice(0, 14) + imeiCheckDigit(r.slice(0, 14)); return { imei: im, problem: "" }; } // IMEISV
    if (r.length === 30 && isValidImei(r.slice(0, 15))) return { imei: r.slice(0, 15), problem: "" }; // IMEI1+IMEI2
  }
  const r = runs.sort((a, b) => b.length - a.length)[0] ?? "";
  if (r.length === 15) return { imei: "", problem: `${r} is not a valid IMEI (check digit wrong). Scan again or type it carefully.` };
  if (r.length < 8 && /[A-Z]/i.test(text) && /[A-Z0-9]{8,}/i.test(text)) return { imei: "", problem: `"${text.slice(0, 20)}" is a serial or part number, not the IMEI. Scan the barcode labelled IMEI.` };
  if (r.length === 32) return { imei: "", problem: "That barcode is the EID, not the IMEI. Scan the barcode labelled IMEI." };
  if (r.length === 19 || r.length === 20) return { imei: "", problem: "That barcode is a SIM card number (ICCID), not the IMEI." };
  if (r.length === 12 || r.length === 13 || r.length === 8) return { imei: "", problem: "That is the product (JAN/UPC) barcode on the box, not the IMEI. Scan the barcode labelled IMEI." };
  return { imei: "", problem: r ? `Scanned ${r.length} digits. An IMEI has 15 digits.` : "Nothing readable was scanned. Try again." };
}

export type ImeiGuess = { model_id: string; storage: string; color: string; matches: number };

/**
 * The first 8 digits of an IMEI (TAC) identify the phone model. Look at phones already
 * added with the same TAC and reuse their model (and storage/colour when they were all the same).
 */
export async function guessFromImei(imei: string): Promise<ImeiGuess | null> {
  if (!/^\d{15}$/.test(imei)) return null;
  const { data, error } = await supabase
    .from("products")
    .select("model_id, storage, color, created_at")
    .like("imei", `${imei.slice(0, 8)}%`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data?.length) return null;
  const count = (key: "model_id" | "storage" | "color") => {
    const m = new Map<string, number>();
    for (const d of data) { const v = String(d[key] ?? ""); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const models = count("model_id");
  if (!models.length) return null;
  const only = (key: "storage" | "color") => { const c = count(key); return c.length === 1 ? c[0]![0] : ""; };
  return { model_id: models[0]![0], storage: only("storage"), color: only("color"), matches: data.length };
}
