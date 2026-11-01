import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Phone Shop Stock & Sales" },
      { name: "description", content: "Stock, sales and barcode labels for mobile phone shops." },
      { property: "og:title", content: "Phone Shop Stock & Sales" },
      { property: "og:description", content: "Stock, sales and barcode labels for mobile phone shops." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/sell" : "/auth" });
  },
});
