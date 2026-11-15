import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/app";
import { logEvent, shouldEndSession } from "@/lib/audit";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if (shouldEndSession()) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: Layout,
});

function Layout() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!me?.disabled) return;
    (async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    })();
  }, [me?.disabled, qc, navigate]);

  async function signOut() {
    await logEvent("logout", "auth", me?.id ?? "");
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/sell", label: "New Sale" },
    { to: "/add", label: "Add Product" },
    { to: "/stock", label: "Stock" },
    { to: "/sales", label: "Sales History" },
    { to: "/find", label: "Find in other shops" },
    { to: "/transfers", label: "Transfers" },
    ...(me?.role === "owner" || me?.manager ? [{ to: "/suppliers", label: "Suppliers" }] : []),
    ...(me?.role === "owner"
      ? [
          { to: "/dashboard", label: "Dashboard" },
          { to: "/stock-check", label: "Stock Check" },
          { to: "/staff", label: "Staff" },
          { to: "/activity", label: "Activity" },
        ]
      : []),
  ] as const;

  return (
    <div className="min-h-screen bg-muted">
      <header className="no-print border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2">
          <span className="mr-2 font-bold">Phone Shop</span>
          <nav className="flex flex-wrap gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={l.to === "/sell" ? "inline-flex min-h-11 items-center rounded-md bg-sale px-5 py-2 text-base font-bold text-sale-foreground hover:bg-sale/90" : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"}
                activeProps={{ className: l.to === "/sell" ? "ring-2 ring-sale ring-offset-2" : "bg-primary text-primary-foreground hover:bg-primary" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link to="/account" className="text-muted-foreground hover:underline">
              {me?.name} {me?.role ? `(${me.manager ? "manager" : me.role})` : ""}
            </Link>
            <Button size="sm" variant="outline" onClick={signOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
