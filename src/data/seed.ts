import { addDays, dayKey, localIso, startOfDay } from "../lib/format";
import { addMonth } from "../lib/plans";
import { orderNumber, receiptNumber } from "../lib/receipts";
import { addOpenHours } from "../lib/schedule";
import { defaultSettings, HOURS, type ShopSettings } from "./business";
import { defaultPlans, defaultServices } from "./catalog";
import { defaultExpenseCategories } from "./expenses";
import { createShopBook, windowAtOrAfter } from "./shop-seed";
import type { Appointment, ContactDetails, Customer, Expense, ExpenseCategory, ID, Order, OrderStatus, Payment, Plan, Review, Service, Subscription } from "./types";

export interface Counters {
  order: number;
  receipt: number;
}

/** What this phone remembers without an account. */
export interface DeviceState {
  /** Checkout details, kept only when the customer ticks "Remember me on this phone". */
  contact: ContactDetails | null;
  /** Orders placed or found on this phone. */
  orderIds: ID[];
  savedServiceIds: ID[];
}

export interface AppData {
  version: 1;
  seededAt: string;
  /** Every customer record the shop holds, guests included. */
  customers: Customer[];
  /**
   * The account signed in on this phone. Accounts are optional, so this starts empty.
   * `transient` sessions ("Remember me" unticked) end when the browser session does.
   */
  session: { customerId: ID | null; transient?: boolean };
  device: DeviceState;
  orders: Order[];
  appointments: Appointment[];
  reviews: Review[];
  /** The price list the owner edits in Services & prices. */
  services: Service[];
  /** Monthly plans, edited in Services & prices. */
  plans: Plan[];
  subscriptions: Subscription[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  /** Shop details, hours, policies, fees and rider zones, edited in Settings. */
  settings: ShopSettings;
  counters: Counters;
}

/** The sample account. Log in with its email and password (or its WhatsApp number, to find an order) to see order history. */
export const DEMO_ACCOUNT_PHONE = "024 555 0142";
export const DEMO_ACCOUNT_EMAIL = "akosua.boateng@gmail.com";
/** Demo-only password for the sample account, shown on the log in page so the demo can be tried. */
export const DEMO_ACCOUNT_PASSWORD = "Aromatic2026";
const CUSTOMER_ID = "c-demo";

/**
 * Sample data for the demo. Dates are relative to the moment the demo is first
 * opened so the app always looks current.
 */
export function createSeed(now: Date): AppData {
  const today = startOfDay(now);
  const day = (offset: number) => addDays(today, offset);
  const at = (offset: number, hour = 10, minute = 0) => {
    const d = day(offset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const iso = (offset: number, hour = 10, minute = 0) => at(offset, hour, minute).toISOString();
  const local = (offset: number, hour = 10, minute = 0) => localIso(at(offset, hour, minute));
  const history = (steps: [OrderStatus, number, number, number?][]) => steps.map(([status, offset, hour, minute]) => ({ status, at: iso(offset, hour, minute ?? 0) }));
  const pay = (offset: number, hour: number, amount: number, reference: string, online = false): Payment => ({
    id: "",
    amount,
    method: "momo",
    reference,
    at: iso(offset, hour, 20),
    receiptNo: "",
    kind: "full",
    receivedBy: online ? "Paystack (online)" : "Aromatic Laundry",
    payer: "MTN MoMo · 024 555 0142",
  });

  const customer: Customer = {
    id: CUSTOMER_ID,
    name: "Akosua Boateng",
    phone: "024 555 0142",
    email: "akosua.boateng@gmail.com",
    town: "Gbawe",
    address: "Gbawe Zero, off the Kasoa road, blue gate opposite the Total station",
    digitalAddress: "GS-0287-4410",
    memberSince: iso(-96),
    hasAccount: true,
    points: 180,
    source: "tiktok",
    care: { finish: "hang", starch: "light", scent: "signature", notes: "Wash the white school shirts separately. No starch on the children's things." },
    notes: "Found us from the palm oil video. Two children in school uniform, husband's work shirts on hangers. Rider: call when at the Total station, she walks out.",
  };

  // Joined the Solo plan in its first week, as one of the first ten subscribers.
  const joined = at(-5, 18, 40);
  const subscription: Subscription = {
    id: "s-demo",
    customerId: CUSTOMER_ID,
    planId: "plan-solo",
    startedAt: joined.toISOString(),
    periodStart: dayKey(joined),
    renewsOn: dayKey(addMonth(joined)),
    status: "active",
    payments: [{ ...pay(-5, 18, 400, "PSK-60218834", true), at: joined.toISOString() }],
  };

  // Today: a plan basket in the wash since this morning's pickup, back by tonight's delivery window.
  const pickedUp = at(0, 7);
  const ready = addOpenHours(pickedUp, 10, HOURS);
  const deliveryStart = windowAtOrAfter(new Date(ready.getTime() + 30 * 60_000));
  const nowMs = now.getTime();
  const step = (time: Date, status: OrderStatus) => (time.getTime() <= nowMs - 5 * 60_000 ? [{ status, at: time.toISOString() }] : []);
  const washingHistory = [
    { status: "booked" as const, at: iso(-1, 20, 15) },
    ...step(new Date(pickedUp.getTime() + 75 * 60_000), "received"),
    ...step(new Date(pickedUp.getTime() + 110 * 60_000), "washing"),
  ];
  const washingStatus = washingHistory[washingHistory.length - 1]!.status;

  const appointments: Appointment[] = [
    { id: "a-demo-1", customerId: CUSTOMER_ID, orderId: "o-demo-1", purpose: "pickup", start: localIso(pickedUp), minutes: 120, status: washingStatus === "booked" ? "confirmed" : "done" },
    { id: "a-demo-2", customerId: CUSTOMER_ID, orderId: "o-demo-1", purpose: "delivery", start: localIso(deliveryStart), minutes: 120, status: "confirmed" },
    { id: "a-demo-3", customerId: CUSTOMER_ID, orderId: "o-demo-3", purpose: "pickup", start: localIso(windowAtOrAfter(at(3, 7))), minutes: 120, status: "confirmed" },
  ];

  const orders: Order[] = [
    {
      id: "o-demo-1",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-1, 20, 15),
      items: [{ id: "i-d1", serviceId: "big-basket", qty: 1, unitPrice: 120 }],
      speed: "standard",
      care: { ...customer.care! },
      intake: "pickup",
      handback: "delivery",
      zoneId: "z-weija",
      inAt: localIso(pickedUp),
      readyAt: localIso(ready),
      pickupId: "a-demo-1",
      deliveryId: "a-demo-2",
      checkIn: washingStatus === "booked" ? undefined : { count: 26, notes: "Collar ring on two white shirts, pre-treated", at: new Date(pickedUp.getTime() + 75 * 60_000).toISOString() },
      status: washingStatus,
      history: washingHistory,
      total: 0,
      riderFee: 0,
      expressFee: 0,
      planCover: 120,
      discount: 0,
      payChoice: "plan",
      subscriptionId: "s-demo",
      payments: [],
      lastUpdateAt: washingHistory[washingHistory.length - 1]!.at,
    },
    {
      id: "o-demo-2",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-1, 9, 30),
      items: [
        { id: "i-d2", serviceId: "suit", qty: 1, unitPrice: 60, note: "Husband's charcoal suit" },
        { id: "i-d3", serviceId: "iron-shirt", qty: 5, unitPrice: 5 },
      ],
      speed: "standard",
      care: { ...customer.care! },
      intake: "dropoff",
      handback: "collect",
      inAt: local(-1, 9, 30),
      readyAt: local(1, 9, 30),
      checkIn: { count: 7, at: iso(-1, 9, 35) },
      status: "ready",
      history: history([["booked", -1, 9, 30], ["received", -1, 9, 35], ["washing", -1, 11], ["finishing", -1, 15], ["ready", -1, 18, 10]]),
      total: 85,
      riderFee: 0,
      expressFee: 0,
      planCover: 0,
      discount: 0,
      payChoice: "later",
      payments: [],
      lastUpdateAt: iso(-1, 18, 15),
    },
    {
      id: "o-demo-3",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(0, 7, 5),
      items: [{ id: "i-d4", serviceId: "medium-basket", qty: 1, unitPrice: 80 }],
      speed: "standard",
      care: { ...customer.care! },
      intake: "pickup",
      handback: "delivery",
      zoneId: "z-weija",
      inAt: localIso(windowAtOrAfter(at(3, 7))),
      readyAt: localIso(addOpenHours(windowAtOrAfter(at(3, 7)), 24, HOURS)),
      pickupId: "a-demo-3",
      status: "booked",
      history: [{ status: "booked", at: iso(0, 7, 5) }],
      total: 0,
      riderFee: 0,
      expressFee: 0,
      planCover: 80,
      discount: 0,
      payChoice: "plan",
      subscriptionId: "s-demo",
      payments: [],
    },
    {
      id: "o-demo-4",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-12, 8, 10),
      items: [
        { id: "i-d5", serviceId: "big-basket", qty: 1, unitPrice: 120 },
        { id: "i-d6", serviceId: "stain", qty: 2, unitPrice: 15, note: "Palm oil on the white school shirts" },
      ],
      speed: "standard",
      care: { ...customer.care! },
      intake: "pickup",
      handback: "delivery",
      zoneId: "z-weija",
      inAt: local(-12, 9),
      readyAt: local(-11, 10),
      checkIn: { count: 31, notes: "Palm oil on two white shirts, treated", at: iso(-12, 10, 5) },
      status: "done",
      history: history([["booked", -12, 8, 10], ["received", -12, 10, 5], ["washing", -12, 11], ["finishing", -12, 15], ["ready", -12, 18], ["out", -11, 9, 10], ["done", -11, 10, 5]]),
      total: 180,
      riderFee: 30,
      expressFee: 0,
      planCover: 0,
      discount: 0,
      payChoice: "now",
      payments: [pay(-12, 8, 180, "PSK-58112093", true)],
    },
    {
      id: "o-demo-5",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-33, 17, 40),
      items: [{ id: "i-d7", serviceId: "medium-basket", qty: 1, unitPrice: 80 }],
      speed: "express",
      care: { ...customer.care! },
      intake: "dropoff",
      handback: "collect",
      inAt: local(-33, 17, 40),
      readyAt: local(-33, 20, 40),
      checkIn: { count: 14, at: iso(-33, 17, 45) },
      status: "done",
      history: history([["booked", -33, 17, 40], ["received", -33, 17, 45], ["washing", -33, 17, 55], ["finishing", -33, 19, 10], ["ready", -33, 20, 20], ["done", -33, 20, 35]]),
      total: 130,
      riderFee: 0,
      expressFee: 50,
      planCover: 0,
      discount: 0,
      payChoice: "later",
      payments: [pay(-33, 20, 130, "MTN 51002377")],
    },
    {
      id: "o-demo-6",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-94, 11),
      items: [
        { id: "i-d8", serviceId: "duvet", qty: 1, unitPrice: 70 },
        { id: "i-d9", serviceId: "curtains", qty: 4, unitPrice: 25 },
      ],
      speed: "standard",
      care: { finish: "fold", starch: "none", scent: "signature" },
      intake: "dropoff",
      handback: "collect",
      inAt: local(-94, 11),
      readyAt: local(-92, 11),
      checkIn: { count: 5, at: iso(-94, 11, 5) },
      status: "done",
      history: history([["booked", -94, 11], ["received", -94, 11, 5], ["washing", -94, 12], ["finishing", -93, 10], ["ready", -92, 9], ["done", -91, 16]]),
      total: 170,
      riderFee: 0,
      expressFee: 0,
      planCover: 0,
      discount: 0,
      payChoice: "later",
      payments: [pay(-91, 16, 170, "MTN 48902211")],
    },
    {
      id: "o-demo-7",
      number: "",
      customerId: CUSTOMER_ID,
      createdAt: iso(-60, 19),
      items: [{ id: "i-d10", serviceId: "small-basket", qty: 1, unitPrice: 50 }],
      speed: "standard",
      care: { ...customer.care! },
      intake: "pickup",
      handback: "delivery",
      zoneId: "z-weija",
      inAt: local(-59, 9),
      readyAt: local(-58, 9),
      status: "cancelled",
      history: history([["booked", -60, 19], ["cancelled", -60, 21]]),
      total: 80,
      riderFee: 30,
      expressFee: 0,
      planCover: 0,
      discount: 0,
      payChoice: "later",
      payments: [],
    },
  ];

  const reviews: Review[] = [
    { id: "r1", name: "Ama K.", rating: 5, text: "The last time I sent my clothes, I spent hours smelling them. They smelt so good! And they were washed so fast: within hours I was called to pick up.", at: iso(-4, 20), serviceId: "medium-basket", status: "published" },
    { id: "r2", name: "Kofi A.", rating: 5, text: "Thank you for your service. All my clothes look great again. You are new but I love your service, and I recommend you to everyone.", at: iso(-9, 12), serviceId: "big-basket", status: "published", reply: "Thank you Kofi. See you next week!" },
    { id: "r3", name: "Dela K.", rating: 5, text: "A palm oil stain on my white blouse that I had given up on. Gone. They showed me the pre-treatment before the wash.", at: iso(-17, 15), serviceId: "stain", status: "published" },
    { id: "r4", name: "Nana Y.", rating: 5, text: "Dropped my kente and my husband's suit while shopping at the mall, collected them pressed and covered. So far so good.", at: iso(-26, 18), serviceId: "kente", status: "published" },
    { id: "r5", name: "Akosua B.", rating: 4, text: "Rider came in the window they promised and called from the junction. Clothes back the next evening, folded perfectly.", at: iso(-31, 9), serviceId: "big-basket", customerId: CUSTOMER_ID, status: "published" },
  ];

  const book = createShopBook(now);

  // Number every order and receipt in the order they happened, across the sample account and the shop's book.
  const allOrders = [...orders, ...book.orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstOrder = 1001;
  const numbered = allOrders.map((o, i) => ({ ...o, number: orderNumber(firstOrder + i) }));
  const subscriptions = [subscription, ...book.subscriptions];
  const payments = [...numbered.flatMap((o) => o.payments), ...subscriptions.flatMap((s) => s.payments)].sort((a, b) => a.at.localeCompare(b.at));
  const receiptIndex = new Map(payments.map((p, i) => [p, i + 1]));
  const stamp = (p: Payment) => {
    const seq = receiptIndex.get(p) ?? 0;
    return { ...p, id: `p-${seq}`, receiptNo: receiptNumber(new Date(p.at).getFullYear(), seq) };
  };

  return {
    version: 1,
    seededAt: now.toISOString(),
    services: defaultServices(),
    plans: defaultPlans(),
    settings: defaultSettings(),
    customers: [customer, ...book.customers],
    session: { customerId: null },
    device: { contact: null, orderIds: [], savedServiceIds: [] },
    orders: numbered.map((o) => ({ ...o, payments: o.payments.map(stamp) })).reverse(),
    appointments: [...appointments, ...book.appointments],
    reviews: [...reviews, ...book.reviews].sort((a, b) => b.at.localeCompare(a.at)),
    subscriptions: subscriptions.map((s) => ({ ...s, payments: s.payments.map(stamp) })),
    expenses: book.expenses.sort((a, b) => b.on.localeCompare(a.on)),
    expenseCategories: defaultExpenseCategories(),
    counters: { order: firstOrder + allOrders.length, receipt: payments.length },
  };
}
