import { Barcode } from "./Barcode";
import { yen } from "@/lib/app";

export type LabelData = {
  product_code: string;
  model: string;
  storage: string;
  selling_price: number;
  imei: string;
  color: string;
  condition: string;
  purchase_date: string;
  shop: string;
  battery?: number | null;
};

/** Small label; .print-area is the only thing visible when printing. */
export function PrintLabel({ data }: { data: LabelData }) {
  return (
    <div className="print-area label-print inline-block rounded-md border bg-card p-3 text-card-foreground">
      <div className="text-sm font-semibold leading-tight">{data.model}</div>
      <div className="text-xs">{data.storage} · {data.color} · {data.condition}{data.battery ? ` · Battery ${data.battery}%` : ""}</div>
      <div className="my-1">
        <Barcode value={data.product_code} />
      </div>
      <div className="text-base font-bold">{yen(data.selling_price)}</div>
      <div className="font-mono text-xs">IMEI: {data.imei}</div>
      <div className="text-xs">{data.purchase_date} · {data.shop}</div>
    </div>
  );
}

/**
 * Print labels on a Brother label printer with 62mm (2.4") continuous tape:
 * one label per 62mm x 45mm page, no margins.
 */
export function printLabels() {
  const style = document.createElement("style");
  style.textContent = `@page { size: 62mm 45mm; margin: 0; }
  @media print {
    .labels-sheet { display: block !important; }
    .label-print { width: 58mm !important; margin: 2mm !important; padding: 1mm !important; border: none !important; }
    .labels-sheet-item, .labels-sheet .label-print { break-after: page; page-break-after: always; }
    .labels-sheet-item:last-child, .labels-sheet .label-print:last-child { break-after: auto; page-break-after: auto; }
  }`;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => style.remove(), 1000);
}
