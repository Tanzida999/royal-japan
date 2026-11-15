import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_SELECT, type ProductRow } from './app';
import type { Json } from '@/integrations/supabase/types';
export async function paged<T>(fetchPage: (start: number) => Promise<T[]>) { const rows: T[] = []; for (let start=0;;start+=1000) { const page=await fetchPage(start);rows.push(...page);if(page.length<1000) return rows; } }
export const registerQuery = (user: string, shop: string) => queryOptions({ queryKey:['register',user,shop],enabled:!!user&&!!shop,queryFn:async()=>{
  const [phones, accessories, customers, settings, held] = await Promise.all([
    paged(async start=>{const {data,error}=await supabase.from('products').select(PRODUCT_SELECT).eq('current_shop_id',shop).eq('status','in_stock').order('id').range(start,start+999);if(error)throw error;return data as unknown as ProductRow[];}),
    paged(async start=>{const {data,error}=await supabase.from('accessories').select('*').eq('shop_id',shop).order('name').order('id').range(start,start+999);if(error)throw error;return data;}),
    paged(async start=>{const {data,error}=await supabase.from('customers').select('*').eq('shop_id',shop).order('name').order('id').range(start,start+999);if(error)throw error;return data;}),
    supabase.from('pos_settings').select('*').eq('shop_id',shop).maybeSingle(),
    paged(async start=>{const {data,error}=await supabase.from('held_sales').select('*').eq('shop_id',shop).eq('status','held').order('created_at',{ascending:false}).order('id').range(start,start+999);if(error)throw error;return data;})
  ]);if(settings.error)throw settings.error;return {phones,accessories,customers,settings:settings.data,held};
}});
export async function saveRegister(kind: string, shop: string, data: Json, id?: string) {
  const result=await supabase.rpc('save_pos_record',{_kind:kind,_shop:shop,_id:(id??null) as unknown as string,_data:data});if(result.error)throw result.error;return result.data;
}