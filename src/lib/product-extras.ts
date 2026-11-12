export const CARRIERS = ["Japan Post", "Yamato", "Sagawa", "Other"] as const;
export const MAX_PHOTOS = 6;

/** Official carrier tracking page with the number filled in; null when there is no official page. */
export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  const n = encodeURIComponent((number ?? "").replace(/\s/g, ""));
  if (!n) return null;
  if (carrier === "Japan Post") return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${n}&search.x=1&locale=ja`;
  if (carrier === "Yamato") return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${n}`;
  if (carrier === "Sagawa") return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${n}`;
  return null;
}

/** "" when the photo count is fine for this condition, otherwise the problem. */
export function photoProblem(condition: string, count: number): string {
  if (count > MAX_PHOTOS) return `At most ${MAX_PHOTOS} photos`;
  if ((condition === "Used B" || condition === "Used C") && count < 2) return `${condition} needs at least 2 photos`;
  if (count < 1) return "Add at least 1 photo";
  return "";
}

/** Resize to max 1600px on the long side and encode as JPG ~80%. Browser only. */
export async function compressImage(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read image"))), "image/jpeg", quality));
}
