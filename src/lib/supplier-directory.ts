import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type SupplierPurchase = Database['public']['Functions']['supplier_purchases']['Returns'][number];
export const canManageSuppliers = (me: { role: string | null; manager: boolean } | null | undefined) => me?.role === 'owner' || me?.manager === true;
export const supplierProblem = (id: string, active: { id: string }[]) => active.some(s => s.id === id) ? '' : 'Pick an active supplier';
export const supplierSearch = (s: { name: string; phone: string }, q: string) => [s.name, s.phone].some(v => v.toLowerCase().includes(q.trim().toLowerCase()));
export const activeSuppliersQuery = queryOptions({ queryKey: ['active-suppliers'], queryFn: async () => { const { data, error } = await supabase.rpc('active_suppliers'); if (error) throw error; return data; } });
export const supplierDirectoryQuery = queryOptions({ queryKey: ['supplier-directory'], queryFn: async () => {
 const rows: Supplier[] = []; for (let start=0;;start+=1000) { const { data,error }=await supabase.from('suppliers').select('*').order('name').order('id').range(start,start+999); if(error) throw error; rows.push(...data); if(data.length<1000) return rows; }
} });
export const supplierPurchasesQuery = queryOptions({ queryKey: ['suppliers'], queryFn: async () => {
 const rows: SupplierPurchase[]=[]; for(let start=0;;start+=1000) { const {data,error}=await supabase.rpc('supplier_purchases').order('created_at',{ascending:false}).order('product_id').range(start,start+999); if(error) throw error; rows.push(...data); if(data.length<1000) return rows; }
} });
export const purchaseTotals = (rows: { purchase_price: number; paid_amount: number | null }[]) => rows.reduce((a,p)=>({ phones:a.phones+1,bought:a.bought+p.purchase_price,paid:a.paid+(p.paid_amount??p.purchase_price),due:a.due+p.purchase_price-(p.paid_amount??p.purchase_price) }),{phones:0,bought:0,paid:0,due:0});
