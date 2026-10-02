import { describe, expect, it } from "vitest";
import type { Expense, Order, Subscription } from "../data/types";
import { parseLocal } from "./format";
import { activeFilterCount, clientRows, DEFAULT_CLIENT_FILTERS, DEFAULT_ORDER_FILTERS, filterClients, filterOrders, matchesQuery, orderFiltersToParams, parseOrderFilters, sortOrders, stageCounts } from "./filters";
import { bucketsFor, compactMoney, delta, dueByHour, expressShare, floorNow, formatPercentChange, handoverShares, kpi, metricValue, owedAt, paymentsByMethod, periodRange, previousRange, statusAt, topServices, workload, zoneShares } from "./metrics";
import { basketsCheckedIn, dueQueue, floorLoad, nextStage, ownerBadge, ownerDateLine, ownerNextStep, renewalMessage, updateMessage } from "./shop";
import { profitIn, spendByCategory, spendByKind, validateExpense } from "./spend";

const NOW = parseLocal("2026-09-15T11:00");

const order = (overrides: Partial<Order> = {}): Order => ({
  id: "o1",
  number: "AL-1041",
  customerId: "c1",
  createdAt: "2026-09-14T09:00:00",
  items: [{ id: "i1", serviceId: "medium-basket", qty: 1, unitPrice: 80 }],
  speed: "standard",
  care: { finish: "fold", starch: "light", scent: "lavender" },
  intake: "dropoff",
  handback: "collect",
  inAt: "2026-09-14T09:00",
  readyAt: "2026-09-15T15:00",
  status: "washing",
  history: [{ status: "booked", at: "2026-09-14T09:00:00" }, { status: "received", at: "2026-09-14T09:10:00" }],
  total: 80,
  riderFee: 0,
  expressFee: 0,
  planCover: 0,
  discount: 0,
  payChoice: "later",
  payments: [],
  ...overrides,
});

const pay = (amount: number, at: string, method: "momo" | "cash" | "bank" | "card" = "momo") => ({ id: `p${amount}${at}`, amount, method, reference: "x", at, receiptNo: "r", kind: "part" as const, receivedBy: "Aromatic Laundry" });

const clients = [
  { id: "c1", name: "Adwoa Asante", phone: "024 318 7702", email: "", town: "Weija", memberSince: "", hasAccount: false, points: 0, source: "tiktok" as const },
  { id: "c2", name: "Esi Boateng", phone: "055 902 1147", email: "", town: "Kasoa", memberSince: "", hasAccount: false, points: 0, source: "walkin" as const },
];

describe("owner stages", () => {
  it("names the exact stage, flags late work and money owed on the shelf", () => {
    expect(ownerBadge(order(), NOW)).toEqual({ label: "Washing", tone: "sky" });
    expect(ownerBadge(order({ readyAt: "2026-09-15T09:00" }), NOW)).toEqual({ label: "Late · Washing", tone: "sand" });
    expect(ownerBadge(order({ status: "ready" }), NOW)).toEqual({ label: "Ready · owes", tone: "sand" });
    expect(ownerBadge(order({ status: "ready", payments: [pay(80, "2026-09-14T09:10:00")] }), NOW)).toEqual({ label: "Ready", tone: "aqua" });
  });

  it("walks the stages, skipping the rider for counter collections", () => {
    expect(nextStage(order({ status: "finishing" }))).toBe("ready");
    expect(nextStage(order({ status: "ready" }))).toBe("done");
    expect(nextStage(order({ status: "ready", handback: "delivery" }))).toBe("out");
    expect(nextStage(order({ status: "done" }))).toBeNull();
  });

  it("asks the counter for one thing at a time: check in, wash, take the money, hand over", () => {
    expect(ownerNextStep(order({ status: "booked", intake: "pickup" }))).toEqual({ label: "Check in from rider", kind: "checkin" });
    expect(ownerNextStep(order({ status: "received" }))).toEqual({ label: "Start washing", kind: "advance", to: "washing" });
    expect(ownerNextStep(order({ status: "ready" }))).toEqual({ label: "Record payment", kind: "payment" });
    expect(ownerNextStep(order({ status: "ready", handback: "delivery" }))?.to).toBe("out");
    expect(ownerNextStep(order({ status: "out", handback: "delivery", payments: [pay(80, "x")] }))).toEqual({ label: "Mark delivered", kind: "handover" });
    expect(ownerNextStep(order({ status: "cancelled" }))).toBeNull();
  });

  it("puts the time that matters on each line", () => {
    expect(ownerDateLine(order(), NOW)).toEqual({ text: "Due today 15:00", late: false });
    expect(ownerDateLine(order({ readyAt: "2026-09-15T08:00" }), NOW)).toEqual({ text: "Late by 3 hours · was due today 08:00", late: true });
    expect(ownerDateLine(order({ status: "booked", intake: "pickup", inAt: "2026-09-16T09:00" }), NOW).text).toBe("Pickup tomorrow 09:00");
  });
});

describe("the floor", () => {
  const orders = [
    order({ id: "a", number: "AL-1001", readyAt: "2026-09-15T15:00" }),
    order({ id: "b", number: "AL-1002", status: "finishing", readyAt: "2026-09-15T13:00", items: [{ id: "x", serviceId: "medium-basket", qty: 2, unitPrice: 80 }, { id: "y", serviceId: "iron-shirt", qty: 5, unitPrice: 5 }] }),
    order({ id: "c", number: "AL-1003", status: "received", speed: "express", readyAt: "2026-09-15T10:00" }),
    order({ id: "d", number: "AL-1004", status: "ready" }),
    order({ id: "e", number: "AL-1005", status: "booked", inAt: "2026-09-15T16:00", history: [] }),
  ];

  it("counts what's on the floor, with the same services added together", () => {
    expect(floorLoad(orders)).toEqual([
      { serviceId: "iron-shirt", name: expect.any(String), qty: 5, orders: ["AL-1002"] },
      { serviceId: "medium-basket", name: expect.any(String), qty: 4, orders: ["AL-1001", "AL-1002", "AL-1003"] },
    ]);
  });

  it("works the queue soonest due first", () => {
    expect(dueQueue(orders).map((o) => o.id)).toEqual(["c", "b", "a"]);
  });

  it("summarises the floor right now", () => {
    expect(floorNow(orders, NOW)).toMatchObject({ inShop: 3, late: 1, ready: 1, dueToday: 3, arrivingToday: 1, express: 1 });
    const hours = dueByHour(orders, NOW);
    expect(hours.find((h) => h.hour === 13)?.count).toBe(1);
    expect(hours.find((h) => h.hour === 15)?.count).toBe(1);
    const days = workload(orders, NOW, 7);
    expect(days[0]).toMatchObject({ label: "Today", count: 1, closed: false });
  });

  it("counts baskets checked in on a day", () => {
    expect(basketsCheckedIn(orders, "2026-09-14")).toBe(5);
    expect(basketsCheckedIn(orders, "2026-09-15")).toBe(0);
  });
});

describe("messages", () => {
  it("tells the client the count and the ready time once the bag is checked in", () => {
    const msg = updateMessage(order({ status: "received", checkIn: { count: 12, notes: "One sock without its pair", at: "2026-09-14T09:10" } }), clients[0], NOW);
    expect(msg).toContain("Hi Adwoa,");
    expect(msg).toContain("We counted 12 pieces.");
    expect(msg).toContain("Noted: One sock without its pair.");
    expect(msg).toContain("Total: GH₵ 80");
  });

  it("asks for the balance when laundry is ready, and mentions the rider for deliveries", () => {
    expect(updateMessage(order({ status: "ready" }), clients[0], NOW)).toContain("Balance: GH₵ 80");
    expect(updateMessage(order({ status: "ready", handback: "delivery" }), clients[0], NOW)).toContain("goes out with our rider");
    expect(updateMessage(order({ status: "washing" }), undefined, NOW)).toContain("Hi there,");
  });

  it("nudges a plan member before renewal", () => {
    const msg = renewalMessage({ planId: "plan-family", renewsOn: "2026-09-17" }, clients[1], NOW);
    expect(msg).toContain("Hi Esi, your Family plan renews on");
    expect(msg).toContain("GH₵ 750");
    expect(msg).toContain("8 basket washes");
  });
});

describe("periods and deltas", () => {
  it("builds daily buckets ending today and the period before", () => {
    const range = periodRange("30d", NOW);
    const buckets = bucketsFor("30d", range);
    expect(buckets).toHaveLength(30);
    expect(buckets.at(-1)?.label).toBe("15 Sept");
    expect(previousRange("30d", range).end).toEqual(range.start);
    expect(bucketsFor("90d", periodRange("90d", NOW))).toHaveLength(13);
  });

  it("colours a change by whether it's good news, not by direction", () => {
    expect(delta(120, 100, "up")).toEqual({ change: 0.2, direction: "up", tone: "good" });
    expect(delta(120, 100, "down").tone).toBe("bad");
    expect(delta(5, 0, "up")).toEqual({ change: null, direction: "up", tone: "good" });
    expect(formatPercentChange(-0.084)).toBe("8%");
    expect(formatPercentChange(null)).toBe("new");
  });
});

describe("metrics", () => {
  const orders = [
    order({ id: "a", createdAt: "2026-09-10T09:00:00", status: "washing", total: 200, zoneId: "z-weija", intake: "pickup", history: [{ status: "booked", at: "2026-09-10T09:00:00" }, { status: "received", at: "2026-09-11T09:00:00" }], payments: [pay(100, "2026-09-11T10:00:00", "momo")] }),
    order({ id: "b", createdAt: "2026-08-01T09:00:00", status: "done", total: 160, readyAt: "2026-08-02T09:00", history: [{ status: "booked", at: "2026-08-01T09:00:00" }, { status: "received", at: "2026-08-01T09:30:00" }, { status: "ready", at: "2026-08-02T08:00:00" }, { status: "done", at: "2026-08-03T09:00:00" }], payments: [pay(160, "2026-08-03T09:00:00", "cash")] }),
    order({ id: "c", createdAt: "2026-09-14T09:00:00", status: "booked", total: 120, customerId: "c2", speed: "express", history: [{ status: "booked", at: "2026-09-14T09:00:00" }], items: [{ id: "i", serviceId: "big-basket", qty: 1, unitPrice: 120 }] }),
  ];
  const planPayments = [pay(400, "2026-09-12T10:00:00", "momo")];

  it("counts cash, plan payments included, inside the range only", () => {
    const range = periodRange("30d", NOW);
    expect(metricValue("cash", orders, range, NOW)).toBe(100);
    expect(metricValue("cash", orders, range, NOW, planPayments)).toBe(500);
    expect(metricValue("newOrders", orders, range, NOW)).toBe(2);
    expect(kpi("cash", orders, "7d", NOW, planPayments).value).toBe(500);
  });

  it("counts what's owed only on laundry the shop actually has", () => {
    expect(owedAt(orders, NOW)).toBe(100);
    expect(statusAt(orders[0]!, parseLocal("2026-09-10T12:00"))).toBe("booked");
  });

  it("measures readiness against the promised time", () => {
    expect(metricValue("onTime", orders, periodRange("90d", NOW), NOW)).toBe(100);
    expect(metricValue("onTime", [], periodRange("90d", NOW), NOW)).toBeNull();
  });

  it("ranks services, zones, handovers and payment methods", () => {
    const range = periodRange("90d", NOW);
    expect(topServices(orders, range)[0]).toMatchObject({ key: "medium-basket", count: 2 });
    expect(zoneShares(orders, range).map((z) => z.key)).toEqual(["z-weija"]);
    expect(handoverShares(orders, range).find((h) => h.key === "rider")?.count).toBe(1);
    expect(expressShare(orders, range)).toBeCloseTo(1 / 3);
    const methods = paymentsByMethod(orders, range, planPayments);
    expect(methods[0]).toMatchObject({ key: "momo", value: 500 });
    expect(methods.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1);
  });

  it("formats compact money for axes", () => {
    expect(compactMoney(18450)).toBe("GH₵ 18.4k");
    expect(compactMoney(950)).toBe("GH₵ 950");
  });
});

describe("order filters", () => {
  const orders = [
    order({ id: "a", number: "AL-1042", status: "washing", readyAt: "2026-09-15T09:00", customerId: "c1" }),
    order({ id: "b", number: "AL-1043", status: "ready", readyAt: "2026-09-15T16:00", customerId: "c2", payments: [pay(80, "2026-09-14T10:00:00")] }),
    order({ id: "c", number: "AL-0999", status: "done", readyAt: "2026-08-01T09:00", customerId: "c2", payments: [pay(80, "2026-08-02T10:00:00")] }),
    order({ id: "d", number: "AL-1044", status: "booked", readyAt: "2026-09-17T09:00", customerId: "c1", speed: "express", intake: "pickup", items: [{ id: "k", serviceId: "kente", qty: 2, unitPrice: 80 }], total: 160 }),
  ];

  it("shows active orders by default and round-trips through the URL", () => {
    const f = parseOrderFilters(new URLSearchParams());
    expect(f).toEqual(DEFAULT_ORDER_FILTERS);
    expect(filterOrders(orders, clients, f, NOW).map((o) => o.id)).toEqual(["a", "b", "d"]);
    const custom = { ...f, stages: ["done" as const], tags: ["express" as const], pay: "paid" as const, owedMax: 500, q: "Esi" };
    expect(parseOrderFilters(orderFiltersToParams(custom))).toEqual(custom);
    expect(orderFiltersToParams(f).toString()).toBe("");
    expect(activeFilterCount(custom)).toBe(4);
  });

  it("ignores junk in the URL", () => {
    const f = parseOrderFilters(new URLSearchParams("stage=bogus,ready&tag=nope,rider&pay=free&owedMin=-4&sort=zzz"));
    expect(f.stages).toEqual(["ready"]);
    expect(f.tags).toEqual(["rider"]);
    expect(f.pay).toBe("any");
    expect(f.owedMin).toBe(0);
    expect(f.sort).toBe("due");
  });

  it("finds orders by client name, phone in any format, order number or service", () => {
    const adwoa = clients[0];
    expect(matchesQuery(orders[0]!, adwoa, "adwoa")).toBe(true);
    expect(matchesQuery(orders[0]!, adwoa, "+233 24 318")).toBe(true);
    expect(matchesQuery(orders[0]!, adwoa, "al-1042")).toBe(true);
    expect(matchesQuery(orders[0]!, adwoa, "medium")).toBe(true);
    expect(matchesQuery(orders[0]!, adwoa, "kente")).toBe(false);
  });

  it("filters by tag, payment and due window, and counts stages with the other filters applied", () => {
    const base = parseOrderFilters(new URLSearchParams());
    expect(filterOrders(orders, clients, { ...base, due: "late" }, NOW).map((o) => o.id)).toEqual(["a"]);
    expect(filterOrders(orders, clients, { ...base, due: "today" }, NOW).map((o) => o.id)).toEqual(["a", "b"]);
    expect(filterOrders(orders, clients, { ...base, pay: "paid" }, NOW).map((o) => o.id)).toEqual(["b"]);
    expect(filterOrders(orders, clients, { ...base, tags: ["express", "rider"] }, NOW).map((o) => o.id)).toEqual(["d"]);
    expect(stageCounts(orders, clients, { ...base, q: "esi" }, NOW)).toMatchObject({ booked: 0, shop: 0, ready: 1, done: 1 });
  });

  it("sorts by due time with finished orders last", () => {
    expect(sortOrders(orders, "due", clients).map((o) => o.id)).toEqual(["a", "b", "d", "c"]);
    expect(sortOrders(orders, "owed", clients)[0]?.id).toBe("d");
  });

  it("summarises clients, counting only money owed on laundry already in", () => {
    const rows = clientRows(clients, orders, new Set(["c2"]));
    const adwoa = rows.find((r) => r.customer.id === "c1");
    expect(adwoa).toMatchObject({ orders: 2, active: 2, owed: 80, onPlan: false });
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, planOnly: true }).map((r) => r.customer.id)).toEqual(["c2"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, owes: true }).map((r) => r.customer.id)).toEqual(["c1"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, q: "0559" }).map((r) => r.customer.id)).toEqual(["c2"]);
  });
});

describe("money in and out", () => {
  const expenses: Expense[] = [
    { id: "e1", on: "2026-09-10", amount: 300, categoryId: "detergent", method: "momo", createdAt: "" },
    { id: "e2", on: "2026-09-01", amount: 1500, categoryId: "rent", method: "bank", createdAt: "" },
    { id: "e3", on: "2026-07-01", amount: 1500, categoryId: "rent", method: "bank", createdAt: "" },
  ];
  const sub: Subscription = { id: "s1", customerId: "c1", planId: "plan-solo", startedAt: "", periodStart: "2026-09-05", renewsOn: "2026-10-05", status: "active", payments: [pay(400, "2026-09-05T10:00:00")] };

  it("splits spend into the washing and the month's fixed costs", () => {
    const range = periodRange("30d", NOW);
    expect(spendByKind(expenses)).toEqual({ direct: 300, overhead: 3000 });
    expect(spendByCategory(expenses)[0]).toMatchObject({ id: "rent", amount: 3000 });
    expect(profitIn([order({ payments: [pay(80, "2026-09-14T10:00:00")] })], expenses, range, [sub])).toEqual({ received: 480, spent: 1800, profit: -1320, margin: -1320 / 480 });
    expect(profitIn([], [], range).margin).toBeNull();
  });

  it("rejects expenses the form shouldn't accept", () => {
    expect(validateExpense({ amount: 0, categoryId: "rent", on: "2026-09-10" })).toBe("Enter an amount above zero.");
    expect(validateExpense({ amount: 50, categoryId: "flowers", on: "2026-09-10" })).toBe("Choose what it was for.");
    expect(validateExpense({ amount: 50, categoryId: "power", on: "10/09/2026" })).toBe("Choose the day the money went out.");
    expect(validateExpense({ amount: 50, categoryId: "power", on: "2026-09-10" })).toBeNull();
  });
});
