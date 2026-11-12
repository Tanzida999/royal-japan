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
  it("overdue alerts follow the owner limit", () => {
    const input = { sales: [], products: [p({ status: "in_transit" })], cost: {}, now, transfers: [tr({ accepted_at: "2026-10-30T23:00:00Z" })] };
    expect(buildAlerts({ ...input, transitLimit: 48 })).toEqual([]);
    expect(buildAlerts({ ...input, transitLimit: 12 }).map(a => a.kind)).toEqual(["Transfer overdue"]);
  });
});

import { photoProblem, trackingUrl } from "@/lib/product-extras";
describe("condition photos", () => {
  it("Used B and Used C need at least 2 photos", () => {
    expect(photoProblem("Used B", 1)).not.toBe("");
    expect(photoProblem("Used C", 1)).not.toBe("");
    expect(photoProblem("Used C", 2)).toBe("");
  });
  it("other conditions need 1 to 6 photos", () => {
    expect(photoProblem("New", 0)).not.toBe("");
    expect(photoProblem("Used A", 1)).toBe("");
    expect(photoProblem("New", 7)).not.toBe("");
  });
});
describe("tracking links", () => {
  it("fills the number into each carrier's page", () => {
    expect(trackingUrl("Japan Post", "1234 5678")).toContain("requestNo1=12345678");
    expect(trackingUrl("Yamato", "123456")).toContain("kuronekoyamato.co.jp");
    expect(trackingUrl("Sagawa", "123456")).toContain("okurijoNo=123456");
    expect(trackingUrl("Other", "123456")).toBeNull();
  });
});

import { failedLoginAlerts, priceEdits } from "@/lib/accounts";

describe("account security alerts", () => {
  const f = (email: string, t: string) => ({ action: "failed_login", table_name: "auth", record_id: null, created_at: t, old_values: null, new_values: { email } });
  it("flags 3 failed logins for one account within 1 hour", () => {
    const r = failedLoginAlerts([f("a@x.jp", "2026-11-12T10:00:00Z"), f("a@x.jp", "2026-11-12T10:20:00Z"), f("a@x.jp", "2026-11-12T10:59:00Z")]);
    expect(r).toEqual([expect.objectContaining({ email: "a@x.jp", count: 3 })]);
  });
  it("does not flag 3 failed logins spread over more than 1 hour", () => {
    expect(failedLoginAlerts([f("a@x.jp", "2026-11-12T10:00:00Z"), f("a@x.jp", "2026-11-12T10:40:00Z"), f("a@x.jp", "2026-11-12T11:20:00Z")])).toEqual([]);
  });
  it("does not combine attempts on different accounts", () => {
    expect(failedLoginAlerts([f("a@x.jp", "2026-11-12T10:00:00Z"), f("b@x.jp", "2026-11-12T10:01:00Z"), f("a@x.jp", "2026-11-12T10:02:00Z")])).toEqual([]);
  });
  it("flags a selling price edit after a product was added", () => {
    const r = priceEdits([{ action: "update", table_name: "products", record_id: "p1", created_at: "2026-11-12T10:00:00Z", old_values: { selling_price: 50000 }, new_values: { selling_price: 45000 } }]);
    expect(r).toEqual([expect.objectContaining({ record_id: "p1", from: 50000, to: 45000 })]);
  });
  it("ignores product updates that do not change the price", () => {
    expect(priceEdits([{ action: "update", table_name: "products", record_id: "p1", created_at: "2026-11-12T10:00:00Z", old_values: { selling_price: 50000, status: "in_stock" }, new_values: { selling_price: 50000, status: "sold" } }])).toEqual([]);
  });
});
