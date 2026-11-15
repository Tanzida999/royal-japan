import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart,Wallet,ChartNoAxesCombined,Users,Package,Settings,Plus,ArrowLeftRight } from 'lucide-react';
import { meQuery } from '@/lib/app';
import { pageMeta } from '@/lib/metadata';
import { Button } from '@/components/ui/button';
import { Bilingual } from '@/components/RegisterShell';
export const Route=createFileRoute('/_authenticated/home')({head:()=>pageMeta('Home — Royal Japan Register','Your shop register, customers, stock and sales.'),component:Home});
function Home(){const {data:me}=useQuery(meQuery);const tiles=[{to:'/cash-check',en:'Cash Check',ja:'点検・精算',icon:Wallet},{to:'/sales',en:'Sales History',ja:'売上・分析',icon:ChartNoAxesCombined},{to:'/customers',en:'Customers',ja:'顧客',icon:Users},{to:'/stock',en:'Products',ja:'商品',icon:Package},...(me?.role==='owner'||me?.manager?[{to:'/add',en:'Add Product',ja:'商品登録',icon:Plus},{to:'/transfers',en:'Transfers',ja:'店舗間移動',icon:ArrowLeftRight},{to:'/pos-settings',en:'Settings',ja:'設定',icon:Settings}]:[])] as const;return <section className="register space-y-6"><h1 className="text-2xl font-semibold">Home</h1><Button asChild className="h-40 w-full flex-col gap-4 px-4 text-center text-2xl [&_svg]:size-10"><Link to="/sell"><ShoppingCart/><Bilingual en="New Sale" ja="注文入力・会計"/></Link></Button><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{tiles.map(t=><Button asChild key={t.to} variant="outline" className="h-40 min-w-0 flex-col gap-4 whitespace-normal text-center text-base [&_svg]:size-8"><Link to={t.to}><t.icon className="text-primary"/><Bilingual en={t.en} ja={t.ja}/></Link></Button>)}</div></section>;}
