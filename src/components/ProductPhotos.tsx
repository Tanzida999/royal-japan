import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Saved condition photos for a product (private, signed URLs). */
export function ProductPhotos({ productId, size = "md" }: { productId: string; size?: "sm" | "md" | "lg" }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["product-photos", productId],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_photos").select("id, url").eq("product_id", productId).order("created_at");
      if (error) throw error;
      if (!data.length) return [];
      const { data: signed, error: e2 } = await supabase.storage.from("product-photos").createSignedUrls(data.map((d) => d.url), 3600);
      if (e2) throw e2;
      return signed.map((s, i) => ({ id: data[i]!.id, src: s.signedUrl ?? "" })).filter((s) => s.src);
    },
  });
  const cls = size === "sm" ? "size-10" : size === "lg" ? "size-32" : "size-16";
  if (isLoading) return null;
  if (!data.length) return size === "sm" ? null : <p className="text-xs text-muted-foreground">No photos</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((p, i) => (
        <a key={p.id} href={p.src} target="_blank" rel="noreferrer" title="Open photo">
          <img src={p.src} alt={`Condition photo ${i + 1}`} loading="lazy" className={`${cls} rounded-md border object-cover`} />
        </a>
      ))}
    </div>
  );
}
