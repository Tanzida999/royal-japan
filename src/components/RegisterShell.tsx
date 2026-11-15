import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
export function Bilingual({en,ja}:{en:string;ja:string}) {return <span className="flex flex-col whitespace-normal"><span>{en}</span><span lang="ja" className="text-xs font-normal opacity-75">{ja}</span></span>;}
export function RegisterShell({title,ja,children,actions,footer}:{title:string;ja:string;children:ReactNode;actions?:ReactNode;footer?:ReactNode}) {
 return <section className="register min-w-0 space-y-6 pb-28"><div className="page-toolbar border-b pb-4"><div className="flex min-w-0 items-center gap-3"><Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Back to Home"><Link to="/home"><ArrowLeft/></Link></Button><h1 className="min-w-0 text-2xl font-semibold"><Bilingual en={title} ja={ja}/></h1></div>{actions&&<div className="flex min-w-0 flex-wrap gap-2">{actions}</div>}</div>{children}{footer&&<div className="no-print fixed inset-x-0 bottom-0 z-20 border-t bg-card py-3"><div className="app-container register flex flex-wrap items-center justify-end gap-2 [&>a]:whitespace-normal [&>button]:whitespace-normal">{footer}</div></div>}</section>;
}