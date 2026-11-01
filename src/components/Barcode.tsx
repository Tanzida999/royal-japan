import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 40, width = 1.6 }: { value: string; height?: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, fontSize: 12, margin: 0 });
    }
  }, [value, height, width]);
  return <svg ref={ref} />;
}
