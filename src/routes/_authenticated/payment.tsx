import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Wallet, CreditCard, QrCode, Landmark, Users, Store, Truck, PackageCheck } from 'lucide-react';
import { useRegister } from '@/lib/register-store';
import { registerTotals, tenderTotals, type Tender } from '@/lib/register-rules';
import { registerQuery } from '@/lib/register-data';
import { useCurrentShop } from '@/lib/shop-context';
import { meQuery, yen } from '@/lib/app';
import { db, PLATFORMS, COD_FEES } from '@/lib/catalog';
import { receiptView } from '@/lib/receipt';
import { pageMeta } from '@/lib/metadata';
import { RegisterShell, RegisterLabel } from '@/components/RegisterShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoggedInStaff } from '@/components/LoggedInStaff';
import { TrackingFields } from '@/components/TrackingEditor';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export const Route = createFileRoute('/_authenticated/payment')({
  head: () => pageMeta('Payment — Royal Japan Register', 'Cash, card, PayPay, bank and COD payments for in-store and online sales.'),
  component: Payment,
});

type Method = Tender['method'];

function Payment() {
  const cart = useRegister();
  const { shopId } = useCurrentShop();
  const { data: me } = useQuery(meQuery);
  const { data } = useQuery(registerQuery(me?.id ?? '', shopId));
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<Tender[]>([{ method: 'Cash', amount: 0 }]);
  const [staff, setStaff] = useState('');
  const [customer, setCustomer] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // in-store / online
  const [channel, setChannel] = useState<'in_store' | 'online'>('in_store');
  const [platform, setPlatform] = useState('');
  const [cod, setCod] = useState(false);
  const [fee, setFee] = useState(0);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [postal, setPostal] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const lines = cart.shop === shopId && cart.owner === me?.id ? cart.lines : [];
  const privileged = me?.role === 'owner' || Boolean(me?.manager);
  let totals = { subtotal: 0, discount: 0, total: 0, tax: 0, count: 0 };
  let issue = '';
  const online = channel === 'online';
  const shippingFee = online ? fee : 0;
  try {
    totals = registerTotals(lines, cart.discount, privileged, data?.settings?.staff_discount_percent ?? 0);
  } catch (e) { issue = e instanceof Error ? e.message : 'Invalid cart'; }
  const grand = totals.total + shippingFee;
  let tender = { received: 0, change: 0 };
  if (!issue) {
    try { tender = tenderTotals(grand, payments); } catch (e) { issue = e instanceof Error ? e.message : 'Invalid payment'; }
  }
  if (!issue && online && cod && !fee) issue = 'Pick the COD shipping fee';
  if (!issue && online && tracking.trim() && !carrier) issue = 'Pick the carrier for the tracking number';

  const methods = [
    { name: 'Cash', label: 'Cash', icon: Wallet },
    { name: 'Card', label: 'Card', icon: CreditCard },
    { name: 'PayPay', label: 'QR/PayPay', icon: QrCode },
    { name: 'Bank', label: 'Bank transfer', icon: Landmark },
    ...(online && cod ? [{ name: 'COD', label: 'COD (paid on delivery)', icon: PackageCheck }] : []),
  ] as { name: Method; label: string; icon: typeof Wallet }[];

  useEffect(() => {
    setStaff(me?.staff_code ?? '');
    setCustomer('');
    setPayments([{ method: 'Cash', amount: 0 }]);
  }, [me?.id, me?.staff_code, shopId]);

  // Online sale: fill tracking from a phone that already has one (entered in Add Product)
  useEffect(() => {
    if (!online || tracking) return;
    const withTracking = lines.find((l) => l.tracking);
    if (withTracking) { setCarrier(withTracking.carrier ?? ''); setTracking(withTracking.tracking ?? ''); }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // COD: the courier collects everything, so payment = COD for the full amount
  useEffect(() => {
    if (online && cod) setPayments([{ method: 'COD', amount: grand }]);
    else setPayments((prev) => {
      const rest = prev.filter((p) => p.method !== 'COD');
      return rest.length ? rest : [{ method: 'Cash', amount: 0 }];
    });
  }, [online, cod, grand]);

  function toggleMethod(m: Method) {
    setPayments((prev) => prev.some((p) => p.method === m)
      ? prev.filter((p) => p.method !== m)
      : [...prev, { method: m, amount: Math.max(0, grand - prev.reduce((s, x) => s + x.amount, 0)) }]);
  }

  async function pay() {
    if (busy || issue || !staff || !lines.length) return;
    setBusy(true);
    setError('');
    try {
      const shipping = online ? {
        platform, cod, fee,
        carrier, tracking_number: tracking,
        recipient_name: name || data?.customers.find((c) => c.id === customer)?.name || '',
        recipient_phone: phone, postal_code: postal, address,
      } : null;
      const args = {
        _shop: shopId, _staff_code: staff,
        _items: lines.map((l) => ({ id: l.id, kind: l.kind, name: l.name, price: l.price, quantity: l.quantity, discount: l.discount })),
        _discount: cart.discount, _payments: payments,
        _customer: customer || null, _customer_name: name, _customer_phone: phone, _key: cart.key,
      };
      let { data: r, error: e } = await db.rpc('complete_pos_sale', { ...args, _channel: channel, _shipping: shipping });
      // Database not updated yet: in-store sales still work with the older checkout
      if (e && (e.code === 'PGRST202' || /function .*complete_pos_sale/i.test(e.message))) {
        if (online) throw new Error('Online sales need the latest database update. Ask the owner to run the new SQL in Supabase.');
        ({ data: r, error: e } = await db.rpc('complete_pos_sale', args));
      }
      if (e) throw e;
      const cleanNote = note.trim().slice(0, 500);
      if (cleanNote) {
        // Save the note on the receipt (needs the receipt-notes database update; the printed receipt shows it either way)
        const { error: ne } = await db.rpc('set_receipt_note', { _receipt_id: r.id, _note: cleanNote });
        if (ne) console.warn('Receipt note not saved:', ne.message);
        r.note = cleanNote;
      }
      setNote('');
      if (useRegister.getState().shop === shopId && useRegister.getState().owner === me?.id) cart.completed(receiptView(r), r.share_token);
      await Promise.all(['register', 'stock', 'dashboard', 'sales-list', 'receipts', 'find-products', 'stock-check-products', 'shipments'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      await navigate({ to: '/completed' });
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Payment was not saved');
    } finally { setBusy(false); }
  }

  return (
    <RegisterShell
      title="Payment"
      actions={<>
        <Button asChild variant="outline"><Link to="/cart">Cancel</Link></Button>
        <Button variant="outline" onClick={() => setCustomerOpen(true)}><Users /><RegisterLabel en="Customer" /></Button>
      </>}
      footer={<Button className="h-16 w-full text-xl" disabled={busy || !!issue || !staff || !lines.length} onClick={() => void pay()}><RegisterLabel en={busy ? 'Saving…' : `Pay ${yen(grand)}`} /></Button>}
    >
      {!lines.length ? <p>No active order. <Link to="/sell" className="text-primary underline">New Sale</Link></p> : <>
        <div className="space-y-2 border-b py-5 text-center">
          <p className="text-sm text-muted-foreground">Subtotal {yen(totals.subtotal)} · Discount −{yen(totals.discount)}{shippingFee > 0 && ` · Shipping +${yen(shippingFee)}`}</p>
          <p className="text-5xl font-semibold">{yen(grand)}</p>
          <p className="text-sm text-muted-foreground">Incl. consumption tax {yen(Math.floor(grand * 10 / 110))} · 10%</p>
        </div>
        {customer && <p className="text-sm">Customer: {data?.customers.find((c) => c.id === customer)?.name}</p>}
        <LoggedInStaff me={me} value={staff} onChange={setStaff} />

        {/* Sale type */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant={channel === 'in_store' ? 'default' : 'outline'} className="h-16 [&_svg]:size-6" onClick={() => { setChannel('in_store'); setCod(false); }}><Store />In-store sale</Button>
          <Button variant={online ? 'default' : 'outline'} className="h-16 [&_svg]:size-6" onClick={() => setChannel('online')}><Truck />Online / by post</Button>
        </div>

        {online && (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">Platform
                <select className="field" aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Select platform</option>
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <div className="space-y-1 text-sm">Cash on delivery (COD)
                <div className="flex gap-2">
                  <Button type="button" variant={cod ? 'default' : 'outline'} className="flex-1" onClick={() => { setCod(true); if (!fee) setFee(COD_FEES[0]!); }}>COD</Button>
                  <Button type="button" variant={!cod ? 'default' : 'outline'} className="flex-1" onClick={() => { setCod(false); setFee(0); }}>Paid already</Button>
                </div>
              </div>
            </div>
            {cod && (
              <div className="space-y-1 text-sm">COD shipping fee (added to the total)
                <div className="grid grid-cols-3 gap-2">
                  {COD_FEES.map((f) => <Button key={f} type="button" className="h-12" variant={fee === f ? 'default' : 'outline'} onClick={() => setFee(f)}>{yen(f)}</Button>)}
                </div>
              </div>
            )}
            <div className="space-y-1 text-sm">Shipping carrier and tracking number (can be added later on the Shipments page)
              <TrackingFields carrier={carrier} number={tracking} onCarrier={setCarrier} onNumber={setTracking} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input aria-label="Recipient name" placeholder="Recipient name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              <Input aria-label="Recipient phone" placeholder="Phone" value={phone} maxLength={50} onChange={(e) => setPhone(e.target.value)} />
              <Input aria-label="Postal code" placeholder="Postal code" value={postal} maxLength={10} onChange={(e) => setPostal(e.target.value)} />
              <Input aria-label="Address" className="sm:col-span-3" placeholder="Delivery address" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {methods.map((m) => (
            <Button key={m.name} variant={payments.some((p) => p.method === m.name) ? 'default' : 'outline'} className="h-24 flex-col [&_svg]:size-6" disabled={online && cod && m.name !== 'COD'} onClick={() => toggleMethod(m.name)}>
              <m.icon /><RegisterLabel en={m.label} />
            </Button>
          ))}
        </div>
        <div className="space-y-4">
          {payments.map((p) => (
            <div key={p.method} className="space-y-2">
              <label className="flex items-center justify-between gap-4">
                <span>{p.method} amount</span>
                <Input aria-label={`${p.method} amount`} type="number" min={0} readOnly={p.method === 'COD'} className="h-14 max-w-52 text-right text-xl" value={p.amount || ''}
                  onChange={(e) => setPayments(payments.map((v) => v.method === p.method ? { ...v, amount: Number(e.target.value) } : v))} />
              </label>
              {p.method === 'Cash' && (
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1000, 5000, 10000].map((n) => (
                    <Button key={n} variant="outline" className="h-12 px-1"
                      onClick={() => setPayments(payments.map((v) => v.method === 'Cash' ? { ...v, amount: n === 0 ? Math.max(0, grand - payments.filter((x) => x.method !== 'Cash').reduce((s, x) => s + x.amount, 0)) : n } : v))}>
                      {n === 0 ? 'Exact' : yen(n)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Notes on the receipt (optional)</span>
          <textarea aria-label="Receipt notes" className="field min-h-20 w-full py-2" maxLength={500} placeholder="e.g. Warranty 3 months · Screen protector included · Customer will pick up case tomorrow" value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="block text-right text-xs text-muted-foreground">{note.length}/500</span>
        </label>
        <div className="flex items-center justify-between border-t py-6"><RegisterLabel en="Change" /><strong className="text-3xl text-primary">{yen(tender.change)}</strong></div>
        {(error || issue) && <p role="alert" className="text-destructive">{error || issue}</p>}
      </>}
      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent>
          <DialogTitle>Customer</DialogTitle>
          <select className="field" aria-label="Select customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Walk-in / Optional</option>
            {data?.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
          </select>
          {!customer && <>
            <Input aria-label="Customer name" placeholder="Customer name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <Input aria-label="Customer phone" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
          </>}
          <p>Staff: {me?.name}</p>
          <Button onClick={() => setCustomerOpen(false)}>Done</Button>
        </DialogContent>
      </Dialog>
    </RegisterShell>
  );
}
