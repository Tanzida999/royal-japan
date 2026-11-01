import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mobile Shop Manager" },
      { name: "description", content: "Stock and sales management for mobile shops" },
      { property: "og:title", content: "Mobile Shop Manager" },
      { property: "og:description", content: "Stock and sales management for mobile shops" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/sell" : "/auth" });
  },
});
