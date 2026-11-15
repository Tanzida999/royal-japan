import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { meQuery, jstDate, yen } from '@/lib/app';
import { useCurrentShop } from '@/lib/shop-context';
import { pageMeta } from '@/lib/metadata';
import { supplierMatches } from '@/lib/suppliers';
import { canManageSuppliers, supplierDirectoryQuery, supplierPurchasesQuery, supplierSearch, purchaseTotals } from '@/lib/supplier-directory';
import { SupplierForm } from '@/components/SupplierForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/suppliers')({
 head:()=>pageMeta('Suppliers — Mobile Shop Manager','Manage suppliers and review purchases, payments and balances by period and shop.'),
 beforeLoad:async({context})=>{const me=await context.queryClient.ensureQueryData(meQuery);if(!canManageSuppliers(me))throw redirect({to:'/sell'});}, component:Suppliers,
});
function Suppliers(){
 const {shopId,isOwner}=useCurrentShop();const [year,setYear]=useState('');const [month,setMonth]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [add,setAdd]=useState(false);
 const {data:suppliers=[],isLoading,error}=useQuery(supplierDirectoryQuery);const {data:purchases=[],error:purchaseError}=useQuery(supplierPurchasesQuery);
 const filtered=purchases.filter(p=>supplierMatches(jstDate(p.created_at),p.shop_id,{year,month,from,to,shopId}));
 const years=[...new Set(purchases.map(p=>jstDate(p.created_at).slice(0,4)))].sort().reverse();
 const rows=suppliers.filter(s=>supplierSearch(s,search)&&(!status||s.status===status));const total=purchaseTotals(filtered);
 return <div className="space-y-4"><div className="page-toolbar"><h1 className="mr-auto text-2xl font-bold">Suppliers</h1><Button onClick={()=>setAdd(true)}>Add supplier</Button></div>
 <div className="page-toolbar lg:justify-end"><Input aria-label="Search supplier name or phone" placeholder="Search name or phone…" className="w-full sm:w-64" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Supplier status" className="field w-40" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
 <div className="page-toolbar lg:justify-end"><select aria-label="Supplier year" className="field w-32" value={year} onChange={e=>setYear(e.target.value)}><option value="">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select><select aria-label="Supplier month" className="field w-36" value={month} onChange={e=>setMonth(e.target.value)}><option value="">All months</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{new Date(2026,i,1).toLocaleString('en',{month:'long'})}</option>)}</select><Input type="date" aria-label="Supplier from date" className="w-40" value={from} onChange={e=>setFrom(e.target.value)}/><Input type="date" aria-label="Supplier to date" className="w-40" value={to} onChange={e=>setTo(e.target.value)}/></div>
 {from&&to&&from>to&&<p role="alert" className="text-destructive">End date must follow start date</p>}{(error||purchaseError)&&<p role="alert" className="text-destructive">Could not load suppliers or purchases</p>}
 <p className="text-sm text-muted-foreground">{!isOwner?'Your shop · ':''}Total bought: <span className="font-semibold text-foreground">{yen(total.bought)}</span> · Paid: {yen(total.paid)} · Still due: <span className="font-semibold text-destructive">{yen(total.due)}</span></p>
 <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-2">Supplier</th><th className="p-2">Phone</th><th className="p-2">Status</th><th className="p-2 text-right">Phones</th><th className="p-2 text-right">Total bought</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Still due</th></tr></thead><tbody>{isLoading&&<tr><td className="p-4" colSpan={7}>Loading…</td></tr>}{!isLoading&&!rows.length&&<tr><td className="p-4 text-muted-foreground" colSpan={7}>No suppliers found.</td></tr>}{rows.map(s=>{const t=purchaseTotals(filtered.filter(p=>p.supplier_id===s.id));return <tr key={s.id} className="border-t"><td className="p-2"><Button asChild variant="link" className="h-auto whitespace-normal p-0 text-left"><Link to="/suppliers/$id" params={{id:s.id}}>{s.name}</Link></Button>{s.company_name&&<div className="text-xs text-muted-foreground">{s.company_name}</div>}</td><td className="p-2">{s.phone||'—'}</td><td className="p-2 capitalize">{s.status}</td><td className="p-2 text-right">{t.phones}</td><td className="p-2 text-right">{yen(t.bought)}</td><td className="p-2 text-right">{yen(t.paid)}</td><td className="p-2 text-right font-semibold">{yen(t.due)}</td></tr>;})}<tr className="border-t bg-muted font-bold"><td colSpan={3} className="p-2">Total</td><td className="p-2 text-right">{total.phones}</td><td className="p-2 text-right">{yen(total.bought)}</td><td className="p-2 text-right">{yen(total.paid)}</td><td className="p-2 text-right">{yen(total.due)}</td></tr></tbody></table></div>
 {add&&<SupplierForm onClose={()=>setAdd(false)} onSaved={()=>setAdd(false)}/>}</div>;
}
