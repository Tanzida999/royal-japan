import { createFileRoute,Link } from '@tanstack/react-router';
import { CheckCircle2,Printer,QrCode } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRegister } from '@/lib/register-store';
import { yen } from '@/lib/app';
import { logEvent } from '@/lib/audit';
import { pageMeta } from '@/lib/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Receipt } from '@/components/Receipt';
import { RegisterShell,RegisterLabel } from '@/components/RegisterShell';
import { Dialog,DialogContent,DialogTitle } from '@/components/ui/dialog';
export const Route=createFileRoute('/_authenticated/completed')({head:()=>pageMeta('Payment Completed — Royal Japan Register','Completed payment and printed or QR receipt.'),component:Completed});
function Completed(){const cart=useRegister();const r=cart.receipt;const [qr,setQr]=useState(false);const [named,setNamed]=useState(false);const [addressee,setAddressee]=useState('');const [purpose,setPurpose]=useState('For goods');const [printNamed,setPrintNamed]=useState(false);const [error,setError]=useState('');
 async function print(asNamed:boolean){setPrintNamed(asNamed);try{await logEvent('receipt_reprinted','receipts',r?.receipt_no??'',{receipt_no:r?.receipt_no??'',format:asNamed?'named_receipt':'receipt'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));window.print();}catch{setError('Could not record receipt printing. Please try again.');}}
 return <RegisterShell title="Payment completed" footer={<><Button asChild variant="outline" className="h-14"><Link to="/home">Home</Link></Button><Button asChild variant="outline" className="h-14"><Link to="/sales">Sales History</Link></Button><Button asChild className="h-14 flex-1"><Link to="/sell" onClick={()=>cart.clear()}>New Sale</Link></Button></>}>
 {r?<><div className="space-y-4 py-8 text-center"><CheckCircle2 className="mx-auto size-16 text-sale"/><p className="text-lg">{r.receipt_no}</p><p className="text-sm text-muted-foreground">Change</p><p className="text-5xl font-semibold">{yen(r.change)}</p><p>Received {yen(r.paid)} − Total {yen(r.price)}</p></div><div className="grid gap-3 sm:grid-cols-3"><Button variant="outline" className="h-20" onClick={()=>void print(false)}><Printer/><RegisterLabel en="Print receipt"/></Button><Button variant="outline" className="h-20" onClick={()=>setNamed(true)}><Printer/>Print named receipt</Button><Button variant="outline" className="h-20" onClick={()=>setQr(true)}><QrCode/>Show QR receipt</Button></div>{error&&<p role="alert" className="text-destructive">{error}</p>}<div className="hidden print:block"><Receipt receipt={{...r,addressee:printNamed?addressee:undefined,purpose:printNamed?purpose:undefined}}/></div><Dialog open={named} onOpenChange={setNamed}><DialogContent><DialogTitle>Receipt</DialogTitle><Input aria-label="Addressee" placeholder="Addressee" value={addressee} onChange={e=>setAddressee(e.target.value)} maxLength={100}/><Input aria-label="Purpose" placeholder="Purpose" value={purpose} onChange={e=>setPurpose(e.target.value)} maxLength={200}/><Button disabled={!addressee.trim()||!purpose.trim()} onClick={()=>{setNamed(false);void print(true);}}>Print named receipt</Button></DialogContent></Dialog><Dialog open={qr} onOpenChange={setQr}><DialogContent><DialogTitle>QR receipt</DialogTitle>{cart.shareToken&&<><QRCodeSVG className="mx-auto" value={`${window.location.origin}/receipt/${cart.shareToken}`} size={224}/><p className="text-center">{r.receipt_no}</p></>}</DialogContent></Dialog></>:<p>No completed payment. <Link to="/sell" className="text-primary">New Sale</Link></p>}
 </RegisterShell>;}
