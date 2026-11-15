import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supplierDeleteResult, type Supplier } from '@/lib/supplier-directory';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function SupplierDelete({ supplier, onClose, onDeleted }: { supplier: Supplier; onClose: () => void; onDeleted?: () => void }) {
 const qc = useQueryClient();
 const [busy, setBusy] = useState(false);
 const [linkedCount, setLinkedCount] = useState<number | null>(null);
 const [error, setError] = useState('');
 async function confirm(deactivate = false) {
  setBusy(true); setError('');
  try {
   if (deactivate) {
    const { error } = await supabase.rpc('save_supplier', { _id: supplier.id, _details: { ...supplier, status: 'inactive' } });
    if (error) throw error;
   } else {
    const { data, error } = await supabase.rpc('delete_supplier', { _id: supplier.id });
    if (error) throw error;
    const result = supplierDeleteResult(data);
    if (!result.deleted) { setLinkedCount(result.linkedCount); return; }
   }
   await Promise.all(['supplier-directory', 'active-suppliers', 'suppliers', 'audit'].map(key => qc.invalidateQueries({ queryKey: [key] })));
   onClose();
   if (!deactivate) onDeleted?.();
  } catch (err) { setError(err instanceof Error ? err.message : String((err as { message?: string }).message ?? 'Could not update supplier')); }
  finally { setBusy(false); }
 }
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Delete supplier</DialogTitle><DialogDescription>{linkedCount === null ? `Delete ${supplier.name}?` : `This supplier is used in ${linkedCount} products. Deactivate instead?`}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant={linkedCount === null ? 'destructive' : 'default'} disabled={busy} onClick={() => confirm(linkedCount !== null)}>{busy ? 'Saving…' : linkedCount === null ? 'Delete' : 'Deactivate'}</Button></div></DialogContent></Dialog>;
}