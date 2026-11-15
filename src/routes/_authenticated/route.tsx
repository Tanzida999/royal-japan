import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/app";
import { logEvent, shouldEndSession } from "@/lib/audit";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Smartphone, ShoppingCart, X } from "lucide-react";
import { ShopSelect } from "@/components/ShopSelect";

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
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
    { to: "/home", label: "Home" },
    { to: "/sell", label: "New Sale" },
    { to: "/add", label: "Add Product" },
    { to: "/stock", label: "Stock" },
    { to: "/sales", label: "Sales History" },
    { to: "/customers", label: "Customers" },
    ...(me?.role === "owner" || me?.manager ? [{ to: "/pos-settings", label: "Settings" }] : []),
    { to: "/find", label: "Find in other shops" },
    { to: "/transfers", label: "Transfers" },
    ...(me?.role === "owner" || me?.manager ? [{ to: "/suppliers", label: "Suppliers" }] : []),
    ...(me?.role === "owner"
      ? [
          { to: "/dashboard", label: "Dashboard" },
          { to: "/stock-check", label: "Stock Check" },
          { to: "/staff", label: "Staff" },
          { to: "/activity", label: "Activity" },
          { to: "/shops", label: "Shops" },
        ]
      : []),
  ] as const;

  return (
    <div className="app-layout min-h-screen bg-background">
      <header className="no-print border-b bg-card">
        <div className="app-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link to="/home" className="flex shrink-0 items-center gap-2 font-bold text-primary" aria-label="Royal Japan Home">
              <Smartphone className="size-6 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Royal Japan</span>
              <span className="sm:hidden">Royal<br />Japan</span>
            </Link>
            <div className="min-w-0 flex-1 sm:max-w-64">
              <ShopSelect className="field min-w-0 truncate" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-4">
            <Link to="/account" className="min-w-0 max-w-20 sm:max-w-48 hover:underline">
              <span className="block truncate font-medium">{me?.name}</span>
              <span className="block text-xs capitalize text-muted-foreground">{me?.manager ? "manager" : me?.role}</span>
            </Link>
            <Button size="sm" variant="outline" onClick={signOut}>Logout</Button>
          </div>
        </div>
        <div className="border-t">
          <div className="app-container py-2">
            <Button variant="ghost" className="h-10 lg:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X /> : <Menu />}<span>Menu</span>
            </Button>
            <nav id="app-navigation" aria-label="Main navigation" className={`${menuOpen ? "grid" : "hidden"} grid-cols-1 gap-1 py-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:py-0`}>
            {links.map((l) => (
              <Button asChild variant="ghost" key={l.to} className="h-10 justify-start px-3 text-sm font-medium lg:justify-center">
              <Link
                key={l.to}
                to={l.to}
                className="text-muted-foreground"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
              >
                {l.to === "/sell" && <ShoppingCart aria-hidden="true" />}
                {l.label}
              </Link>
              </Button>
            ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="app-container min-w-0 py-6">
        <Outlet />
      </main>
    </div>
  );
}
