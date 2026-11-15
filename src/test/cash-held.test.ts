import {describe,it,expect} from 'vitest';
import {DENOMINATIONS,HOLD_HOURS,heldActive,countedCash,cashDifference,cashDifferenceAlerts,reasonProblem} from '@/lib/cash-rules';
describe('held sales',()=>{
 it('reserves phones for 24 hours and releases exactly at deadline',()=>{expect(HOLD_HOURS).toBe(24);expect(heldActive('held','2026-11-16T03:45:00Z',new Date('2026-11-16T03:44:59Z'))).toBe(true);expect(heldActive('held','2026-11-16T03:45:00Z',new Date('2026-11-16T03:45:00Z'))).toBe(false);});
 it('resuming and cancelling stop reservations',()=>{expect(heldActive('resumed','2026-11-16T03:45:00Z',new Date('2026-11-15T03:45:00Z'))).toBe(false);expect(heldActive('cancelled','2026-11-16T03:45:00Z',new Date('2026-11-15T03:45:00Z'))).toBe(false);});
 it('requires a cancellation or cash movement reason',()=>{expect(reasonProblem('  ')).toBe('Reason is required');expect(reasonProblem('Customer cancelled')).toBe('');});
});
describe('cash counting and closing',()=>{
 it('counts Japanese notes and coins from 10000 down to 1 yen',()=>{expect(DENOMINATIONS).toEqual([10000,5000,2000,1000,500,100,50,10,5,1]);expect(countedCash({'10000':2,'1000':3,'500':1,'1':4})).toBe(23504);});
 it('rejects negative fractional or unsupported note counts',()=>{expect(()=>countedCash({'1000':-1})).toThrow();expect(()=>countedCash({'1000':1.5})).toThrow();expect(()=>countedCash({'3':1})).toThrow();});
 it('includes float plus net cash sales and cash in minus cash out',()=>{expect(cashDifference(10000,5000,2000,3000,14500)).toEqual({expected:14000,difference:500});});
 it('alerts owner on every nonzero close difference but not checks or zero',()=>{expect(cashDifferenceAlerts([{kind:'close',difference:0},{kind:'check',difference:100},{kind:'close',difference:-1},{kind:'close',difference:500}])).toEqual([{kind:'close',difference:-1},{kind:'close',difference:500}]);});
});