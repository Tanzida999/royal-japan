import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShopSelect } from '@/components/ShopSelect';
import type { ReactNode } from 'react';
export function Bilingual({en,ja}:{en:string;ja:string}) {return <span className="flex flex-col whitespace-normal"><span>{en}</span><span lang="ja" className="text-xs font-normal opacity-75">{ja}</span></span>;}
export function RegisterShell({title,ja,children,actions,footer}:{title:string;ja:string;children:ReactNode;actions?:ReactNode;footer?:ReactNode}) {
 return <section className="register space-y-6 pb-28"><div className="flex flex-wrap items-center gap-3 border-b pb-4"><Button asChild variant="ghost" size="icon" aria-label="Back to Home"><Link to="/home"><ArrowLeft/></Link></Button><h1 className="mr-auto text-2xl font-semibold"><Bilingual en={title} ja={ja}/></h1>{actions}<ShopSelect/></div>{children}{footer&&<div className="no-print fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3"><div className="register mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 px-1 [&>a]:whitespace-normal [&>button]:whitespace-normal">{footer}</div></div>}</section>;
}