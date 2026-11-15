import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart,Wallet,ChartNoAxesCombined,Users,Package,Settings,ArrowUpRight } from 'lucide-react';
import { meQuery } from '@/lib/app';
import { pageMeta } from '@/lib/metadata';
import { useCurrentShop } from '@/lib/shop-context';
import { Button } from '@/components/ui/button';
import { Bilingual } from '@/components/RegisterShell';
export const Route=createFileRoute('/_authenticated/home')({head:()=>pageMeta('Home — Royal Japan Register','Your shop register, customers, stock and sales.'),component:Home});
function Home(){const {data:me}=useQuery(meQuery);const {shopName}=useCurrentShop();const tiles=[{to:'/cash-check',en:'Cash Check',ja:'点検・精算',icon:Wallet},{to:'/sales',en:'Sales History',ja:'売上・分析',icon:ChartNoAxesCombined},{to:'/customers',en:'Customers',ja:'顧客',icon:Users},{to:'/stock',en:'Products',ja:'商品',icon:Package},...(me?.role==='owner'||me?.manager?[{to:'/pos-settings',en:'Settings',ja:'設定',icon:Settings}]:[])] as const;return <section className="register space-y-6"><div><p className="text-sm text-muted-foreground">Royal Japan</p><h1 className="mt-1 text-2xl font-semibold">{shopName}</h1><p className="mt-1 text-sm text-muted-foreground">{me?.name}</p></div><Button asChild className="h-40 w-full justify-between px-6 text-left text-2xl [&_svg]:size-10"><Link to="/sell"><span className="flex items-center gap-5"><ShoppingCart/><Bilingual en="New Sale" ja="注文入力・会計"/></span><ArrowUpRight/></Link></Button><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{tiles.map(t=><Button asChild key={t.to} variant="outline" className="h-36 flex-col gap-4 text-base [&_svg]:size-8"><Link to={t.to}><t.icon className="text-primary"/><Bilingual en={t.en} ja={t.ja}/></Link></Button>)}</div></section>;}
