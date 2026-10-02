import { describe, expect, it } from "vitest";
import { serviceById } from "../data/catalog";
import type { Order, Service, Subscription } from "../data/types";
import { formatGhPhone, googleCalendarLink, icsFile, normalizeGhPhone, whatsappLink } from "./contact";
import { dayKey, fmtDay, money, parseLocal, relativeDay } from "./format";
import { basketCount, itemSummary, orderTitle, serviceLine, servicePrice, unitCount } from "./items";
import { badgeFor, balanceDue, canCancel, isLate, nextAction, stagesFor, titleFor, validatePayment } from "./orders";
import { addMonth, basketsUsed, planStatus, renewalDue, renewedPeriod } from "./plans";
import { canExpress, defaultQty, estimate, riderTrips, turnaroundHours, unitPrice } from "./pricing";
import { amountInWords, numberToWords, orderNumber, receiptNumber, verifyCode } from "./receipts";
import { addOpenHours, openStatus, readyTime, riderWindows, slotsFor, type Hours } from "./schedule";

const HOURS: Hours = { 0: ["07:00", "21:00"], 1: ["07:00", "21:00"], 2: ["07:00", "21:00"], 3: ["07:00", "21:00"], 4: ["07:00", "21:00"], 5: ["07:00", "21:00"], 6: ["07:00", "21:00"] };
const SHORT_WEEK: Hours = { ...HOURS, 0: null };
const RULES = { expressFee: 50, expressHours: 3 };

const service = (id: string): Service => {
  const found = serviceById(id);
  if (!found) throw new Error(`no service ${id}`);
  return found;
};
const line = (serviceId: string, qty = 1) => ({ serviceId, qty, unitPrice: unitPrice(service(serviceId)) });

const base: Order = {
  id: "o1", number: "AL-1041", customerId: "c1", createdAt: "2026-09-14T08:00:00.000Z",
  items: [{ id: "i1", serviceId: "medium-basket", qty: 2, unitPrice: 80 }],
  speed: "standard", care: { finish: "fold", starch: "none", scent: "signature" },
  intake: "dropoff", handback: "collect", inAt: "2026-09-14T09:00", readyAt: "2026-09-15T09:00",
  status: "washing", history: [{ status: "booked", at: "2026-09-14T08:00:00.000Z" }],
  total: 160, riderFee: 0, expressFee: 0, planCover: 0, discount: 0, payChoice: "later", payments: [],
};
const paid = (amount: number) => ({ id: `p${amount}`, amount, method: "cash" as const, reference: "", at: "", receiptNo: "", kind: "part" as const, receivedBy: "" });

describe("format", () => {
  it("formats cedis with grouping and optional pesewas", () => {
    expect(money(1500)).toBe("GH₵ 1,500");
    expect(money(12.5)).toBe("GH₵ 12.50");
    expect(money(-40)).toBe("-GH₵ 40");
  });

  it("round-trips local day keys and describes nearby days", () => {
    expect(dayKey(parseLocal("2026-09-15"))).toBe("2026-09-15");
    expect(fmtDay(parseLocal("2026-09-15"))).toBe("Tue, 15 Sept 2026");
    const now = parseLocal("2026-09-14T21:00");
    expect(relativeDay(parseLocal("2026-09-15"), now)).toBe("Tomorrow");
    expect(relativeDay(parseLocal("2026-09-14"), now)).toBe("Today");
  });
});

describe("pricing", () => {
  it("prices baskets and items off the list, and leaves quoted garments for the counter", () => {
    expect(unitPrice(service("big-basket"))).toBe(120);
    expect(unitPrice(service("gown"))).toBe(0);
    expect(defaultQty(service("curtains"))).toBe(2);
    expect(defaultQty(service("iron-shirt"))).toBe(1);
  });

  it("counts a rider trip each way", () => {
    expect(riderTrips("pickup", "delivery")).toBe(2);
    expect(riderTrips("dropoff", "delivery")).toBe(1);
    expect(riderTrips("dropoff", "collect")).toBe(0);
  });

  it("adds express once per order and the rider fee per trip", () => {
    const quote = estimate([line("big-basket")], { speed: "express", trips: 2, zoneFee: 15 }, RULES);
    expect(quote).toMatchObject({ subtotal: 120, expressFee: 50, riderFee: 30, total: 200, hasQuoted: false });
    expect(estimate([line("big-basket"), line("iron-shirt", 5)], { speed: "express", trips: 0, zoneFee: 0 }, RULES).expressFee).toBe(50);
  });

  it("lets the plan cover the dearest baskets first and waives the rider", () => {
    const quote = estimate([line("small-basket"), line("big-basket"), line("iron-shirt", 4)], { speed: "standard", trips: 2, zoneFee: 20, planBasketsLeft: 1 }, RULES);
    expect(quote).toMatchObject({ subtotal: 190, planCover: 120, planBaskets: 1, riderFee: 0, total: 70 });
  });

  it("never covers more baskets than the plan has left", () => {
    expect(estimate([line("medium-basket", 3)], { speed: "standard", trips: 0, zoneFee: 0, planBasketsLeft: 2 }, RULES)).toMatchObject({ planCover: 160, planBaskets: 2, total: 80 });
    expect(estimate([line("medium-basket")], { speed: "standard", trips: 0, zoneFee: 0, planBasketsLeft: 0 }, RULES).planCover).toBe(0);
  });

  it("flags orders waiting on a counter price", () => {
    expect(estimate([line("gown"), line("suit")], { speed: "standard", trips: 0, zoneFee: 0 }, RULES)).toMatchObject({ subtotal: 60, hasQuoted: true });
  });

  it("only offers express when every item can go through in three hours, and takes the longest turnaround", () => {
    expect(canExpress([{ serviceId: "big-basket" }, { serviceId: "iron-shirt" }])).toBe(true);
    expect(canExpress([{ serviceId: "big-basket" }, { serviceId: "suit" }])).toBe(false);
    expect(canExpress([])).toBe(false);
    expect(turnaroundHours([{ serviceId: "big-basket" }, { serviceId: "kente" }])).toBe(72);
    expect(turnaroundHours([{ serviceId: "iron-shirt" }])).toBe(24);
  });
});

describe("items", () => {
  it("describes lines and orders", () => {
    expect(itemSummary({ note: "Two white shirts" }, service("big-basket"))).toBe("About 20–35 clothes · Two white shirts");
    expect(itemSummary({}, service("gown"))).toBe("Priced at the counter");
    expect(itemSummary({}, service("iron-shirt"))).toBe("Per shirt");
    expect(orderTitle(base)).toBe("Medium basket × 2");
    expect(orderTitle({ items: [...base.items, { serviceId: "duvet", qty: 1 }] })).toBe("Medium basket × 2 + 1 more");
  });

  it("counts units and baskets", () => {
    expect(unitCount({ qty: 5 }, service("iron-shirt"))).toBe("5 shirts");
    expect(unitCount({ qty: 2 }, service("towels"))).toBe("2 bundles of 4");
    expect(unitCount({ qty: 1 }, service("suit"))).toBe("1 suit");
    expect(basketCount({ items: [{ serviceId: "big-basket", qty: 1 }, { serviceId: "small-basket", qty: 2 }, { serviceId: "duvet", qty: 1 }] })).toBe(3);
  });

  it("writes the service line and price", () => {
    expect(serviceLine(service("small-basket"))).toBe("About 6–8 clothes · ready in 24 hours");
    expect(serviceLine(service("kente"))).toBe("Per cloth · ready in 3 days");
    expect(servicePrice(service("gown"))).toBe("Priced at the counter");
    expect(servicePrice(service("duvet"))).toBe("GH₵ 70");
  });
});

describe("schedule", () => {
  it("says when the counter opens and closes", () => {
    expect(openStatus(parseLocal("2026-09-14T10:00"), HOURS)).toEqual({ open: true, label: "Open · closes at 21:00" });
    expect(openStatus(parseLocal("2026-09-14T21:30"), HOURS)).toEqual({ open: false, label: "Closed · opens tomorrow at 07:00" });
    expect(openStatus(parseLocal("2026-09-12T22:00"), SHORT_WEEK).label).toBe("Closed · opens on Monday at 07:00");
  });

  it("counts express hours only while the counter is open", () => {
    expect(addOpenHours(parseLocal("2026-09-14T10:00"), 3, HOURS)).toEqual(parseLocal("2026-09-14T13:00"));
    expect(addOpenHours(parseLocal("2026-09-14T20:00"), 3, HOURS)).toEqual(parseLocal("2026-09-15T09:00"));
    expect(addOpenHours(parseLocal("2026-09-14T22:30"), 3, HOURS)).toEqual(parseLocal("2026-09-15T10:00"));
  });

  it("makes a standard wash ready the same time next day, moved past closing to the next opening", () => {
    expect(readyTime(parseLocal("2026-09-14T09:00"), 24, false, 3, HOURS)).toEqual(parseLocal("2026-09-15T09:00"));
    expect(readyTime(parseLocal("2026-09-12T10:00"), 24, false, 3, SHORT_WEEK)).toEqual(parseLocal("2026-09-14T07:00"));
    expect(readyTime(parseLocal("2026-09-14T15:00"), 24, true, 3, HOURS)).toEqual(parseLocal("2026-09-14T18:00"));
  });

  it("offers half-hour drop-off times with an hour's notice", () => {
    const slots = slotsFor(parseLocal("2026-09-14"), HOURS, ["2026-09-14T12:00"], parseLocal("2026-09-14T10:10"));
    expect(slots[0]?.time).toBe("07:00");
    expect(slots.at(-1)?.time).toBe("20:30");
    expect(slots.find((s) => s.time === "11:00")?.available).toBe(false);
    expect(slots.find((s) => s.time === "11:30")?.available).toBe(true);
    expect(slots.find((s) => s.time === "12:00")?.available).toBe(false);
    expect(slotsFor(parseLocal("2026-09-13"), SHORT_WEEK, [], parseLocal("2026-09-12T10:00"))).toEqual([]);
  });

  it("closes rider windows that are too soon, full, or before the laundry is ready", () => {
    const day = parseLocal("2026-09-15");
    const now = parseLocal("2026-09-15T08:30");
    const full = Array(3).fill("2026-09-15T13:00");
    const windows = riderWindows(day, HOURS, [...full, "2026-09-15T15:00"], now, { notBefore: parseLocal("2026-09-15T11:00") });
    expect(windows.map((w) => w.label)).toEqual(["07:00 – 09:00", "09:00 – 11:00", "11:00 – 13:00", "13:00 – 15:00", "15:00 – 17:00", "17:00 – 19:00", "19:00 – 21:00"]);
    expect(windows.map((w) => w.available)).toEqual([false, false, true, false, true, true, true]);
    expect(windows.find((w) => w.label.startsWith("15:00"))?.left).toBe(2);
  });
});

describe("orders", () => {
  const now = parseLocal("2026-09-14T12:00");

  it("skips the delivery stage for orders collected at the counter", () => {
    expect(stagesFor({ handback: "collect" })).not.toContain("out");
    expect(stagesFor({ handback: "delivery" })).toContain("out");
  });

  it("flags laundry still in the shop after the promised time", () => {
    expect(isLate(base, parseLocal("2026-09-15T09:30"))).toBe(true);
    expect(isLate({ ...base, status: "ready" }, parseLocal("2026-09-15T09:30"))).toBe(false);
    expect(badgeFor(base, parseLocal("2026-09-15T09:30"))).toEqual({ label: "Running late", tone: "sand" });
    expect(badgeFor(base, now)).toEqual({ label: "Washing", tone: "sky" });
  });

  it("titles orders by where they are", () => {
    expect(titleFor(base, now)).toBe("Ready tomorrow at 09:00");
    expect(titleFor({ ...base, status: "booked", inAt: "2026-09-14T16:30" }, now)).toBe("Drop off today at 16:30");
    expect(titleFor({ ...base, status: "ready", handback: "delivery" }, now)).toBe("Ready for delivery");
  });

  it("shows the count from the counter once the bag is checked in", () => {
    const received: Order = { ...base, status: "received", checkIn: { count: 14, notes: "Missing button on the blue shirt", at: "2026-09-14T09:05" } };
    expect(nextAction(received, now)).toMatchObject({ title: "We counted 14 pieces", body: "Noted at the counter: Missing button on the blue shirt" });
  });

  it("asks for what's owed, only while there's a balance", () => {
    expect(nextAction(base, now)?.cta?.kind).toBe("pay");
    expect(nextAction({ ...base, payments: [paid(160)] }, now)).toBeNull();
    expect(balanceDue({ ...base, payments: [paid(100)] })).toBe(60);
    expect(validatePayment(base, 200)).toBe("That's more than the GH₵ 160 balance.");
    expect(validatePayment(base, 0)).toBe("Enter an amount above zero.");
    expect(validatePayment({ ...base, status: "cancelled" }, 10)).toMatch(/cancelled/);
    expect(validatePayment(base, 160)).toBeNull();
  });

  it("lets clients cancel only before the laundry reaches the counter", () => {
    expect(canCancel({ status: "booked" })).toBe(true);
    expect(canCancel({ status: "received" })).toBe(false);
  });
});

describe("plans", () => {
  const sub: Subscription = { id: "s1", customerId: "c1", planId: "plan-solo", startedAt: "2026-09-01T10:00:00.000Z", periodStart: "2026-09-01", renewsOn: "2026-10-01", status: "active", payments: [] };
  const planOrder = (createdAt: string, qty: number, status: Order["status"] = "done"): Order => ({
    ...base, id: createdAt, createdAt, status, subscriptionId: "s1", items: [{ id: "i", serviceId: "big-basket", qty, unitPrice: 120 }, { id: "j", serviceId: "iron-shirt", qty: 3, unitPrice: 5 }],
  });

  it("adds a month and holds to the month's last day", () => {
    expect(dayKey(addMonth(parseLocal("2026-01-31")))).toBe("2026-02-28");
    expect(dayKey(addMonth(parseLocal("2026-09-14")))).toBe("2026-10-14");
  });

  it("counts baskets used this month, leaving out cancelled orders and other months", () => {
    const orders = [planOrder("2026-09-03T10:00:00", 1), planOrder("2026-09-10T10:00:00", 2), planOrder("2026-09-11T10:00:00", 1, "cancelled"), planOrder("2026-08-20T10:00:00", 1)];
    expect(basketsUsed(sub, orders)).toBe(3);
    const status = planStatus(sub, orders, parseLocal("2026-09-28T10:00"));
    expect(status).toMatchObject({ used: 3, left: 1, renewsIn: 3, lapsed: false });
    expect(status.plan?.baskets).toBe(4);
  });

  it("has nothing left once the month runs out unpaid", () => {
    expect(planStatus(sub, [], parseLocal("2026-10-02T10:00"))).toMatchObject({ left: 0, lapsed: true });
  });

  it("renews from where the month ended, or from today after a long gap", () => {
    expect(renewedPeriod(sub, parseLocal("2026-10-03T10:00"))).toEqual({ periodStart: "2026-10-01", renewsOn: "2026-11-01" });
    expect(renewedPeriod(sub, parseLocal("2026-11-20T10:00"))).toEqual({ periodStart: "2026-11-20", renewsOn: "2026-12-20" });
  });

  it("reminds about renewals three days out, but not for plans already cancelled", () => {
    expect(renewalDue(sub, parseLocal("2026-09-28T10:00"))).toBe(true);
    expect(renewalDue(sub, parseLocal("2026-09-20T10:00"))).toBe(false);
    expect(renewalDue({ ...sub, endsAtRenewal: true }, parseLocal("2026-09-28T10:00"))).toBe(false);
  });
});

describe("receipts", () => {
  it("numbers receipts and orders", () => {
    expect(receiptNumber(2026, 42)).toBe("ALR-2026-0042");
    expect(orderNumber(1041)).toBe("AL-1041");
  });

  it("writes amounts in words, British style", () => {
    expect(numberToWords(0)).toBe("zero");
    expect(numberToWords(105)).toBe("one hundred and five");
    expect(numberToWords(2015)).toBe("two thousand and fifteen");
    expect(amountInWords(750)).toBe("Seven hundred and fifty Ghana cedis only");
    expect(amountInWords(1)).toBe("One Ghana cedi only");
    expect(amountInWords(12.5)).toBe("Twelve Ghana cedis and fifty pesewas only");
  });

  it("produces a stable verification code that changes with the amount", () => {
    expect(verifyCode("ALR-2026-0042", 750)).toBe(verifyCode("ALR-2026-0042", 750));
    expect(verifyCode("ALR-2026-0042", 750)).not.toBe(verifyCode("ALR-2026-0042", 751));
    expect(verifyCode("ALR-2026-0042", 750)).toMatch(/^[0-9A-F]{6}$/);
  });
});

describe("contact", () => {
  it("normalises Ghanaian phone numbers", () => {
    expect(normalizeGhPhone("054 890 8101")).toBe("233548908101");
    expect(normalizeGhPhone("+233 54 890 8101")).toBe("233548908101");
    expect(normalizeGhPhone("548908101")).toBe("233548908101");
    expect(normalizeGhPhone("12345")).toBeNull();
    expect(formatGhPhone("233548908101")).toBe("054 890 8101");
  });

  it("builds WhatsApp and calendar links", () => {
    expect(whatsappLink("0548908101", "Hi there")).toBe("https://wa.me/233548908101?text=Hi%20there");
    const event = { title: "Rider pickup", start: parseLocal("2026-09-17T09:00"), minutes: 120, location: "Gbawe", details: "AL-1041" };
    expect(googleCalendarLink(event)).toContain("dates=20260917T090000%2F20260917T110000");
    const ics = icsFile(event, "al-1", parseLocal("2026-09-14T09:00"));
    expect(ics).toContain("DTSTART;TZID=Africa/Accra:20260917T090000");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
