import { beforeEach, describe, expect, it } from "vitest";
import { visibleOrders } from "../lib/checkout";
import { dayKey } from "../lib/format";
import { addMonth, planStatus } from "../lib/plans";
import { DEFAULT_CARE } from "./catalog";
import { DEMO_ACCOUNT_PHONE } from "./seed";
import { accessOf, accountOf, accountPlanOf, actions, getAppData, type OrderDraft } from "./store";

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  items: [{ serviceId: "big-basket", qty: 1, unitPrice: 120 }],
  speed: "standard",
  care: { ...DEFAULT_CARE, notes: "  White shirts on their own  " },
  intake: "pickup",
  handback: "delivery",
  zoneId: "z-weija",
  inAt: "2026-10-10T09:00",
  readyAt: "2026-10-11T09:00",
  deliveryStart: "2026-10-11T11:00",
  saveCare: false,
  contact: { name: "Ama Mensah", phone: "024 851 5773", email: "ama@gmail.com", town: "Gbawe", address: "Gbawe Zero, behind the Total station", digitalAddress: "" },
  remember: true,
  payChoice: "later",
  total: 150,
  riderFee: 30,
  expressFee: 0,
  planCover: 0,
  discount: 0,
  ...overrides,
});

const pay = (amount: number) => ({ amount, method: "momo" as const, payer: "MTN MoMo · 024 851 5773" });

const placed = (overrides: Partial<OrderDraft> = {}) => {
  const result = actions.placeOrder(draft(overrides));
  if ("error" in result) throw new Error(result.error);
  return result;
};

describe("guest booking", () => {
  beforeEach(() => actions.resetDemo());

  it("starts signed out with nothing on this phone", () => {
    const data = getAppData();
    expect(accountOf(data)).toBeNull();
    expect(visibleOrders(data.orders, accessOf(data))).toEqual([]);
  });

  it("books a pickup and delivery without paying, and holds both rider windows", () => {
    const before = getAppData().counters.order;
    const { order, payment } = placed();
    const data = getAppData();
    expect(payment).toBeUndefined();
    expect(order).toMatchObject({ number: `AL-${before}`, status: "booked", payChoice: "later", payments: [], zoneId: "z-weija", riderFee: 30 });
    expect(order.care.notes).toBe("White shirts on their own");
    expect(data.customers.find((c) => c.id === order.customerId)).toMatchObject({ name: "Ama Mensah", hasAccount: false });
    const windows = data.appointments.filter((a) => a.orderId === order.id);
    expect(windows.map((a) => [a.purpose, a.start, a.status])).toEqual([
      ["pickup", "2026-10-10T09:00", "requested"],
      ["delivery", "2026-10-11T11:00", "requested"],
    ]);
    expect(data.device.orderIds).toEqual([order.id]);
    expect(data.device.contact?.name).toBe("Ama Mensah");
    expect(data.counters.order).toBe(before + 1);
  });

  it("drops the zone and windows when the client brings it in and collects", () => {
    const { order } = placed({ intake: "dropoff", handback: "collect", deliveryStart: undefined, riderFee: 0, total: 120 });
    expect(order.zoneId).toBeUndefined();
    expect(getAppData().appointments.some((a) => a.orderId === order.id)).toBe(false);
  });

  it("issues the next receipt when the client pays at checkout", () => {
    const receipts = getAppData().counters.receipt;
    const { order, payment } = placed({ payChoice: "now", payment: pay(150) });
    expect(payment).toMatchObject({ amount: 150, kind: "full", receivedBy: "Paystack (online)" });
    expect(payment?.reference).toMatch(new RegExp(`^${order.number.replace("-", "")}-[A-Z0-9]{6}$`));
    expect(payment?.receiptNo).toMatch(new RegExp(`-${String(receipts + 1).padStart(4, "0")}$`));
    expect(getAppData().counters.receipt).toBe(receipts + 1);
  });

  it("refuses an empty basket and an overpayment", () => {
    expect(actions.placeOrder(draft({ items: [{ serviceId: "big-basket", qty: 0, unitPrice: 120 }] }))).toEqual({ error: "Add at least one service." });
    expect(actions.placeOrder(draft({ payChoice: "now", payment: pay(500) }))).toEqual({ error: "That's more than the GH₵ 150 balance." });
  });

  it("pays the balance later from the order", () => {
    const { order } = placed();
    const result = actions.payOrder(order.id, pay(100));
    if ("error" in result) throw new Error(result.error);
    expect(result.payment.kind).toBe("part");
    expect(actions.payOrder(order.id, pay(60))).toEqual({ error: "That's more than the GH₵ 50 balance." });
    expect(actions.payOrder("nope", pay(10))).toEqual({ error: "We couldn't find that order." });
  });

  it("cancels before the rider comes and releases both windows", () => {
    const { order } = placed();
    actions.cancelOrder(order.id, new Date(2026, 9, 1, 9, 0));
    const data = getAppData();
    expect(data.orders.find((o) => o.id === order.id)?.status).toBe("cancelled");
    expect(data.appointments.filter((a) => a.orderId === order.id).every((a) => a.status === "cancelled")).toBe(true);
  });

  it("keeps care choices on the record only when asked", () => {
    const { order } = placed({ saveCare: true, care: { finish: "hang", starch: "firm", scent: "lavender" } });
    expect(getAppData().customers.find((c) => c.id === order.customerId)?.care).toEqual({ finish: "hang", starch: "firm", scent: "lavender" });
  });
});

describe("accounts", () => {
  beforeEach(() => actions.resetDemo());

  it("logs in to the sample account only after the code checks out", () => {
    const code = actions.sendCode(DEMO_ACCOUNT_PHONE);
    expect(actions.checkCode(DEMO_ACCOUNT_PHONE, code === "000000" ? "111111" : "000000")).toBe("wrong");
    expect(actions.checkCode(DEMO_ACCOUNT_PHONE, code)).toBe("ok");
    expect(actions.logIn(DEMO_ACCOUNT_PHONE)?.name).toBe("Akosua Boateng");
    const data = getAppData();
    const mine = data.orders.filter((o) => o.customerId === "c-demo");
    expect(mine.length).toBeGreaterThanOrEqual(7);
    expect(visibleOrders(data.orders, accessOf(data))).toHaveLength(mine.length);
    actions.logOut();
    expect(accountOf(getAppData())).toBeNull();
  });

  it("turns a guest's record into an account and keeps their orders", () => {
    const { order } = placed();
    const account = actions.createAccount({ name: "Ama Mensah", phone: "0248515773" });
    expect(account).toMatchObject({ id: order.customerId, hasAccount: true });
    expect(accountOf(getAppData())?.id).toBe(order.customerId);
    expect(actions.logIn("020 111 2233")).toBeNull();
  });

  it("finds an order from another phone by number and WhatsApp number", () => {
    const { order } = placed();
    actions.forgetDevice();
    expect(getAppData().device).toMatchObject({ contact: null, orderIds: [] });
    expect(actions.lookUpOrder(order.number, "0201112233")).toBeNull();
    expect(actions.lookUpOrder(order.number, "024 851 5773")?.id).toBe(order.id);
    actions.addOrderToDevice(order.id);
    actions.addOrderToDevice(order.id);
    expect(getAppData().device.orderIds).toEqual([order.id]);
  });

  it("saves how the client likes it done, but only for an account", () => {
    expect(actions.saveCare(DEFAULT_CARE)).toEqual({ error: "Log in to save this." });
    actions.logIn(DEMO_ACCOUNT_PHONE);
    expect(actions.saveCare({ ...DEFAULT_CARE, notes: "x".repeat(301) })).toHaveProperty("error");
    expect(actions.saveCare({ finish: "fold", starch: "none", scent: "unscented", notes: "  Baby clothes  " })).toEqual({ ok: true });
    expect(accountOf(getAppData())?.care).toEqual({ finish: "fold", starch: "none", scent: "unscented", notes: "Baby clothes" });
  });
});

describe("monthly plans", () => {
  beforeEach(() => actions.resetDemo());
  const now = () => new Date();

  it("puts basket washes on the plan, rider free, until the month's baskets run out", () => {
    actions.logIn(DEMO_ACCOUNT_PHONE);
    const sub = accountPlanOf(getAppData())!;
    expect(sub.id).toBe("s-demo");
    const left = planStatus(sub, getAppData().orders, now()).left;
    expect(left).toBe(2);
    const planDraft = { payChoice: "plan" as const, total: 0, riderFee: 0, planCover: 120 };
    for (let i = 0; i < left; i++) expect(placed(planDraft).order).toMatchObject({ subscriptionId: "s-demo", planCover: 120, payChoice: "plan" });
    expect(actions.placeOrder(draft(planDraft))).toEqual({ error: "You've used this month's basket washes. Pay for this one, or renew early." });
  });

  it("refuses a plan order from someone without a plan", () => {
    expect(actions.placeOrder(draft({ payChoice: "plan", planCover: 120 }))).toEqual({ error: "Your plan isn't active. Renew it, or pay for this one." });
  });

  it("joins a plan once, for the plan's price, starting today", () => {
    expect(actions.joinPlan("plan-solo", pay(400))).toEqual({ error: "Log in to join a plan." });
    actions.createAccount({ name: "Kwame Asare", phone: "020 765 4321" });
    expect(actions.joinPlan("plan-family", pay(400))).toEqual({ error: "The payment doesn't match the plan price." });
    expect(actions.joinPlan("plan-nope", pay(400))).toEqual({ error: "That plan isn't available." });
    const joined = actions.joinPlan("plan-family", pay(750));
    if ("error" in joined) throw new Error(joined.error);
    expect(joined.subscription).toMatchObject({ planId: "plan-family", status: "active", periodStart: dayKey(now()), renewsOn: dayKey(addMonth(now())) });
    expect(joined.payment).toMatchObject({ amount: 750, kind: "full" });
    expect(actions.joinPlan("plan-solo", pay(400))).toEqual({ error: "You're already on a plan." });
  });

  it("cancels at the end of the month, can change its mind, and renewing clears the cancel", () => {
    actions.logIn(DEMO_ACCOUNT_PHONE);
    actions.cancelPlan("s-demo");
    const sub = () => getAppData().subscriptions.find((s) => s.id === "s-demo")!;
    expect(sub()).toMatchObject({ status: "active", endsAtRenewal: true });
    expect(accountPlanOf(getAppData())?.id).toBe("s-demo");
    actions.keepPlan("s-demo");
    expect(sub().endsAtRenewal).toBe(false);
    actions.cancelPlan("s-demo");

    const renewsOn = sub().renewsOn;
    expect(actions.renewPlan("s-demo", pay(399))).toEqual({ error: "A month of Solo is GH₵ 400." });
    const renewed = actions.renewPlan("s-demo", pay(400));
    if ("error" in renewed) throw new Error(renewed.error);
    expect(sub()).toMatchObject({ periodStart: renewsOn, endsAtRenewal: false });
    expect(sub().payments).toHaveLength(2);
  });

  it("only touches the signed-in client's own plan", () => {
    const other = getAppData().subscriptions.find((s) => s.customerId !== "c-demo")!;
    actions.logIn(DEMO_ACCOUNT_PHONE);
    expect(actions.renewPlan(other.id, pay(400))).toEqual({ error: "We couldn't find that plan." });
    actions.cancelPlan(other.id);
    expect(getAppData().subscriptions.find((s) => s.id === other.id)?.endsAtRenewal).toBeFalsy();
  });
});
