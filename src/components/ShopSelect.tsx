import { useQuery } from "@tanstack/react-query";
import { shopsQuery } from "@/lib/app";
import { useCurrentShop } from "@/lib/shop-context";
export function ShopSelect({ className = "field w-full sm:w-56" }: { className?: string }) {
  const { shopId, setShopId, isOwner, shopName } = useCurrentShop();
  const { data: shops = [] } = useQuery(shopsQuery);
  if (!isOwner) return <span className="text-sm font-semibold">{shopName}</span>;
  return <select aria-label="Current shop" className={className} value={shopId} onChange={e => setShopId(e.target.value)}><option value="">All shops</option>{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>;
}