import { beforeEach, describe, expect, it } from "vitest";
import { localIso } from "../lib/format";
import { balanceDue } from "../lib/orders";
import { turnaroundHours } from "../lib/pricing";
import { readyTime } from "../lib/schedule";
import { HOURS, RULES, ZONES } from "./business";
import { DEFAULT_CARE, serviceById } from "./catalog";
import { createSeed } from "./seed";
import { actions, getAppData, shop, type WalkInOrder } from "./store";
import type { Order, OrderStatus } from "./types";

const now = new Date(2026, 8, 15, 11, 0);
const fresh = (id: string) => getAppData().orders.find((o) => o.id === id)!;
const find = (test: (o: Order) => boolean, what: string) => {
  const order = getAppData().orders.find(test);
  if (!order) throw new Error(`No ${what} in the sample data`);
  return order;
};
const ok = <T,>(result: T | { error: string }): T => {
  if (typeof result === "object" && result !== null && "error" in result) throw new Error(result.error);
  return result as T;
};

describe("sample shop book", () => {
  const seed = createSeed(new Date(2026, 9, 2, 11, 30));

  it("numbers orders and receipts once each, in order", () => {
    const numbers = seed.orders.map((o) => o.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((n) => /^AL-\d{4}$/.test(n))).toBe(true);
    const receipts = [...seed.orders.flatMap((o) => o.payments), ...seed.subscriptions.flatMap((s) => s.payments)].map((p) => p.receiptNo);
    expect(new Set(receipts).size).toBe(receipts.length);
    expect(receipts.every((r) => /^ALR-\d{4}-\d{4}$/.test(r))).toBe(true);
    expect(seed.counters.receipt).toBe(receipts.length);
  });

  it("never takes more than an order costs, or a plan wash without a plan", () => {
    const subs = new Map(seed.subscriptions.map((s) => [s.id, s]));
    for (const order of seed.orders) {
      expect(order.payments.every((p) => p.amount > 0)).toBe(true);
      expect(balanceDue(order)).toBeGreaterThanOrEqual(0);
      expect(order.payments.reduce((s, p) => s + p.amount, 0)).toBeLessThanOrEqual(order.total);
      if (order.payChoice === "plan") expect(subs.get(order.subscriptionId ?? "")?.customerId).toBe(order.customerId);
      for (const item of order.items) expect(serviceById(item.serviceId)).toBeDefined();
    }
  });

  it("keeps the rider and the counter consistent with each order", () => {
    const byId = new Map(seed.orders.map((o) => [o.id, o]));
    for (const a of seed.appointments.filter((x) => x.orderId)) {
      const order = byId.get(a.orderId!);
      expect(order).toBeDefined();
      if (a.purpose === "delivery") expect(order?.handback).toBe("delivery");
      if (a.purpose === "pickup") expect(order?.intake).toBe("pickup");
    }
    for (const order of seed.orders) {
      if (order.handback === "collect") expect(order.status).not.toBe("out");
      if (order.status === "booked") expect(order.checkIn).toBeUndefined();
      if (order.zoneId) expect(ZONES.some((z) => z.id === order.zoneId)).toBe(true);
    }
  });

  it("has a live floor for the owner's Today screen", () => {
    const statuses = new Set(seed.orders.map((o) => o.status));
    const missing = (["booked", "received", "washing", "finishing", "ready", "done", "cancelled"] as OrderStatus[]).filter((s) => !statuses.has(s));
    expect(missing).toEqual([]);
    expect(seed.reviews.some((r) => r.status === "pending")).toBe(true);
    expect(seed.subscriptions.filter((s) => s.status === "active").length).toBeGreaterThanOrEqual(5);
    expect(seed.expenses.length).toBeGreaterThan(0);
  });
});

describe("the counter", () => {
  beforeEach(() => actions.resetDemo());

  it("checks a bag in: count, notes, photos and the final price, and starts the clock from now", () => {
    const booked = find((o) => o.status === "booked" && o.payments.length === 0, "booked order");
    expect(shop.checkIn(booked.id, { count: 0 }, now)).toEqual({ error: "Count the garments: between 1 and 500." });
    expect(shop.checkIn(booked.id, { count: 12, total: -5 }, now)).toHaveProperty("error");
    const photos = ["a", "b", "c", "d", "e"].map((p) => `data:image/jpeg;base64,${p}`);
    const { order } = ok(shop.checkIn(booked.id, { count: 12, notes: "  Missing button on the blue shirt ", photos, total: booked.total + 20 }, now));
    expect(order).toMatchObject({ status: "received", total: booked.total + 20 });
    expect(order.checkIn).toMatchObject({ count: 12, notes: "Missing button on the blue shirt" });
    expect(order.checkIn?.photos).toHaveLength(4);
    expect(order.readyAt).toBe(localIso(readyTime(now, turnaroundHours(order.items), order.speed === "express", RULES.expressHours, HOURS)));
    expect(shop.checkIn(booked.id, { count: 12 }, now)).toEqual({ error: "This order is already checked in." });
    if (booked.pickupId) expect(getAppData().appointments.find((a) => a.id === booked.pickupId)?.status).toBe("done");
  });

  it("won't drop the total below what's already been paid", () => {
    const paid = find((o) => o.status === "booked" && o.payments.length > 0 && o.total > 0, "paid booking");
    const already = paid.total - balanceDue(paid);
    expect(shop.checkIn(paid.id, { count: 5, total: already - 1 }, now)).toEqual({ error: "The total can't be less than what's already paid." });
  });

  it("moves an order along, but never skips check-in or sends a counter order with the rider", () => {
    const booked = find((o) => o.status === "booked", "booked order");
    expect(shop.moveTo(booked.id, "washing", now)).toEqual({ error: "Check it in at the counter first." });
    const collect = find((o) => o.status === "washing" && o.handback === "collect", "collect order in the wash");
    expect(shop.moveTo(collect.id, "out", now)).toEqual({ error: "This order is collected at the counter." });
    ok(shop.moveTo(collect.id, "finishing", now));
    expect(fresh(collect.id).history.at(-1)).toMatchObject({ status: "finishing" });
  });

  it("won't hand over an order while it owes, unless the owner allows it", () => {
    const owing = find((o) => o.status === "ready" && balanceDue(o) > 0, "ready order with a balance");
    expect(shop.moveTo(owing.id, "done", now)).toEqual({ error: "This order still has a balance to pay." });
    ok(shop.moveTo(owing.id, "done", now, { allowOwing: true }));
    expect(fresh(owing.id).status).toBe("done");
    expect(shop.moveTo(owing.id, "washing", now)).toEqual({ error: "This order is closed." });
  });

  it("takes a payment with the next receipt number, and refuses overpaying or paying a cancelled order", () => {
    const owing = find((o) => o.status === "ready" && balanceDue(o) > 0, "ready order with a balance");
    const before = getAppData().counters.receipt;
    expect(shop.recordPayment(owing.id, { amount: balanceDue(owing) + 1, method: "momo" }, now)).toHaveProperty("error");
    const { payment } = ok(shop.recordPayment(owing.id, { amount: balanceDue(owing), method: "cash" }, now));
    expect(payment).toMatchObject({ reference: "Cash", receivedBy: "Aromatic Laundry" });
    expect(payment.receiptNo).toMatch(new RegExp(`-${String(before + 1).padStart(4, "0")}$`));
    expect(balanceDue(fresh(owing.id))).toBe(0);

    const active = find((o) => o.status === "washing" && balanceDue(o) > 0, "order in the wash with a balance");
    ok(shop.cancel(active.id, now));
    expect(shop.recordPayment(active.id, { amount: 10, method: "momo" }, now)).toEqual({ error: "This order is cancelled, so it can't take payments." });
    expect(shop.cancel(active.id, now)).toEqual({ error: "This order is already closed." });
  });

  it("releases upcoming rider windows when an order is cancelled", () => {
    const data = getAppData();
    const nowIso = localIso(new Date());
    const window = data.appointments.find((a) => a.orderId && a.start > nowIso && a.status !== "cancelled" && a.status !== "done");
    if (!window?.orderId) throw new Error("No upcoming rider window in the sample data");
    ok(shop.cancel(window.orderId));
    expect(getAppData().appointments.find((a) => a.id === window.id)?.status).toBe("cancelled");
  });

  it("moderates reviews and keeps notes and care on the client", () => {
    const pending = getAppData().reviews.find((r) => r.status === "pending")!;
    shop.setReviewStatus(pending.id, "published");
    expect(shop.replyToReview(pending.id, " ")).toEqual({ error: "Write a reply first." });
    ok(shop.replyToReview(pending.id, "Thank you, see you next week!"));
    expect(getAppData().reviews.find((r) => r.id === pending.id)).toMatchObject({ status: "published", reply: "Thank you, see you next week!" });

    const client = getAppData().customers[1]!;
    expect(shop.saveNotes(client.id, "x".repeat(4001))).toHaveProperty("error");
    ok(shop.saveNotes(client.id, "  Rider: call at the gate.  "));
    ok(shop.saveCare(client.id, { finish: "hang", starch: "firm", scent: "fresh-linen", notes: " " }));
    expect(getAppData().customers[1]).toMatchObject({ notes: "Rider: call at the gate.", care: { finish: "hang", starch: "firm", scent: "fresh-linen", notes: undefined } });
  });
});

describe("counter drop-offs", () => {
  beforeEach(() => actions.resetDemo());

  const walkIn = (overrides: Partial<WalkInOrder> = {}): WalkInOrder => ({
    newClient: { name: "  Ama   Owusu ", phone: "020 111 2233", town: "Weija", source: "walkin" },
    items: [{ serviceId: "medium-basket", qty: 2, unitPrice: 80 }],
    speed: "express",
    care: DEFAULT_CARE,
    handback: "collect",
    checkIn: { count: 18, notes: "Two school uniforms" },
    total: 210,
    riderFee: 0,
    expressFee: 50,
    planCover: 0,
    payment: { amount: 210, method: "momo", reference: "MTN 55667788" },
    ...overrides,
  });

  it("creates the client, starts the order checked in and takes the payment", () => {
    const before = getAppData().customers.length;
    const { order, payment } = ok(shop.createOrder(walkIn(), now));
    expect(getAppData().customers).toHaveLength(before + 1);
    expect(getAppData().customers.find((c) => c.id === order.customerId)).toMatchObject({ name: "Ama Owusu", source: "walkin", hasAccount: false });
    expect(order).toMatchObject({ status: "received", intake: "dropoff", speed: "express", payChoice: "later", checkIn: { count: 18, notes: "Two school uniforms" } });
    expect(order.readyAt).toBe("2026-09-15T14:00");
    expect(payment).toMatchObject({ amount: 210, kind: "full", reference: "MTN 55667788" });
  });

  it("matches a returning number instead of creating a duplicate", () => {
    const existing = getAppData().customers[3]!;
    const before = getAppData().customers.length;
    const { order } = ok(shop.createOrder(walkIn({ newClient: { name: "Someone", phone: existing.phone, town: "", source: "walkin" }, payment: undefined }), now));
    expect(order.customerId).toBe(existing.id);
    expect(getAppData().customers).toHaveLength(before);
  });

  it("checks the basics before taking it in", () => {
    expect(shop.createOrder(walkIn({ newClient: { name: "A", phone: "020 111 2233", town: "", source: "walkin" } }), now)).toEqual({ error: "Enter the client's name." });
    expect(shop.createOrder(walkIn({ newClient: { name: "Ama", phone: "12345", town: "", source: "walkin" } }), now)).toHaveProperty("error");
    expect(shop.createOrder(walkIn({ items: [] }), now)).toEqual({ error: "Add at least one service." });
    expect(shop.createOrder(walkIn({ checkIn: { count: 0 } }), now)).toEqual({ error: "Count the garments before checking in." });
    expect(shop.createOrder(walkIn({ handback: "delivery" }), now)).toEqual({ error: "Choose the delivery area." });
    expect(shop.createOrder(walkIn({ customerId: "c-nope" }), now)).toEqual({ error: "We couldn't find that client." });
  });

  it("books the delivery window and takes plan baskets off the client's plan", () => {
    const sub = getAppData().subscriptions.find((s) => s.customerId === "c-demo")!;
    const { order } = ok(shop.createOrder(walkIn({ customerId: "c-demo", newClient: undefined, usePlan: true, planCover: 160, total: 50, handback: "delivery", zoneId: "z-weija", deliveryStart: "2026-09-15T17:00", payment: undefined }), new Date()));
    expect(order).toMatchObject({ subscriptionId: sub.id, payChoice: "plan", planCover: 160, zoneId: "z-weija" });
    expect(getAppData().appointments.find((a) => a.id === order.deliveryId)).toMatchObject({ purpose: "delivery", start: "2026-09-15T17:00", status: "confirmed" });
    expect(shop.createOrder(walkIn({ usePlan: true }), new Date())).toEqual({ error: "This client isn't on an active plan." });
  });
});

describe("plans, prices and settings", () => {
  beforeEach(() => actions.resetDemo());

  it("takes a renewal at the counter for the plan's price only", () => {
    const sub = getAppData().subscriptions.find((s) => s.customerId !== "c-demo" && s.planId === "plan-family")!;
    expect(shop.recordPlanPayment(sub.id, { amount: 400, method: "cash" })).toEqual({ error: "A month of Family is GH₵ 750." });
    const { payment } = ok(shop.recordPlanPayment(sub.id, { amount: 750, method: "momo", reference: "MTN 12345678" }));
    expect(payment).toMatchObject({ reference: "MTN 12345678", receivedBy: "Aromatic Laundry" });
    expect(getAppData().subscriptions.find((s) => s.id === sub.id)?.periodStart).toBe(sub.renewsOn);
    shop.setSubscriptionStatus(sub.id, "cancelled");
    expect(shop.recordPlanPayment(sub.id, { amount: 750, method: "cash" })).toEqual({ error: "This plan was cancelled. Join again from Plans." });
  });

  it("edits prices and plans within sensible limits, and resets them", () => {
    expect(shop.saveService("big-basket", { price: 0 })).toEqual({ error: "Enter a price above zero." });
    expect(shop.saveService("big-basket", { hours: 0 })).toHaveProperty("error");
    expect(ok(shop.saveService("big-basket", { price: 130 })).service.price).toBe(130);
    expect(serviceById("big-basket")?.price).toBe(130);
    shop.resetServices();
    expect(serviceById("big-basket")?.price).toBe(120);
    expect(shop.savePlan("plan-solo", { baskets: 0 })).toHaveProperty("error");
    expect(ok(shop.savePlan("plan-solo", { perks: [" Free pickup ", ""] })).plan.perks).toEqual(["Free pickup"]);
  });

  it("validates shop settings and rider zones", () => {
    expect(shop.saveSettings({ shop: { phone: "123" } })).toHaveProperty("error");
    expect(shop.saveSettings({ rules: { expressFee: -1 } })).toEqual({ error: "The express fee must be between GH₵ 0 and GH₵ 10,000." });
    expect(shop.saveSettings({ zones: [] })).toEqual({ error: "Keep at least one rider zone." });
    expect(shop.saveSettings({ hours: { ...HOURS, 1: ["21:00", "07:00"] } })).toEqual({ error: "Each day has to close after it opens." });
    ok(shop.saveSettings({ rules: { expressFee: 60 }, zones: [{ id: "z-weija", name: " Weija ", areas: " Weija ", fee: 10 }] }));
    expect(RULES.expressFee).toBe(60);
    expect(ZONES).toEqual([{ id: "z-weija", name: "Weija", areas: "Weija", fee: 10 }]);
    shop.resetSettings();
    expect(ZONES).toHaveLength(4);
  });

  it("records and removes expenses", () => {
    expect(shop.addExpense({ on: "2026-09-15", amount: 0, categoryId: "detergent", method: "cash" })).toEqual({ error: "Enter an amount above zero." });
    const { expense } = ok(shop.addExpense({ on: "2026-09-15", amount: 85.555, categoryId: "detergent", note: " Two gallons of softener ", method: "momo" }));
    expect(expense).toMatchObject({ amount: 85.56, note: "Two gallons of softener" });
    shop.removeExpense(expense.id);
    expect(getAppData().expenses.some((e) => e.id === expense.id)).toBe(false);
  });
});
