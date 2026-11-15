import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Supplier } from '@/lib/supplier-directory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
const empty = {name:'',company_name:'',contact_person:'',phone:'',email:'',address:'',notes:'',payment_terms:'',status:'active'};
export function SupplierForm({ supplier, quick=false, onSaved, onClose }: {supplier?:Supplier;quick?:boolean;onSaved:(s:Supplier)=>void;onClose:()=>void}) {
 const qc=useQueryClient(); const [values,setValues]=useState(supplier?{...empty,...supplier}:empty); const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const fields: [keyof typeof empty,string][] = quick?[['name','Supplier name'],['phone','Phone']]:[['name','Supplier name'],['company_name','Company name'],['contact_person','Contact person'],['phone','Phone'],['email','Email'],['address','Address'],['payment_terms','Payment terms'],['notes','Notes']];
 async function save(e:React.FormEvent){e.preventDefault();setError('');if(!values.name.trim())return setError('Supplier name is required');setBusy(true);
 const {data,error}=await supabase.rpc('save_supplier',{_id:supplier?.id??(null as unknown as string),_details:values});setBusy(false);if(error)return setError(error.code==='23505'?'A supplier with this name already exists':error.message);
 await Promise.all(['supplier-directory','active-suppliers','suppliers','audit'].map(key=>qc.invalidateQueries({queryKey:[key]})));onSaved(data);
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>{supplier?'Edit supplier':'Add supplier'}</DialogTitle><DialogDescription>{supplier?.name??'New supplier'}</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label])=><div key={key} className={key==='notes'||key==='address'?'space-y-1 sm:col-span-2':'space-y-1'}><Label htmlFor={`supplier-${key}`}>{label}{key==='name'?' *':''}</Label>{key==='notes'||key==='address'?<Textarea id={`supplier-${key}`} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/>:<Input id={`supplier-${key}`} required={key==='name'} maxLength={key==='name'?100:500} type={key==='email'?'email':key==='phone'?'tel':'text'} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/>}</div>)}</div>{!quick&&<div className="space-y-1"><Label htmlFor="supplier-status">Status</Label><select id="supplier-status" className="field" value={values.status} onChange={e=>setValues(v=>({...v,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy?'Saving…':'Save supplier'}</Button></div></form></DialogContent></Dialog>;
}
