import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { meQuery, shopsQuery } from "./app";
import { supabase } from "@/integrations/supabase/client";

type ShopContextValue = { shopId: string; setShopId: (id: string) => void; shopName: string; isOwner: boolean };
const ShopContext = createContext<ShopContextValue | null>(null);
export function ShopProvider({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const [selected, setSelected] = useState("");
  useEffect(() => { setSelected(localStorage.getItem(`current-shop:${me?.id ?? ""}`) ?? ""); }, [me?.id]);
  const isOwner = me?.role === "owner";
  const shopId = isOwner ? (shops.some(s => s.id === selected) ? selected : "") : me?.shop_id ?? "";
  function setShopId(id: string) {
    if (!isOwner) return;
    setSelected(id);
    localStorage.setItem(`current-shop:${me?.id ?? ""}`, id);
  }
  return <ShopContext.Provider value={{ shopId, setShopId, isOwner, shopName: shops.find(s => s.id === shopId)?.name ?? (isOwner ? "All shops" : "No assigned shop") }}>{children}</ShopContext.Provider>;
}
export function useCurrentShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("Current shop is unavailable");
  return value;
}
export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("transit_limit_hours").eq("id", true).maybeSingle();
    if (error) throw error;
    return data?.transit_limit_hours ?? 24;
  },
});