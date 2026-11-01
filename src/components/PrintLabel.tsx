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
};

/** Small label; .print-area is the only thing visible when printing. */
export function PrintLabel({ data }: { data: LabelData }) {
  return (
    <div className="print-area label-print inline-block rounded-md border bg-card p-3 text-card-foreground">
      <div className="text-sm font-semibold leading-tight">{data.model}</div>
      <div className="text-xs">{data.storage} · {data.color} · {data.condition}</div>
      <div className="my-1">
        <Barcode value={data.product_code} />
      </div>
      <div className="text-base font-bold">{yen(data.selling_price)}</div>
      <div className="font-mono text-xs">IMEI: {data.imei}</div>
      <div className="text-xs">{data.purchase_date} · {data.shop}</div>
    </div>
  );
}
