import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CameraScan({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  callback.current = onScan;
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let controls: { stop: () => void } | undefined;
    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (disposed || !video.current) return;
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, video.current, (result, _error, scanner) => {
        if (result && !disposed) { scanner.stop(); callback.current(result.getText()); setOpen(false); }
      });
      if (disposed) controls.stop();
    }).catch(() => { if (!disposed) setError("Camera unavailable. Allow camera access or type the barcode manually."); });
    return () => { disposed = true; controls?.stop(); };
  }, [open]);
  return <><Button type="button" variant="outline" onClick={() => { setError(""); setOpen(true); }}><Camera className="size-4" />Scan with camera</Button>{open && <div role="dialog" aria-label="Scan barcode with camera" className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4"><div className="w-full max-w-lg space-y-3"><video ref={video} muted playsInline className="aspect-video w-full rounded-md bg-muted" />{error && <p className="text-destructive">{error}</p>}<Button variant="outline" onClick={() => setOpen(false)}>Close camera</Button></div></div>}</>;
}