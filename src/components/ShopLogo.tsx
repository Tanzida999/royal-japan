import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function ShopLogo({ path, name }: { path?: string | null; name: string }) {
  const { data } = useQuery({ queryKey: ["shop-logo", path], enabled: Boolean(path), staleTime: 3_000_000, queryFn: async () => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("shop-logos").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  } });
  return data ? <img src={data} alt={`${name} logo`} className="mx-auto h-16 max-w-40 object-contain" /> : null;
}