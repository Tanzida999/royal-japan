import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/**
 * Camera barcode scanner.
 * - Uses the back camera at high resolution (phone) and the browser's built-in fast
 *   barcode reader when available, otherwise ZXing limited to the formats we use.
 * - `accept` lets the caller skip wrong barcodes on a box (EID, serial…) and keep scanning.
 */
export function CameraScan({ onScan, accept, label = "Scan with camera" }: {
  onScan: (code: string) => void;
  accept?: (code: string) => string | true; // true = use it, string = reason it was skipped
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  const acceptRef = useRef(accept);
  callback.current = onScan;
  acceptRef.current = accept;

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let stopZxing: (() => void) | undefined;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handle = (text: string) => {
      if (disposed) return false;
      const ok = acceptRef.current ? acceptRef.current(text) : true;
      if (ok !== true) { setSkipped(ok); return false; }
      disposed = true;
      callback.current(text);
      setOpen(false);
      return true;
    };
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    (async () => {
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (Native && video.current) {
        // Fast path (Android Chrome, Mac): native detector reads several barcodes per frame
        const detector = new Native({ formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "itf"] });
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (disposed || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (disposed || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            for (const c of codes) if (handle(c.rawValue)) return;
          } catch { /* frame not ready */ }
          timer = setTimeout(() => void tick(), 80);
        };
        void tick();
        return;
      }
      // Fallback: ZXing, only the barcode types used on phone boxes and our labels
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (disposed || !video.current) return;
      // DecodeHintType.POSSIBLE_FORMATS = 2, TRY_HARDER = 3; BarcodeFormat CODE_39=2, CODE_128=4, EAN_8=6, EAN_13=7, ITF=8, QR_CODE=11, UPC_A=14
      const hints = new Map<number, unknown>([[2, [4, 2, 7, 6, 14, 8, 11]], [3, true]]);
      const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 300 } as never);
      let ctl: { stop: () => void } | undefined;
      ctl = await reader.decodeFromConstraints(constraints, video.current, (result) => {
        if (result && handle(result.getText())) ctl?.stop();
      });
      stopZxing = () => ctl?.stop();
      if (disposed) ctl.stop();
    })().catch(() => { if (!disposed) setError("Camera unavailable. Allow camera access, or use a USB scanner / type the code."); });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => { setError(""); setSkipped(""); setOpen(true); }}><Camera className="size-4" />{label}</Button>
      {open && (
        <div role="dialog" aria-label="Scan barcode with camera" className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
          <div className="w-full max-w-lg space-y-3">
            <div className="relative">
              <video ref={video} muted playsInline autoPlay className="aspect-video w-full rounded-md bg-muted object-cover" />
              <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Hold one barcode inside the box, 10–15 cm from the camera, and keep it still.</p>
            {skipped && <p className="text-sm font-semibold text-amber-600">{skipped}</p>}
            {error && <p className="text-destructive">{error}</p>}
            <Button variant="outline" onClick={() => setOpen(false)}>Close camera</Button>
          </div>
        </div>
      )}
    </>
  );
}
