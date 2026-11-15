import {describe,it,expect} from 'vitest';
import {canManageSuppliers,supplierProblem,supplierSearch,purchaseTotals} from '@/lib/supplier-directory';
import {canReadShopSale,todaySales} from '@/lib/sales-history';
describe('supplier rules',()=>{
 it('owners and managers can manage suppliers, staff cannot',()=>{expect(canManageSuppliers({role:'owner',manager:false})).toBe(true);expect(canManageSuppliers({role:'staff',manager:true})).toBe(true);expect(canManageSuppliers({role:'staff',manager:false})).toBe(false);});
 it('requires an active supplier for intake',()=>{expect(supplierProblem('',[{id:'A'}])).not.toBe('');expect(supplierProblem('inactive',[{id:'A'}])).not.toBe('');expect(supplierProblem('A',[{id:'A'}])).toBe('');});
 it('searches name and phone',()=>{expect(supplierSearch({name:'Japan Wholesale',phone:'031234'},'wholesale')).toBe(true);expect(supplierSearch({name:'Japan Wholesale',phone:'031234'},'1234')).toBe(true);expect(supplierSearch({name:'Japan Wholesale',phone:'031234'},'other')).toBe(false);});
 it('uses existing paid amounts for dues',()=>{expect(purchaseTotals([{purchase_price:1000,paid_amount:300},{purchase_price:2000,paid_amount:null}])).toEqual({phones:2,bought:3000,paid:2300,due:700});});
});
describe('shop sales rules',()=>{
 it('staff cannot read other shop sales',()=>{expect(canReadShopSale(false,'A','B')).toBe(false);expect(canReadShopSale(false,'A','A')).toBe(true);});
 it('managers have the same shop boundary',()=>{expect(canReadShopSale(false,'B','A')).toBe(false);expect(canReadShopSale(false,'B','B')).toBe(true);});
 it('owners can read all shops',()=>{expect(canReadShopSale(true,null,'A')).toBe(true);expect(canReadShopSale(true,null,'B')).toBe(true);});
 it('today totals count receipts once, use JST, and exclude other shops',()=>{const rows=[{shop_id:'A',created_at:'2026-11-14T15:01:00Z',sale_price:900,receipt_id:'r1',receipt_no:'R1'},{shop_id:'A',created_at:'2026-11-15T10:00:00Z',sale_price:1100,receipt_id:'r1',receipt_no:'R1'},{shop_id:'B',created_at:'2026-11-15T10:00:00Z',sale_price:5000,receipt_id:'r2',receipt_no:'R2'},{shop_id:'A',created_at:'2026-11-14T14:59:00Z',sale_price:800,receipt_id:'r3',receipt_no:'R3'}];expect(todaySales(rows,'A','2026-11-15')).toEqual({count:1,phones:2,amount:2000});});
});
