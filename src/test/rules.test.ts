import { describe, expect, it } from "vitest";
import { paidFor, validateBulkRows, type BulkRow } from "@/lib/bulk";
import { buildAlerts } from "@/lib/alerts";

const row = (o: Partial<BulkRow> = {}): BulkRow => ({
  model_id: "m", imei: "123456789012345", color: "Red", storage: "128GB", condition: "New", purchase_price: "100", selling_price: "200", ...o,
});

describe("bulk rows", () => {
  it("flags bad IMEI", () => expect(validateBulkRows([row({ imei: "123" })], new Set())[0]).toMatch(/Bad IMEI/));
  it("flags duplicate in system", () => expect(validateBulkRows([row()], new Set(["123456789012345"]))[0]).toMatch(/Duplicate/));
  it("flags duplicate in list", () => expect(validateBulkRows([row(), row()], new Set())).toEqual(["Duplicate (in this list)", "Duplicate (in this list)"]));
  it("flags missing price", () => expect(validateBulkRows([row({ selling_price: "" })], new Set())[0]).toBe("Missing selling price"));
  it("ok row", () => expect(validateBulkRows([row()], new Set())[0]).toBe("OK"));
});

describe("supplier paid", () => {
  it("due pays 0", () => expect(paidFor("Due", 1000, null)).toBe(0));
  it("partial pays amount", () => expect(paidFor("Partial", 1000, 300)).toBe(300));
  it("cash pays full", () => expect(paidFor("Cash", 1000, null)).toBe(1000));
});

describe("alerts", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const p = (o: object) => ({ id: "p", product_code: "P1", shop_id: "A", status: "sold", created_at: "2026-10-30T00:00:00Z", name: "x", ...o });
  it("below cost", () => {
    const a = buildAlerts({ sales: [{ receipt_no: "R", product_id: "p", sale_price: 90, shop_id: "A" }], products: [p({})], cost: { p: 100 }, now });
    expect(a.map((x) => x.kind)).toEqual(["Below cost"]);
  });
  it("different shop", () => {
    const a = buildAlerts({ sales: [{ receipt_no: "R", product_id: "p", sale_price: 200, shop_id: "B" }], products: [p({})], cost: { p: 100 }, now });
    expect(a.map((x) => x.kind)).toEqual(["Different shop"]);
  });
  it("60+ days in stock", () => {
    expect(buildAlerts({ sales: [], products: [p({ status: "in_stock", created_at: "2026-09-02T00:00:00Z" })], cost: {}, now }).length).toBe(1);
    expect(buildAlerts({ sales: [], products: [p({ status: "in_stock", created_at: "2026-09-03T00:00:00Z" })], cost: {}, now }).length).toBe(0);
  });
  const tr = (o: object) => ({ product_id: "p", from_shop_id: "A", to_shop_id: "B", status: "accepted", accepted_at: null, reject_reason: null, ...o });
  it("in transit over 24 hours", () => {
    expect(buildAlerts({ sales: [], products: [p({ status: "in_transit" })], cost: {}, now, transfers: [tr({ accepted_at: "2026-10-30T23:00:00Z" })] }).map((x) => x.kind)).toEqual(["In transit 24h+"]);
    expect(buildAlerts({ sales: [], products: [p({ status: "in_transit" })], cost: {}, now, transfers: [tr({ accepted_at: "2026-10-31T01:00:00Z" })] }).length).toBe(0);
  });
  it("rejected request", () => {
    expect(buildAlerts({ sales: [], products: [p({})], cost: {}, now, transfers: [tr({ status: "rejected", reject_reason: "Reserved" })] }).map((x) => x.kind)).toEqual(["Transfer rejected"]);
  });
});
