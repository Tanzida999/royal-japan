import { supabase } from "@/integrations/supabase/client";

/** Uploads compressed photos into product-photos/<productId>/ and records them. */
export async function uploadProductPhotos(productId: string, blobs: Blob[]) {
  if (!blobs.length) return;
  const paths: string[] = [];
  for (const b of blobs) {
    const path = `${productId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("product-photos").upload(path, b, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    paths.push(path);
  }
  const { error } = await supabase.rpc("add_product_photos", { _product_id: productId, _paths: paths });
  if (error) throw new Error(`Photos not saved: ${error.message}`);
}
