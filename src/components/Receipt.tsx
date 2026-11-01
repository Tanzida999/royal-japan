import { yen } from "@/lib/app";

export type ReceiptData = {
  shop: string;
  receipt_no: string;
  date: string;
  item: string;
  imei: string;
  price: number;
  payment: string;
  customer: string;
  staff: string;
};

export function Receipt({ receipt }: { receipt: ReceiptData }) {
  return (
    <div className="print-area receipt-print mx-auto max-w-xs space-y-2 rounded-xl border bg-card p-4 font-mono text-sm">
      <div className="text-center text-base font-bold">{receipt.shop}</div>
      <div className="text-center text-xs">Receipt {receipt.receipt_no}</div>
      <div className="text-xs">{receipt.date}</div>
      <hr />
      <div>{receipt.item}</div>
      <div className="text-xs">IMEI: {receipt.imei}</div>
      <hr />
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{yen(receipt.price)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span>Payment</span>
        <span>{receipt.payment}</span>
      </div>
      {receipt.customer && <div className="text-xs">Customer: {receipt.customer}</div>}
      <div className="text-xs">Staff: {receipt.staff}</div>
      <div className="pt-2 text-center text-xs">Thank you!</div>
    </div>
  );
}
