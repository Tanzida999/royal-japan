import { yen } from "@/lib/app";
import { ShopLogo } from "./ShopLogo";

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
  customer_phone?: string;
  address?: string;
  postal_code?: string;
  phone?: string;
  logo?: string | null;
  footer?: string;
  items?: { model: string; storage: string; color: string; condition?: string; imei: string; price: number }[];
  subtotal?: number;
  discount?: number;
  paid?: number;
  change?: number;
};

export function Receipt({ receipt, format = "thermal" }: { receipt: ReceiptData; format?: "thermal" | "a4" }) {
  return (
    <div className={`print-area receipt-print ${format === "a4" ? "receipt-a4 max-w-3xl" : "max-w-xs"} mx-auto space-y-2 rounded-xl border bg-card p-4 font-mono text-sm`}>
      <ShopLogo path={receipt.logo} name={receipt.shop} />
      <div className="text-center text-base font-bold">{receipt.shop}</div>
      {receipt.address && <div className="text-center text-xs">{receipt.postal_code} {receipt.address}</div>}
      {receipt.phone && <div className="text-center text-xs">Tel: {receipt.phone}</div>}
      <div className="text-center text-xs">Receipt {receipt.receipt_no}</div>
      <div className="text-xs">{receipt.date}</div>
      <hr />
      {receipt.items ? receipt.items.map(i => <div key={i.imei} className="space-y-1 border-b pb-2"><div>{i.model} {i.storage} {i.color}</div><div className="text-xs">IMEI: {i.imei}</div><div className="text-right">{yen(i.price)}</div></div>) : <><div>{receipt.item}</div><div className="text-xs">IMEI: {receipt.imei}</div></>}
      <hr />
      <div className="flex justify-between"><span>Subtotal</span><span>{yen(receipt.subtotal ?? receipt.price)}</span></div>
      <div className="flex justify-between"><span>Discount</span><span>{yen(receipt.discount ?? 0)}</span></div>
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{yen(receipt.price)}</span>
      </div>
      <div className="flex justify-between"><span>Paid</span><span>{yen(receipt.paid ?? receipt.price)}</span></div>
      <div className="flex justify-between"><span>Change</span><span>{yen(receipt.change ?? 0)}</span></div>
      <div className="flex justify-between text-xs">
        <span>Payment</span>
        <span>{receipt.payment}</span>
      </div>
      {receipt.customer && <div className="text-xs">Customer: {receipt.customer}</div>}
      {receipt.customer_phone && <div className="text-xs">Customer phone: {receipt.customer_phone}</div>}
      <div className="text-xs">Staff: {receipt.staff}</div>
      <div className="whitespace-pre-wrap pt-2 text-center text-xs">{receipt.footer || "Thank you!"}</div>
    </div>
  );
}
