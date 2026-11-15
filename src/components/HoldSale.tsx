import { useState } from 'react';
import { Pause } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/lib/register-store';
import { saveRegister } from '@/lib/register-data';
import { RegisterLabel } from './RegisterShell';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
export function HoldSale({onError}:{onError:(s:string)=>void}) {const cart=useRegister();const qc=useQueryClient();const [busy,setBusy]=useState(false);const [open,setOpen]=useState(false);const [name,setName]=useState('');const [note,setNote]=useState('');return <><Button variant="outline" className="h-14" disabled={busy||!cart.lines.length} onClick={()=>setOpen(true)}><Pause/><RegisterLabel en="Hold"/></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Hold sale</DialogTitle><Input aria-label="Held sale name" placeholder="Name (optional)" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><Input aria-label="Held sale note" placeholder="Note (optional)" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/><Button disabled={busy||!cart.lines.length} onClick={async()=>{setBusy(true);try{await saveRegister('hold',cart.shop,{name:name.trim(),note:note.trim(),items:cart.lines,discount:cart.discount});cart.clear();setOpen(false);setName('');setNote('');await Promise.all(['register','stock'].map(key=>qc.invalidateQueries({queryKey:[key]})));}catch(e){onError(e instanceof Error?e.message:'Could not hold sale');setOpen(false);}finally{setBusy(false);}}}>Save hold</Button></DialogContent></Dialog></>;}