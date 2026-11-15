import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_SELECT, type ProductRow } from './app';
import type { Json } from '@/integrations/supabase/types';
export async function paged<T>(fetchPage: (start: number) => Promise<T[]>) { const rows: T[] = []; for (let start=0;;start+=1000) { const page=await fetchPage(start);rows.push(...page);if(page.length<1000) return rows; } }
export const registerQuery = (user: string, shop: string) => queryOptions({ queryKey:['register',user,shop],enabled:!!user&&!!shop,refetchInterval:30_000,queryFn:async()=>{
  const [phones, accessories, customers, settings, held, reservations] = await Promise.all([
    paged(async start=>{const {data,error}=await supabase.from('products').select(PRODUCT_SELECT).eq('current_shop_id',shop).eq('status','in_stock').order('id').range(start,start+999);if(error)throw error;return data as unknown as ProductRow[];}),
    paged(async start=>{const {data,error}=await supabase.from('accessories').select('*').eq('shop_id',shop).order('name').order('id').range(start,start+999);if(error)throw error;return data;}),
    paged(async start=>{const {data,error}=await supabase.from('customers').select('*').eq('shop_id',shop).order('name').order('id').range(start,start+999);if(error)throw error;return data;}),
    supabase.from('pos_settings').select('*').eq('shop_id',shop).maybeSingle(),
    paged(async start=>{const {data,error}=await supabase.from('held_sales').select('*').eq('shop_id',shop).eq('status','held').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).order('id').range(start,start+999);if(error)throw error;return data;}),
    paged(async start=>{const {data,error}=await supabase.from('held_sale_phones').select('product_id,held_sales!inner(status,expires_at)').eq('shop_id',shop).is('released_at',null).eq('held_sales.status','held').gt('held_sales.expires_at',new Date().toISOString()).order('id').range(start,start+999);if(error)throw error;return data;})
  ]);if(settings.error)throw settings.error;const reserved=new Set(reservations.map(r=>r.product_id));return {phones:phones.filter(p=>!reserved.has(p.id)),reserved:reservations.map(r=>r.product_id),accessories,customers,settings:settings.data,held};
}});
export async function saveRegister(kind: string, shop: string, data: Json, id?: string) {
  const result=await supabase.rpc('save_pos_record',{_kind:kind,_shop:shop,_id:(id??null) as unknown as string,_data:data});if(result.error)throw result.error;return result.data;
}