import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { activeSuppliersQuery, canManageSuppliers } from '@/lib/supplier-directory';
import { meQuery } from '@/lib/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SupplierForm } from '@/components/SupplierForm';
export function SupplierSelect({value,onChange}:{value:string;onChange:(id:string)=>void}) {
 const {data:me}=useQuery(meQuery);const {data:rows=[],error,isLoading}=useQuery(activeSuppliersQuery);const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [add,setAdd]=useState(false);
 return <><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="Supplier" aria-expanded={open} className="w-full justify-between"><span className="truncate">{rows.find(s=>s.id===value)?.name??'Select supplier'}</span><ChevronsUpDown className="size-4 shrink-0"/></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-2" align="start"><Input autoFocus placeholder="Search supplier name…" aria-label="Search suppliers" value={search} onChange={e=>setSearch(e.target.value)}/><div role="listbox" aria-label="Active suppliers" className="my-2 max-h-60 overflow-y-auto">{rows.filter(s=>s.name.toLowerCase().includes(search.trim().toLowerCase())).map(s=><Button type="button" variant="ghost" key={s.id} role="option" aria-selected={s.id===value} className="h-auto min-h-9 w-full justify-start whitespace-normal text-left" onClick={()=>{onChange(s.id);setOpen(false);setSearch('');}}>{s.id===value&&<Check/>}{s.name}</Button>)}{isLoading&&<p className="p-2 text-sm">Loading…</p>}{!isLoading&&!rows.some(s=>s.name.toLowerCase().includes(search.trim().toLowerCase()))&&<p className="p-2 text-sm text-muted-foreground">No active suppliers</p>}</div>{canManageSuppliers(me)&&<Button type="button" variant="ghost" className="w-full justify-start border-t" onClick={()=>{setOpen(false);setAdd(true);}}><Plus/>Add new supplier</Button>}</PopoverContent></Popover>{error&&<p role="alert" className="text-sm text-destructive">Could not load suppliers</p>}{add&&<SupplierForm quick onClose={()=>setAdd(false)} onSaved={s=>{onChange(s.id);setAdd(false);}}/>}</>;
}
