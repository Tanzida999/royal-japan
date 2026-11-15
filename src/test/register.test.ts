import { describe,it,expect } from 'vitest';
import { inclusiveTax,discountAmount,registerTotals,tenderTotals,type RegisterLine } from '@/lib/register-rules';
const phone: RegisterLine={id:'p',kind:'phone',name:'Phone',price:1100,quantity:1,discount:0,added:'',stock:1};
describe('register rules',()=>{
 it('extracts standard 10% consumption tax from inclusive prices',()=>{expect(inclusiveTax(1100)).toBe(100);expect(inclusiveTax(1000)).toBe(90);});
 it('keeps IMEI phone quantities fixed at one',()=>{expect(()=>registerTotals([{...phone,quantity:2}],0)).toThrow();expect(registerTotals([phone],0).count).toBe(1);});
 it('limits accessories to shop stock',()=>{expect(()=>registerTotals([{...phone,kind:'accessory',stock:2,quantity:3}],0)).toThrow();expect(registerTotals([{...phone,kind:'accessory',stock:2,quantity:2}],0).total).toBe(2200);});
 it('supports yen and percent discounts per line',()=>{expect(discountAmount(2000,10,true)).toBe(200);expect(discountAmount(2000,500,false)).toBe(500);expect(()=>discountAmount(100,101,false)).toThrow();});
 it('enforces combined staff line and order discount limits',()=>{expect(()=>registerTotals([{...phone,discount:60}],51,false,10)).toThrow();expect(registerTotals([{...phone,discount:60}],50,false,10).total).toBe(990);expect(()=>registerTotals([phone],1,false,0)).toThrow();});
 it('lets owner managers discount within subtotal',()=>{expect(registerTotals([phone],1100,true,0).total).toBe(0);expect(()=>registerTotals([phone],1101,true)).toThrow();});
 it('supports split payments and returns cash change',()=>{expect(tenderTotals(1100,[{method:'Card',amount:600},{method:'Cash',amount:1000}])).toEqual({received:1600,change:500});expect(()=>tenderTotals(1100,[{method:'Card',amount:1200}])).toThrow();expect(()=>tenderTotals(1100,[{method:'Cash',amount:1000}])).toThrow();});
});