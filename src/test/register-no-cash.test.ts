import { describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { registerQuery } from '@/lib/register-data';
import { registerTotals, tenderTotals } from '@/lib/register-rules';

describe('selling without Cash Check', () => {
  it('loads sale stock without reading any cash session or check', async () => {
    from.mockImplementation((table: string) => {
      const result = { data: table === 'pos_settings' ? null : [], error: null };
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'range', 'gt', 'is', 'maybeSingle']) {
        query[method] = () => query;
      }
      query['then'] = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
      return query;
    });
    const options = registerQuery('staff', 'shop');
    if (typeof options.queryFn !== 'function') throw new Error('Missing stock query');
    const result = await options.queryFn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined, client: {} } as never);
    expect(result).toMatchObject({ phones: [], accessories: [], held: [] });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['products', 'accessories', 'customers', 'pos_settings', 'held_sales', 'held_sale_phones']);
  });

  it('allows a fully paid sale without any opening or closing step', () => {
    const total = registerTotals([{ id: 'phone', kind: 'phone', name: 'Phone', price: 10000, quantity: 1, discount: 0, stock: 1, added: '' }], 0);
    expect(total.total).toBe(10000);
    expect(tenderTotals(total.total, [{ method: 'Cash', amount: 10000 }])).toEqual({ received: 10000, change: 0 });
  });
});