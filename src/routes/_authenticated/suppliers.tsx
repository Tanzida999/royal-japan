import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, yen } from "@/lib/app";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Mobile Shop Manager" }] }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "owner") throw redirect({ to: "/sell" });
  },
  component: Suppliers,
});

function Suppliers() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_costs").select("supplier, purchase_price, paid_amount");
      if (error) throw error;
      const m = new Map<string, { phones: number; bought: number; paid: number }>();
      for (const c of data) {
        const k = c.supplier ?? "(no supplier)";
        const r = m.get(k) ?? { phones: 0, bought: 0, paid: 0 };
        r.phones++;
        r.bought += c.purchase_price;
        r.paid += c.paid_amount ?? c.purchase_price;
        m.set(k, r);
      }
      return [...m.entries()].map(([name, r]) => ({ name, ...r, due: r.bought - r.paid })).sort((a, b) => b.due - a.due);
    },
  });
  const tot = data.reduce((a, r) => ({ bought: a.bought + r.bought, paid: a.paid + r.paid, due: a.due + r.due }), { bought: 0, paid: 0, due: 0 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Suppliers</h1>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Supplier</th>
              <th className="p-2 text-right">Phones</th>
              <th className="p-2 text-right">Total bought</th>
              <th className="p-2 text-right">Paid</th>
              <th className="p-2 text-right">Still due</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
            {data.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-right">{r.phones}</td>
                <td className="p-2 text-right">{yen(r.bought)}</td>
                <td className="p-2 text-right">{yen(r.paid)}</td>
                <td className={`p-2 text-right font-semibold ${r.due > 0 ? "text-destructive" : ""}`}>{yen(r.due)}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted font-bold">
              <td className="p-2">Total</td>
              <td className="p-2"></td>
              <td className="p-2 text-right">{yen(tot.bought)}</td>
              <td className="p-2 text-right">{yen(tot.paid)}</td>
              <td className="p-2 text-right">{yen(tot.due)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
