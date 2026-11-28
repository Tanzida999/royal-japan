import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Untyped client for tables/functions added after the generated types (categories, invoices, shipments). */
export const db = supabase as unknown as SupabaseClient;

export type CategoryKind = "phone" | "computer" | "other";
export type Category = { id: string; name: string; kind: CategoryKind; sort: number; active: boolean };

/** Shop-wide product categories (iPhone, Android, Tablet, Computer…). */
export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await db.from("categories").select("id, name, kind, sort, active").order("sort").order("name");
    if (error) return []; // table not created yet: app keeps working without categories
    return (data ?? []) as unknown as Category[];
  },
  staleTime: 60_000,
});

export const PHONE_COLORS = ["Black", "White", "Silver", "Gold", "Rose Gold", "Blue", "Red", "Green", "Purple", "Pink", "Yellow", "Graphite", "Space Gray", "Midnight", "Starlight", "Natural Titanium", "Black Titanium", "White Titanium", "Blue Titanium", "Desert Titanium",
  // iPhone 17 family (2025)
  "Cosmic Orange", "Deep Blue", "Mist Blue", "Sage", "Lavender", "Space Black", "Cloud White", "Light Gold", "Sky Blue",
  // iPhone 18 Pro / Pro Max (2026)
  "Deep Black", "Glacier Blue", "Burgundy"];
export const COMPUTER_COLORS = ["Silver", "Space Gray", "Midnight", "Starlight", "Gold", "Black", "White", "Gray", "Blue", "Red"];
export const PHONE_STORAGE = ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"];
export const COMPUTER_DISK = ["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD", "4TB SSD", "500GB HDD", "1TB HDD", "2TB HDD", "256GB SSD + 1TB HDD", "512GB SSD + 1TB HDD"];
export const COMPUTER_PROCESSORS = ["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "Intel Core Ultra 5", "Intel Core Ultra 7", "Intel Core Ultra 9", "Intel Celeron", "Intel Pentium", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9", "Apple M1", "Apple M1 Pro", "Apple M1 Max", "Apple M2", "Apple M2 Pro", "Apple M2 Max", "Apple M3", "Apple M3 Pro", "Apple M3 Max", "Apple M4", "Apple M4 Pro", "Apple M4 Max", "Snapdragon X", "Other"];
export const COMPUTER_GENERATIONS = ["4th gen", "5th gen", "6th gen", "7th gen", "8th gen", "9th gen", "10th gen", "11th gen", "12th gen", "13th gen", "14th gen", "Series 1", "Series 2", "Ryzen 3000", "Ryzen 4000", "Ryzen 5000", "Ryzen 6000", "Ryzen 7000", "Ryzen 8000", "Ryzen 9000", "Not applicable (Apple M)"];
export const COMPUTER_RAM = ["4GB", "8GB", "12GB", "16GB", "18GB", "24GB", "32GB", "36GB", "48GB", "64GB", "96GB", "128GB"];
export const COMPUTER_DISPLAY = ['11.6"', '12"', '12.5"', '13"', '13.3"', '13.5"', '13.6"', '14"', '14.2"', '15"', '15.3"', '15.6"', '16"', '16.2"', '17.3"', '24" (desktop)', '27" (desktop)'];
/** Battery health choices (%), newest first. */
export const BATTERY_OPTIONS = Array.from({ length: 51 }, (_, i) => 100 - i);
/** "Normal" = battery checked and fine, no % shown (saved in specs.battery). */
export const BATTERY_NORMAL = "Normal";
/** RAM choices for Android phones and tablets. */
export const PHONE_RAM = ["1GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB"];
/** Battery text for a product: "87%" or "Normal" (or "" when not checked). */
export const batteryText = (pct: number | null | undefined, specs?: Record<string, unknown> | null) =>
  pct ? `${pct}%` : specs?.battery ? String(specs.battery) : "";
export const SERIAL_RE = /^[A-Z0-9][A-Z0-9-]{4,29}$/;

export type ComputerSpecs = { processor: string; generation: string; ram: string; display: string };
export const emptySpecs = (): ComputerSpecs => ({ processor: "", generation: "", ram: "", display: "" });
export const specsText = (s: Record<string, unknown> | null | undefined) =>
  ["processor", "generation", "ram", "display"].map((k) => { const v = String(s?.[k] ?? ""); return v && k === "ram" ? `RAM ${v}` : v; }).filter(Boolean).join(" · ");

export const PLATFORMS = ["Mercari", "Yahoo Auctions", "Rakuma", "Amazon", "Rakuten", "Own website", "LINE / phone order", "Facebook / Instagram", "Other"];
export const COD_FEES = [1500, 2000, 2500];
export const SHIPMENT_STATUSES = [
  { value: "preparing", label: "Preparing" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "problem", label: "Problem" },
] as const;
