import { describe, expect, it } from "vitest";
import { checkoutTotals, PAYMENTS, saleEligibility, imeiProblem, transferTiming } from "@/lib/pos";
import { supplierMatches, supplierTotals } from "@/lib/suppliers";
describe("cart checkout", () => {
  it("totals multiple phones, discount, paid and change", () => expect(checkoutTotals([20000,30000],5000,50000)).toEqual({subtotal:50000,discount:5000,total:45000,paid:50000,change:5000,netPrices:[18000,27000]}));
  it("allocates discount without losing yen", () => expect(checkoutTotals([1,1,1],1,2).netPrices.reduce((a,p) => a+p,0)).toBe(2));
  it("rejects insufficient payment", () => expect(() => checkoutTotals([100],0,99)).toThrow());
  it("rejects discount above subtotal", () => expect(() => checkoutTotals([100],101,100)).toThrow());
  it("supports the four payment methods", () => expect([...PAYMENTS]).toEqual(["Cash","Card","PayPay","Bank"]));
  it("allows only the current shop to sell", () => { expect(saleEligibility("in_stock","A","A")).toBe(""); expect(saleEligibility("in_stock","B","A")).not.toBe(""); });
  it("blocks in-transit and sold phones", () => { expect(saleEligibility("in_transit","A","A")).not.toBe(""); expect(saleEligibility("sold","A","A")).not.toBe(""); });
});
describe("IMEI", () => {
  it("requires 15 digits", () => { expect(imeiProblem("123456789012345",new Set())).toBe(""); expect(imeiProblem("12345678901234",new Set())).not.toBe(""); });
  it("rejects an existing IMEI", () => expect(imeiProblem("123456789012345",new Set(["123456789012345"]))).not.toBe(""));
});
describe("transfer limit", () => {
  it("default 24h expires requests at deadline, overdue cancellation only after", () => { const t=transferTiming("2026-11-01T00:00:00Z",24,new Date("2026-11-02T00:00:00Z")); expect(t.expired).toBe(true); expect(t.overdue).toBe(false); expect(transferTiming("2026-11-01T00:00:00Z",24,new Date("2026-11-02T00:00:01Z")).overdue).toBe(true); });
  it("uses configured hours", () => { expect(transferTiming("2026-11-01T00:00:00Z",48,new Date("2026-11-02T01:00:00Z")).overdue).toBe(false); });
});
describe("supplier filters", () => {
  const f = {year:"2026",month:"11",from:"2026-11-02",to:"2026-11-10",shopId:"A"};
  it("filters by year", () => expect(supplierMatches("2025-11-03","A",{...f,from:"",to:""})).toBe(false));
  it("filters by month", () => expect(supplierMatches("2026-10-03","A",{...f,from:"",to:""})).toBe(false));
  it("includes range boundaries", () => { expect(supplierMatches("2026-11-02","A",f)).toBe(true); expect(supplierMatches("2026-11-10","A",f)).toBe(true); expect(supplierMatches("2026-11-11","A",f)).toBe(false); });
  it("filters by shop", () => expect(supplierMatches("2026-11-03","B",f)).toBe(false));
  it("totals selected purchase amounts", () => expect(supplierTotals([{supplier:"Vendor",purchase_price:1000,paid_amount:300},{supplier:"Vendor",purchase_price:2000,paid_amount:2000}])).toEqual([{name:"Vendor",phones:2,bought:3000,paid:2300,due:700}]));
});