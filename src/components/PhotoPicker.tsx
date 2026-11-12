import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage, MAX_PHOTOS } from "@/lib/product-extras";

export type PickedPhoto = { blob: Blob; url: string };

/** Pick, compress and preview up to `max` photos before saving. */
export function PhotoPicker({ photos, onChange, max = MAX_PHOTOS, compact = false }: { photos: PickedPhoto[]; onChange: (p: PickedPhoto[]) => void; max?: number; compact?: boolean }) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [touch, setTouch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    setBusy(true);
    try {
      const room = max - photos.length;
      const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
      if (files.length > room) setErr(`Only ${max} photos allowed`);
      const out: PickedPhoto[] = [];
      for (const f of list) { const blob = await compressImage(f); out.push({ blob, url: URL.createObjectURL(blob) }); }
      onChange([...photos, ...out]);
    } catch { setErr("Could not read that image"); } finally { setBusy(false); if (camRef.current) camRef.current.value = ""; if (fileRef.current) fileRef.current.value = ""; }
  }
  const full = photos.length >= max;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p.url} className={`relative ${compact ? "size-12" : "size-20"}`}>
            <img src={p.url} alt={`Photo ${i + 1}`} className="size-full rounded-md border object-cover" />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => { URL.revokeObjectURL(p.url); onChange(photos.filter((x) => x !== p)); }} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X className="size-3" /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {touch && <Button type="button" size={compact ? "sm" : "default"} variant="outline" disabled={busy || full} onClick={() => camRef.current?.click()}><Camera className="size-4" />Take photo</Button>}
        <Button type="button" size={compact ? "sm" : "default"} variant="outline" disabled={busy || full} onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" />{compact ? "Photos" : "Choose files"}</Button>
        <span className="self-center text-xs text-muted-foreground">{busy ? "Compressing…" : `${photos.length}/${max}`}</span>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void add(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Choose photos" onChange={(e) => void add(e.target.files)} />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
