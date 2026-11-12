import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jstDateTime } from "@/lib/app";
import { AUDIT_SELECT, describe, type AuditEntry } from "@/lib/audit-query";
import { AuditDetail } from "@/components/AuditDetail";

/** Owner-only timeline of everything recorded for one phone. */
export function ProductHistory({ productId, productCode }: { productId: string; productCode: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["product-history", productId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select(AUDIT_SELECT)
        .or(`record_id.eq.${productId},record_id.eq.${productCode},new_values->>product_id.eq.${productId}`)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as unknown as AuditEntry[];
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">No history recorded yet.</p>;
  return (
    <ol className="space-y-2 border-l pl-4">
      {data.map((e) => (
        <li key={e.id}>
          <button type="button" className="text-left text-sm" onClick={() => setOpen(open === e.id ? null : e.id)}>
            <span className="text-xs text-muted-foreground">{jstDateTime(e.created_at)}</span> · {describe(e)} · <span className="text-muted-foreground">{e.user_name ?? "—"}</span>
          </button>
          {open === e.id && <div className="mt-1"><AuditDetail e={e} /></div>}
        </li>
      ))}
    </ol>
  );
}
