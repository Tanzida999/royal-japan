import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const yen = (n: number | null | undefined) =>
  "¥" + Math.round(Number(n ?? 0)).toLocaleString("ja-JP");

export const jstDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

export const jstDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

export type Me = {
  id: string;
  email: string;
  name: string;
  shop_id: string | null;
  role: "owner" | "staff" | null;
  manager: boolean;
  disabled: boolean;
  staff_code?: string;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("name, shop_id, disabled, staff_code").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const roles = (r ?? []).map((x) => x.role);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: p?.name ?? u.user.email ?? "",
      shop_id: p?.shop_id ?? null,
      role: roles.includes("owner") ? "owner" : (roles.includes("staff") || roles.includes("manager")) ? "staff" : null,
      manager: roles.includes("manager"),
      disabled: p?.disabled ?? false,
      staff_code: p?.staff_code ?? "",
    };
  },
  staleTime: 60_000,
});

export const shopsQuery = queryOptions({
  queryKey: ["shops"],
  queryFn: async () => {
    const { data, error } = await supabase.from("shops").select("id, name, address, postal_code, phone, email, receipt_footer, logo").order("name");
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const modelsQuery = queryOptions({
  queryKey: ["models"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("models")
      .select("*")
      .order("brand")
      .order("sort");
    if (error) throw error;
    return data;
  },
  staleTime: Infinity,
});

export const PRODUCT_SELECT =
  "*, models(*), shops:shops!products_current_shop_id_fkey(name)";

export type ProductRow = {
  id: string;
  product_code: string;
  imei: string;
  color: string;
  storage: string;
  condition: string;
  selling_price: number;
  status: string;
  shop_id: string;
  current_shop_id: string;
  created_at: string;
  carrier: string | null;
  tracking_number: string | null;
  models: { brand: string; model: string; category_id?: string | null } | null;
  shops: { name: string } | null;
  specs?: Record<string, unknown> | null;
  battery_health?: number | null;
  model_id?: string;
  invoice_id?: string | null;
};
