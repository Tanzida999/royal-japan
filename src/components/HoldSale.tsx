import { useState } from 'react';
import { Pause } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/lib/register-store';
import { saveRegister } from '@/lib/register-data';
import { Bilingual } from './RegisterShell';
export function HoldSale({onError}:{onError:(s:string)=>void}) {const cart=useRegister();const qc=useQueryClient();const [busy,setBusy]=useState(false);return <Button variant="outline" className="h-14" disabled={busy||!cart.lines.length} onClick={async()=>{setBusy(true);try{await saveRegister('hold',cart.shop,{items:cart.lines,discount:cart.discount});cart.clear();await qc.invalidateQueries({queryKey:['register']});}catch(e){onError(e instanceof Error?e.message:'Could not hold sale');}finally{setBusy(false);}}}><Pause/><Bilingual en="Hold" ja="一時保存"/></Button>;}