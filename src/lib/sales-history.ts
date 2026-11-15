import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jstDate } from '@/lib/app';
export const canReadShopSale = (owner: boolean, assignedShop: string | null, saleShop: string) => owner || (!!assignedShop && assignedShop === saleShop);
export function todaySales(rows: {shop_id:string;created_at:string;sale_price:number;receipt_id:string|null;receipt_no:string}[], shopId:string, today:string) {
 const selected=rows.filter(r=>(!shopId||r.shop_id===shopId)&&jstDate(r.created_at)===today);
 return {count:new Set(selected.map(r=>r.receipt_id??r.receipt_no)).size,phones:selected.length,amount:selected.reduce((a,r)=>a+r.sale_price,0)};
}
export const salesRowsQuery = (userId: string, shopId: string) => queryOptions({ queryKey:['sales-list',userId,shopId], enabled:!!userId, queryFn:async()=>{
 const fetchPage=async(start:number)=>{ let q=supabase.from('sales').select('id, receipt_id, receipt_no, product_id, sale_price, customer_name, payment, shop_id, sold_by, staff_code, created_at, shops(name), products(product_code, imei, color, storage, condition, models(brand, model))').order('created_at',{ascending:false}).order('id').range(start,start+999); if(shopId) q=q.eq('shop_id',shopId); const {data,error}=await q; if(error) throw error; return data; };
 const rows=await fetchPage(0); if(rows.length<1000) return rows; for(let start=1000;;start+=1000){const page=await fetchPage(start); rows.push(...page); if(page.length<1000)return rows;}
} });
