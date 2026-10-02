import { useSyncExternalStore } from "react";
import { checkCode, CODE_TTL_MS, findOrder, paymentKindFor, paystackReference, samePhone, upsertCustomer, type Access, type CodeCheck, type PendingCode } from "../lib/checkout";
import { dayKey, localIso, money, parseLocal } from "../lib/format";
import { orderNumber, receiptNumber } from "../lib/receipts";
import { normalizeGhPhone } from "../lib/contact";
import { balanceDue, canCancel, isActive, validatePayment } from "../lib/orders";
import { activeSubscription, addMonth, planStatus, renewedPeriod } from "../lib/plans";
import { readyTime, RIDER_CAPACITY, RIDER_NOTICE_MS } from "../lib/schedule";
import { turnaroundHours } from "../lib/pricing";
import { validateExpense } from "../lib/spend";
import { applySettings, cloneSettings, defaultSettings, HOURS, RULES, type ShopSettings } from "./business";
import { applyPlans, applyServices, defaultPlans, defaultServices } from "./catalog";
import { applyExpenseCategories } from "./expenses";
import { createSeed, type AppData } from "./seed";
import type {
  Appointment,
  CarePrefs,
  CheckIn,
  ContactDetails,
  Customer,
  Expense,
  Handback,
  Intake,
  LeadSource,
  Order,
  OrderItem,
  OrderStatus,
  PayChoice,
  Payment,
  PaymentMethod,
  Plan,
  ReviewStatus,
  Service,
  Speed,
  Subscription,
  Zone,
} from "./types";

const KEY = "al-demo-v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === 1) return withSession(withDefaultPhotos(parsed));
    }
  } catch (error) {
    console.warn("Could not read saved demo data, starting fresh.", error);
  }
  return createSeed(new Date());
}

/** Marks the browser session a "don't remember me" sign-in belongs to. */
const LIVE_SESSION_KEY = "al-session-live";

/** A sign-in without "Remember me" ends once the browser session that made it is gone. */
function withSession(data: AppData): AppData {
  if (!data.session.transient) return data;
  let live = false;
  try {
    live = sessionStorage.getItem(LIVE_SESSION_KEY) === data.session.customerId;
  } catch {
    live = false;
  }
  return live ? data : { ...data, session: { customerId: null } };
}

function markLiveSession(customerId: string | null) {
  try {
    if (customerId) sessionStorage.setItem(LIVE_SESSION_KEY, customerId);
    else sessionStorage.removeItem(LIVE_SESSION_KEY);
  } catch {
    /* no sessionStorage (private mode or tests): the session simply isn't carried over */
  }
}

/** Photos aren't editable, so a saved price list picks up photos added to the defaults later. */
function withDefaultPhotos(data: AppData): AppData {
  const photos = new Map(defaultServices().map((s) => [s.id, s.photo]));
  return { ...data, services: data.services.map((s) => (s.photo || !photos.get(s.id) ? s : { ...s, photo: photos.get(s.id) })) };
}

/** Copies the saved price list, plans and shop details into the objects every screen reads. */
function publish(data: AppData) {
  applyServices(data.services);
  applyPlans(data.plans);
  applySettings(data.settings);
  applyExpenseCategories(data.expenseCategories);
}

let state: AppData = load();
publish(state);
const listeners = new Set<() => void>();
const saveFailedListeners = new Set<() => void>();

/** Called when a change couldn't be written to this browser (storage full or blocked), so the screen can say so. */
export function onSaveFailed(listener: () => void) {
  saveFailedListeners.add(listener);
  return () => {
    saveFailedListeners.delete(listener);
  };
}

function commit(next: AppData) {
  state = next;
  publish(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Could not save demo data.", error);
    saveFailedListeners.forEach((listener) => listener());
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getAppData(): AppData {
  return state;
}

/* ---------------- Selectors ---------------- */

export const accessOf = (data: AppData): Access => ({ customerId: data.session.customerId, deviceOrderIds: data.device.orderIds });

/** The signed-in account, or null for guests. */
export const accountOf = (data: AppData): Customer | null => data.customers.find((c) => c.id === data.session.customerId && c.hasAccount) ?? null;

export const customerById = (data: AppData, id: string): Customer | undefined => data.customers.find((c) => c.id === id);

/** The signed-in client's running plan, if they have one. */
export const accountPlanOf = (data: AppData, now = new Date()): Subscription | undefined => activeSubscription(data.subscriptions, data.session.customerId, now);

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/* ---------------- Payments ---------------- */

export interface OnlinePayment {
  amount: number;
  method: "momo" | "card";
  payer: string;
}

/** Builds a verified Paystack payment. In the live app this only happens after the server confirms the charge with Paystack. */
function paymentFor(data: AppData, order: Order, pay: OnlinePayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(order, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: paystackReference(order.number, randomToken(6)),
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(order, pay.amount),
      receivedBy: "Paystack (online)",
      payer: pay.payer,
    },
  };
}

const withPayment = (order: Order, payment: Payment): Order => ({ ...order, payments: [...order.payments, payment] });

/* ---------------- Rider windows ---------------- */

/**
 * Re-checks a rider window when the booking lands. The screen that offered it may have been open
 * for hours, or open on two phones at once, so the store is the one that says no.
 */
function windowProblem(data: AppData, start: string, purpose: "pickup" | "delivery", now: Date, notice = true): string | null {
  if (notice && parseLocal(start).getTime() < now.getTime() + RIDER_NOTICE_MS) return `That ${purpose} window is too soon now. Pick a later one.`;
  const taken = data.appointments.filter((a) => a.start === start && a.status !== "cancelled" && a.status !== "done").length;
  return taken >= RIDER_CAPACITY ? `That ${purpose} window just filled up. Pick another.` : null;
}

/** A cancelled order frees every rider run it still holds, including one already under way. */
const releaseWindows = (appointments: Appointment[], orderId: string) =>
  appointments.map((a) => (a.orderId === orderId && a.status !== "done" && a.status !== "cancelled" ? { ...a, status: "cancelled" as const } : a));

/* ---------------- One-time codes (demo: shown as a notification instead of a WhatsApp message) ---------------- */

let pendingCode: PendingCode | null = null;

/* ---------------- Actions ---------------- */

export interface OrderDraft {
  items: Omit<OrderItem, "id">[];
  speed: Speed;
  care: CarePrefs;
  intake: Intake;
  handback: Handback;
  zoneId?: string;
  /** Drop-off time, or the start of the pickup window. */
  inAt: string;
  readyAt: string;
  /** Start of the delivery window, when the rider brings it back. */
  deliveryStart?: string;
  comments?: string;
  /** Keep these care choices on the account for next time. */
  saveCare: boolean;
  contact: ContactDetails;
  remember: boolean;
  payChoice: PayChoice;
  total: number;
  riderFee: number;
  expressFee: number;
  planCover: number;
  discount: number;
  /** Present when the order was paid at checkout. */
  payment?: OnlinePayment;
}

export const actions = {
  /** Creates (or updates) the customer, the order, the rider's windows and, if paid, the receipt, all in one step. */
  placeOrder(draft: OrderDraft, now = new Date()): { order: Order; payment?: Payment } | { error: string } {
    const items = draft.items.filter((i) => i.qty > 0);
    if (!items.length) return { error: "Add at least one service." };
    if (draft.intake === "pickup") {
      const problem = windowProblem(state, draft.inAt, "pickup", now);
      if (problem) return { error: problem };
    } else if (parseLocal(draft.inAt) < now) {
      return { error: "That drop-off time has passed. Pick a later one." };
    }
    if (draft.handback === "delivery" && draft.deliveryStart) {
      if (draft.deliveryStart < draft.readyAt) return { error: "That delivery window is before your laundry is ready. Pick a later one." };
      const problem = windowProblem(state, draft.deliveryStart, "delivery", now);
      if (problem) return { error: problem };
    }
    const { customers: upserted, customer: base } = upsertCustomer(state.customers, draft.contact, { customerId: state.session.customerId, now, newId: () => newId("c") });
    // Points pay for the discount: 10 points take GH₵ 1 off, so they're spent once.
    const pointsSpent = Math.round(Math.max(0, draft.discount) * 10);
    if (pointsSpent > 0 && (!state.session.customerId || pointsSpent > base.points)) return { error: "You don't have enough points for that discount." };
    const customer = { ...base, points: base.points - pointsSpent, ...(draft.saveCare ? { care: { ...draft.care } } : {}) };
    const customers = upserted.map((c) => (c.id === customer.id ? customer : c));

    let subscriptionId: string | undefined;
    if (draft.payChoice === "plan") {
      const subscription = activeSubscription(state.subscriptions, customer.id, now);
      if (!subscription) return { error: "Your plan isn't active. Renew it, or pay for this one." };
      if (planStatus(subscription, state.orders, now).left <= 0) return { error: "You've used this month's basket washes. Pay for this one, or renew early." };
      subscriptionId = subscription.id;
    }

    const orderId = newId("o");
    const pickupId = draft.intake === "pickup" ? newId("a") : undefined;
    const deliveryId = draft.handback === "delivery" && draft.deliveryStart ? newId("a") : undefined;
    const createdAt = now.toISOString();

    let order: Order = {
      id: orderId,
      number: orderNumber(state.counters.order),
      customerId: customer.id,
      createdAt,
      items: items.map((item) => ({ ...item, id: newId("i") })),
      speed: draft.speed,
      care: { ...draft.care, notes: draft.care.notes?.trim() || undefined },
      intake: draft.intake,
      handback: draft.handback,
      zoneId: draft.intake === "pickup" || draft.handback === "delivery" ? draft.zoneId : undefined,
      inAt: draft.inAt,
      readyAt: draft.readyAt,
      pickupId,
      deliveryId,
      comments: draft.comments?.trim() || undefined,
      status: "booked",
      history: [{ status: "booked", at: createdAt }],
      total: draft.total,
      riderFee: draft.riderFee,
      expressFee: draft.expressFee,
      planCover: subscriptionId ? draft.planCover : 0,
      discount: draft.discount,
      payChoice: draft.payChoice,
      subscriptionId,
      payments: [],
    };

    let receiptCounter = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.payment && draft.payment.amount > 0) {
      const result = paymentFor(state, order, draft.payment, now);
      if ("error" in result) return { error: result.error };
      payment = result.payment;
      receiptCounter = result.receiptCounter;
      order = withPayment(order, payment);
    }

    const newAppointments: Appointment[] = [];
    if (pickupId) newAppointments.push({ id: pickupId, customerId: customer.id, orderId, purpose: "pickup", start: draft.inAt, minutes: 120, status: "requested" });
    if (deliveryId && draft.deliveryStart) newAppointments.push({ id: deliveryId, customerId: customer.id, orderId, purpose: "delivery", start: draft.deliveryStart, minutes: 120, status: "requested" });

    commit({
      ...state,
      customers,
      orders: [order, ...state.orders],
      appointments: [...newAppointments, ...state.appointments],
      // Guests keep the order on this phone. Account orders live in the account, so logging out hides them.
      device: state.session.customerId
        ? state.device
        : { ...state.device, contact: draft.remember ? draft.contact : null, orderIds: [orderId, ...state.device.orderIds] },
      counters: { order: state.counters.order + 1, receipt: receiptCounter },
    });
    return { order, payment };
  },

  /** Pays what's left on an existing order. */
  payOrder(orderId: string, pay: OnlinePayment, now = new Date()): { payment: Payment } | { error: string } {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { error: "We couldn't find that order." };
    const result = paymentFor(state, order, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? withPayment(o, result.payment) : o)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  cancelOrder(orderId: string, now = new Date()) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || !canCancel(order)) return;
    commit({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled", history: [...o.history, { status: "cancelled", at: now.toISOString() }] } : o)),
      appointments: releaseWindows(state.appointments, orderId),
    });
  },

  /** Joins a monthly plan, paid online. The month starts today. */
  joinPlan(planId: string, pay: OnlinePayment, now = new Date()): { subscription: Subscription; payment: Payment } | { error: string } {
    const customerId = state.session.customerId;
    if (!customerId) return { error: "Log in to join a plan." };
    const plan = state.plans.find((p) => p.id === planId && p.active !== false);
    if (!plan) return { error: "That plan isn't available." };
    if (activeSubscription(state.subscriptions, customerId, now)) return { error: "You're already on a plan." };
    if (pay.amount !== plan.price) return { error: "The payment doesn't match the plan price." };
    const receiptCounter = state.counters.receipt + 1;
    const subId = newId("s");
    const payment: Payment = {
      id: newId("p"),
      amount: plan.price,
      method: pay.method,
      reference: paystackReference(`PL-${subId.slice(2, 6).toUpperCase()}`, randomToken(6)),
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: "full",
      receivedBy: "Paystack (online)",
      payer: pay.payer,
    };
    const subscription: Subscription = { id: subId, customerId, planId, startedAt: now.toISOString(), periodStart: dayKey(now), renewsOn: dayKey(addMonth(now)), status: "active", payments: [payment] };
    // An earlier plan that ran out is closed rather than deleted: its payments stay in the books.
    const closed = state.subscriptions.map((s) => (s.customerId === customerId && s.status !== "cancelled" ? { ...s, status: "cancelled" as const } : s));
    commit({ ...state, subscriptions: [subscription, ...closed], counters: { ...state.counters, receipt: receiptCounter } });
    return { subscription, payment };
  },

  /** Pays next month early (or a lapsed one), moving the month on. */
  renewPlan(subscriptionId: string, pay: OnlinePayment, now = new Date()): { payment: Payment } | { error: string } {
    const subscription = state.subscriptions.find((s) => s.id === subscriptionId && s.customerId === state.session.customerId);
    if (!subscription) return { error: "We couldn't find that plan." };
    return renewSubscription(subscription, { amount: pay.amount, method: pay.method, payer: pay.payer, receivedBy: "Paystack (online)" }, now);
  },

  /** Stops the plan renewing. The month already paid for keeps working until it runs out. */
  cancelPlan(subscriptionId: string) {
    const subscription = state.subscriptions.find((s) => s.id === subscriptionId && s.customerId === state.session.customerId);
    if (!subscription) return;
    commit({ ...state, subscriptions: state.subscriptions.map((s) => (s.id === subscriptionId ? { ...s, endsAtRenewal: true } : s)) });
  },

  /** Changes their mind before the month runs out. */
  keepPlan(subscriptionId: string) {
    const subscription = state.subscriptions.find((s) => s.id === subscriptionId && s.customerId === state.session.customerId);
    if (!subscription) return;
    commit({ ...state, subscriptions: state.subscriptions.map((s) => (s.id === subscriptionId ? { ...s, endsAtRenewal: false } : s)) });
  },

  /** Sends a 6-digit code to a WhatsApp number. Returns the code so the demo can show it as a notification. */
  sendCode(phone: string, now = Date.now()): string {
    const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 900000));
    pendingCode = { phone, code, expiresAt: now + CODE_TTL_MS, attempts: 0 };
    return code;
  },

  checkCode(phone: string, input: string, now = Date.now()): CodeCheck {
    const { result, pending } = checkCode(pendingCode, phone, input, now);
    pendingCode = pending;
    return result;
  },

  /** Customer record for a number, if the shop has one. */
  customerForPhone(phone: string): Customer | undefined {
    return state.customers.find((c) => samePhone(c.phone, phone));
  },

  /** Call after the code checks out. Turns the customer record for this number into an account (or creates one) and signs in. */
  createAccount(details: { name: string; phone: string; email?: string }, now = new Date()): Customer {
    const existing = actions.customerForPhone(details.phone);
    const customer: Customer = existing
      ? { ...existing, name: details.name || existing.name, email: details.email || existing.email, hasAccount: true }
      : { id: newId("c"), name: details.name, phone: details.phone, email: details.email ?? "", town: "", memberSince: now.toISOString(), hasAccount: true, points: 0 };
    commit({
      ...state,
      customers: existing ? state.customers.map((c) => (c.id === customer.id ? customer : c)) : [...state.customers, customer],
      session: { customerId: customer.id },
    });
    return customer;
  },

  /** Call after the code checks out. Returns null when the number has no account. */
  logIn(phone: string): Customer | null {
    const customer = state.customers.find((c) => c.hasAccount && samePhone(c.phone, phone));
    if (!customer) return null;
    commit({ ...state, session: { customerId: customer.id } });
    return customer;
  },

  /** Customer record for an email address, if the shop has one. */
  customerForEmail(email: string): Customer | undefined {
    const wanted = email.trim().toLowerCase();
    return wanted ? state.customers.find((c) => c.email.trim().toLowerCase() === wanted) : undefined;
  },

  /**
   * Signs in a customer the auth service has already checked. `remember: false` keeps the
   * sign-in to this browser session only.
   */
  startSession(customerId: string, remember = true): Customer | null {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) return null;
    const account = customer.hasAccount ? customer : { ...customer, hasAccount: true };
    markLiveSession(remember ? null : customerId);
    commit({
      ...state,
      customers: account === customer ? state.customers : state.customers.map((c) => (c.id === customerId ? account : c)),
      session: remember ? { customerId } : { customerId, transient: true },
    });
    return account;
  },

  logOut() {
    markLiveSession(null);
    commit({ ...state, session: { customerId: null } });
  },

  /** Finds an order by number and WhatsApp number. */
  lookUpOrder(orderNumberInput: string, phone: string): Order | null {
    return findOrder(state.orders, state.customers, orderNumberInput, phone);
  },

  /** Call after the code checks out: keeps the found order on this phone. */
  addOrderToDevice(orderId: string) {
    if (state.device.orderIds.includes(orderId)) return;
    commit({ ...state, device: { ...state.device, orderIds: [orderId, ...state.device.orderIds] } });
  },

  /** Clears the remembered details and the orders listed on this phone. Nothing is deleted from the shop's records. */
  forgetDevice() {
    commit({ ...state, device: { ...state.device, contact: null, orderIds: [] } });
  },

  toggleSaved(serviceId: string) {
    const saved = state.device.savedServiceIds;
    const savedServiceIds = saved.includes(serviceId) ? saved.filter((id) => id !== serviceId) : [...saved, serviceId];
    commit({ ...state, device: { ...state.device, savedServiceIds } });
  },

  /** How the signed-in client likes their laundry done, kept for every order. */
  saveCare(care: CarePrefs): { ok: true } | { error: string } {
    const customerId = state.session.customerId;
    if (!customerId) return { error: "Log in to save this." };
    if ((care.notes ?? "").length > 300) return { error: "Keep notes under 300 characters." };
    commit({ ...state, customers: state.customers.map((c) => (c.id === customerId ? { ...c, care: { ...care, notes: care.notes?.trim() || undefined } } : c)) });
    return { ok: true };
  },

  resetDemo() {
    pendingCode = null;
    commit(createSeed(new Date()));
  },
};

/** Takes a month's payment and moves the plan on a month. Shared by the client app and the counter. */
function renewSubscription(subscription: Subscription, pay: { amount: number; method: PaymentMethod; payer?: string; reference?: string; receivedBy: string }, now: Date): { payment: Payment } | { error: string } {
  if (subscription.status === "cancelled") return { error: "This plan was cancelled. Join again from Plans." };
  const plan = state.plans.find((p) => p.id === subscription.planId);
  if (!plan) return { error: "That plan isn't available any more." };
  if (pay.amount !== plan.price) return { error: `A month of ${plan.name} is ${money(plan.price)}.` };
  const receiptCounter = state.counters.receipt + 1;
  const payment: Payment = {
    id: newId("p"),
    amount: plan.price,
    method: pay.method,
    reference: pay.reference?.trim().slice(0, 40) || paystackReference(`PL-${subscription.id.slice(2, 6).toUpperCase()}`, randomToken(6)),
    at: now.toISOString(),
    receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
    kind: "full",
    receivedBy: pay.receivedBy,
    payer: pay.payer,
  };
  const period = renewedPeriod(subscription, now);
  commit({
    ...state,
    subscriptions: state.subscriptions.map((s) => (s.id === subscription.id ? { ...s, ...period, status: "active", endsAtRenewal: false, payments: [...s.payments, payment] } : s)),
    counters: { ...state.counters, receipt: receiptCounter },
  });
  return { payment };
}

/* ---------------- Owner side ---------------- */

export interface CounterPayment {
  amount: number;
  method: PaymentMethod;
  /** MoMo transaction ID or bank reference. Optional for cash. */
  reference?: string;
}

export interface CheckInDraft {
  count: number;
  notes?: string;
  photos?: string[];
  /** The total once the counter has seen the load: a basket that's bigger than booked, a gown priced. */
  total?: number;
}

export interface WalkInOrder {
  /** An existing client, or the details of a new one. */
  customerId?: string;
  newClient?: { name: string; phone: string; town: string; source: LeadSource };
  items: Omit<OrderItem, "id">[];
  speed: Speed;
  care: CarePrefs;
  handback: Handback;
  zoneId?: string;
  deliveryStart?: string;
  checkIn: { count: number; notes?: string };
  /** The price agreed at the counter. */
  total: number;
  riderFee: number;
  expressFee: number;
  planCover: number;
  /** Take the baskets off the client's plan. */
  usePlan?: boolean;
  comments?: string;
  payment?: CounterPayment;
}

type Result<T> = T | { error: string };

const OWNER = "Aromatic Laundry";
const findOrderById = (id: string) => state.orders.find((o) => o.id === id);
const updateOrder = (id: string, change: (order: Order) => Order) => state.orders.map((o) => (o.id === id ? change(o) : o));
const withStatus = (order: Order, status: OrderStatus, now: Date): Order => ({ ...order, status, history: [...order.history, { status, at: now.toISOString() }] });

const REFERENCE_FALLBACK: Record<PaymentMethod, string> = { cash: "Cash", momo: "MoMo", bank: "Bank transfer", card: "Card" };

function counterPayment(data: AppData, order: Order, pay: CounterPayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(order, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: pay.reference?.trim().slice(0, 40) || REFERENCE_FALLBACK[pay.method],
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(order, pay.amount),
      receivedBy: OWNER,
    },
  };
}

const MAX_PHOTOS = 4;

/** What the owner does from the admin side. Each returns an error message instead of throwing. */
export const shop = {
  /** Opens the bag at the counter: count, notes and photos, the final price, and the clock starts. */
  checkIn(orderId: string, draft: CheckInDraft, now = new Date()): Result<{ order: Order; deliveryTooEarly: boolean }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (order.status !== "booked") return { error: "This order is already checked in." };
    if (!Number.isInteger(draft.count) || draft.count < 1 || draft.count > 500) return { error: "Count the garments: between 1 and 500." };
    if ((draft.notes ?? "").length > 500) return { error: "Keep the notes under 500 characters." };
    const total = draft.total ?? order.total;
    if (!Number.isFinite(total) || total < 0 || total > 100_000) return { error: "Enter a total between GH₵ 0 and GH₵ 100,000." };
    const paid = order.total - balanceDue(order);
    if (total < paid) return { error: "The total can't be less than what's already paid." };
    const checkIn: CheckIn = { count: draft.count, notes: draft.notes?.trim() || undefined, photos: draft.photos?.slice(0, MAX_PHOTOS), at: now.toISOString() };
    // The promise starts when the clothes reach the counter, not when the order was booked.
    const readyAt = localIso(readyTime(now, turnaroundHours(order.items), order.speed === "express", RULES.expressHours, HOURS));
    const next = withStatus({ ...order, checkIn, total, readyAt }, "received", now);
    // A late pickup can push the ready time past the delivery window the client chose: that window goes back to the owner to rebook.
    const delivery = state.appointments.find((a) => a.id === order.deliveryId && a.status !== "cancelled" && a.status !== "done");
    const deliveryTooEarly = Boolean(delivery && delivery.start < readyAt);
    commit({
      ...state,
      orders: updateOrder(orderId, () => next),
      appointments: state.appointments.map((a) => {
        if (a.id === order.pickupId && a.status !== "cancelled") return { ...a, status: "done" };
        if (deliveryTooEarly && a.id === delivery?.id) return { ...a, status: "requested" };
        return a;
      }),
    });
    return { order: next, deliveryTooEarly };
  },

  /** Moves an order to another stage. Handing over needs the balance paid unless the owner allows it. */
  moveTo(orderId: string, status: Exclude<OrderStatus, "cancelled" | "booked">, now = new Date(), opts: { allowOwing?: boolean } = {}): Result<{ order: Order }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (!isActive(order)) return { error: "This order is closed." };
    if (order.status === "booked") return { error: "Check it in at the counter first." };
    if (order.status === status) return { order };
    if (status === "out" && order.handback !== "delivery") return { error: "This order is collected at the counter." };
    if (status === "done" && balanceDue(order) > 0 && !opts.allowOwing) return { error: "This order still has a balance to pay." };
    const next = withStatus(order, status, now);
    commit({
      ...state,
      orders: updateOrder(orderId, () => next),
      appointments: status === "done" ? state.appointments.map((a) => (a.id === order.deliveryId && a.status !== "cancelled" ? { ...a, status: "done" } : a)) : state.appointments,
    });
    return { order: next };
  },

  recordPayment(orderId: string, pay: CounterPayment, now = new Date()): Result<{ payment: Payment }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    const result = counterPayment(state, order, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      orders: updateOrder(orderId, (o) => withPayment(o, result.payment)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  /** The owner can cancel at any stage; any rider run the order still holds is cancelled too. */
  cancel(orderId: string, now = new Date()): Result<{ order: Order }> {
    const order = findOrderById(orderId);
    if (!order) return { error: "We couldn't find that order." };
    if (!isActive(order)) return { error: "This order is already closed." };
    const next = withStatus(order, "cancelled", now);
    commit({
      ...state,
      orders: updateOrder(orderId, () => next),
      appointments: releaseWindows(state.appointments, orderId),
    });
    return { order: next };
  },

  markUpdateSent(orderId: string, now = new Date()) {
    if (!findOrderById(orderId)) return;
    commit({ ...state, orders: updateOrder(orderId, (o) => ({ ...o, lastUpdateAt: now.toISOString() })) });
  },

  setAppointmentStatus(appointmentId: string, status: Appointment["status"]) {
    if (!state.appointments.some((a) => a.id === appointmentId)) return;
    commit({ ...state, appointments: state.appointments.map((a) => (a.id === appointmentId ? { ...a, status } : a)) });
  },

  setReviewStatus(reviewId: string, status: ReviewStatus) {
    if (!state.reviews.some((r) => r.id === reviewId)) return;
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, status } : r)) });
  },

  replyToReview(reviewId: string, reply: string): Result<{ ok: true }> {
    const text = reply.trim();
    if (text.length < 2) return { error: "Write a reply first." };
    if (text.length > 600) return { error: "Keep replies under 600 characters." };
    if (!state.reviews.some((r) => r.id === reviewId)) return { error: "We couldn't find that review." };
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, reply: text } : r)) });
    return { ok: true };
  },

  saveNotes(customerId: string, notes: string): Result<{ ok: true }> {
    if (notes.length > 4000) return { error: "Notes are limited to 4,000 characters." };
    if (!state.customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    commit({ ...state, customers: state.customers.map((c) => (c.id === customerId ? { ...c, notes: notes.trim() } : c)) });
    return { ok: true };
  },

  /** The counter updates how a client likes it done, e.g. after a phone call. */
  saveCare(customerId: string, care: CarePrefs): Result<{ ok: true }> {
    if ((care.notes ?? "").length > 300) return { error: "Keep notes under 300 characters." };
    if (!state.customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    commit({ ...state, customers: state.customers.map((c) => (c.id === customerId ? { ...c, care: { ...care, notes: care.notes?.trim() || undefined } } : c)) });
    return { ok: true };
  },

  /** Edits one service's name, price, turnaround or visibility. */
  saveService(serviceId: string, patch: Partial<Pick<Service, "name" | "description" | "price" | "hours" | "express" | "featured" | "active">>): Result<{ service: Service }> {
    const current = state.services.find((s) => s.id === serviceId);
    if (!current) return { error: "We couldn't find that service." };
    const next: Service = { ...current, ...patch };
    next.name = next.name.trim();
    next.description = next.description.trim();
    if (next.name.length < 2) return { error: "Give the service a name." };
    if (!Number.isFinite(next.price) || next.price < 0 || next.price > 100_000) return { error: "Prices must be between GH₵ 0 and GH₵ 100,000." };
    if (next.kind === "fixed" && next.price <= 0) return { error: "Enter a price above zero." };
    if (!Number.isInteger(next.hours) || next.hours < 1 || next.hours > 336) return { error: "Turnaround must be between 1 and 336 hours." };
    commit({ ...state, services: state.services.map((s) => (s.id === serviceId ? next : s)) });
    return { service: next };
  },

  /** Puts the whole price list back to the starting prices. */
  resetServices() {
    commit({ ...state, services: defaultServices() });
  },

  /** Edits a monthly plan. Running subscriptions keep their month; the new price applies at renewal. */
  savePlan(planId: string, patch: Partial<Pick<Plan, "name" | "blurb" | "price" | "baskets" | "perks" | "featured" | "active">>): Result<{ plan: Plan }> {
    const current = state.plans.find((p) => p.id === planId);
    if (!current) return { error: "We couldn't find that plan." };
    const next: Plan = { ...current, ...patch, perks: (patch.perks ?? current.perks).map((p) => p.trim()).filter(Boolean) };
    next.name = next.name.trim();
    if (next.name.length < 2) return { error: "Give the plan a name." };
    if (!Number.isFinite(next.price) || next.price <= 0 || next.price > 100_000) return { error: "Enter a monthly price between GH₵ 1 and GH₵ 100,000." };
    if (!Number.isInteger(next.baskets) || next.baskets < 1 || next.baskets > 60) return { error: "Baskets a month must be between 1 and 60." };
    commit({ ...state, plans: state.plans.map((p) => (p.id === planId ? next : p)) });
    return { plan: next };
  },

  resetPlans() {
    commit({ ...state, plans: defaultPlans() });
  },

  /** A renewal paid at the counter or by MoMo to the shop's number. */
  recordPlanPayment(subscriptionId: string, pay: CounterPayment, now = new Date()): Result<{ payment: Payment }> {
    const subscription = state.subscriptions.find((s) => s.id === subscriptionId);
    if (!subscription) return { error: "We couldn't find that plan." };
    return renewSubscription(subscription, { amount: pay.amount, method: pay.method, reference: pay.reference || REFERENCE_FALLBACK[pay.method], receivedBy: OWNER }, now);
  },

  setSubscriptionStatus(subscriptionId: string, status: Subscription["status"]) {
    if (!state.subscriptions.some((s) => s.id === subscriptionId)) return;
    commit({ ...state, subscriptions: state.subscriptions.map((s) => (s.id === subscriptionId ? { ...s, status } : s)) });
  },

  /** Saves the shop details, opening hours, policies, fees or rider zones. */
  saveSettings(patch: { shop?: Partial<ShopSettings["shop"]>; hours?: ShopSettings["hours"]; policies?: Partial<ShopSettings["policies"]>; rules?: Partial<ShopSettings["rules"]>; zones?: Zone[] }): Result<{ settings: ShopSettings }> {
    const next = cloneSettings(state.settings);
    if (patch.shop) Object.assign(next.shop, patch.shop);
    if (patch.policies) Object.assign(next.policies, patch.policies);
    if (patch.rules) Object.assign(next.rules, patch.rules);
    if (patch.hours) next.hours = { ...patch.hours };
    if (patch.zones) next.zones = patch.zones.map((z) => ({ ...z, name: z.name.trim(), areas: z.areas.trim() }));

    next.shop.name = next.shop.name.trim();
    next.shop.phone = next.shop.phone.trim();
    if (next.shop.name.length < 2) return { error: "The shop needs a name." };
    if (!normalizeGhPhone(next.shop.phone)) return { error: "Enter a Ghana phone number, like 054 890 8101." };
    for (const link of [next.shop.whatsappBusiness, next.shop.tiktok]) {
      if (link.trim() && !/^https?:\/\/\S+$/.test(link.trim())) return { error: "Links must start with https://" };
    }
    if (next.shop.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next.shop.email.trim())) return { error: "Enter an email address, like hello@aromaticlaundry.com." };
    if (next.shop.address.trim().length < 3) return { error: "Enter the shop address." };
    if (!Number.isFinite(next.rules.expressFee) || next.rules.expressFee < 0 || next.rules.expressFee > 10_000) return { error: "The express fee must be between GH₵ 0 and GH₵ 10,000." };
    if (!Number.isInteger(next.rules.expressHours) || next.rules.expressHours < 1 || next.rules.expressHours > 12) return { error: "Express must take between 1 and 12 hours." };
    if (!next.zones.length) return { error: "Keep at least one rider zone." };
    for (const zone of next.zones) {
      if (zone.name.length < 2) return { error: "Give every zone a name." };
      if (!Number.isFinite(zone.fee) || zone.fee < 0 || zone.fee > 1_000) return { error: "Rider fees must be between GH₵ 0 and GH₵ 1,000." };
    }
    for (let day = 0; day < 7; day++) {
      const span = next.hours[day];
      if (!span) continue;
      const [open, close] = span;
      if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return { error: "Opening hours use 24-hour times, like 07:00." };
      if (close <= open) return { error: "Each day has to close after it opens." };
    }
    commit({ ...state, settings: next });
    return { settings: next };
  },

  resetSettings() {
    commit({ ...state, settings: defaultSettings() });
  },

  /** A counter drop-off or a WhatsApp order the owner takes down herself. It's at the counter, so it starts checked in. */
  createOrder(draft: WalkInOrder, now = new Date()): Result<{ order: Order; payment?: Payment }> {
    let customers = state.customers;
    let customerId = draft.customerId;
    if (customerId) {
      if (!customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    } else {
      const client = draft.newClient;
      const name = client?.name.trim().replace(/\s+/g, " ") ?? "";
      if (name.length < 2) return { error: "Enter the client's name." };
      if (!client || !normalizeGhPhone(client.phone)) return { error: "Enter a Ghana phone number, like 024 123 4567." };
      const existing = customers.find((c) => samePhone(c.phone, client.phone));
      if (existing) {
        customerId = existing.id;
      } else {
        const created: Customer = { id: newId("c"), name, phone: client.phone.trim(), email: "", town: client.town.trim(), memberSince: now.toISOString(), hasAccount: false, points: 0, source: client.source };
        customers = [...customers, created];
        customerId = created.id;
      }
    }
    const items = draft.items.filter((i) => i.qty > 0);
    if (!items.length) return { error: "Add at least one service." };
    if (!Number.isFinite(draft.total) || draft.total < 0) return { error: "Enter the agreed price." };
    if (!Number.isInteger(draft.checkIn.count) || draft.checkIn.count < 1) return { error: "Count the garments before checking in." };
    if (draft.handback === "delivery" && !draft.zoneId) return { error: "Choose the delivery area." };

    let subscriptionId: string | undefined;
    if (draft.usePlan) {
      const subscription = activeSubscription(state.subscriptions, customerId, now);
      if (!subscription) return { error: "This client isn't on an active plan." };
      if (planStatus(subscription, state.orders, now).left <= 0) return { error: "This month's basket washes are used up." };
      subscriptionId = subscription.id;
    }

    const createdAt = now.toISOString();
    const orderId = newId("o");
    const deliveryId = draft.handback === "delivery" && draft.deliveryStart ? newId("a") : undefined;
    const readyAt = localIso(readyTime(now, turnaroundHours(items), draft.speed === "express", RULES.expressHours, HOURS));
    if (draft.handback === "delivery" && draft.deliveryStart) {
      if (draft.deliveryStart < readyAt) return { error: "That delivery window is before it's ready. Pick a later one." };
      const problem = windowProblem(state, draft.deliveryStart, "delivery", now);
      if (problem) return { error: problem };
    }
    let order: Order = {
      id: orderId,
      number: orderNumber(state.counters.order),
      customerId,
      createdAt,
      items: items.map((item) => ({ ...item, id: newId("i") })),
      speed: draft.speed,
      care: { ...draft.care, notes: draft.care.notes?.trim() || undefined },
      intake: "dropoff",
      handback: draft.handback,
      zoneId: draft.handback === "delivery" ? draft.zoneId : undefined,
      inAt: localIso(now),
      readyAt,
      deliveryId,
      comments: draft.comments?.trim() || undefined,
      checkIn: { count: draft.checkIn.count, notes: draft.checkIn.notes?.trim() || undefined, at: createdAt },
      status: "received",
      history: [
        { status: "booked", at: createdAt },
        { status: "received", at: createdAt },
      ],
      total: draft.total,
      riderFee: draft.riderFee,
      expressFee: draft.expressFee,
      planCover: subscriptionId ? draft.planCover : 0,
      discount: 0,
      payChoice: subscriptionId ? "plan" : "later",
      subscriptionId,
      payments: [],
    };

    let receipt = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.payment && draft.payment.amount > 0) {
      const result = counterPayment(state, order, draft.payment, now);
      if ("error" in result) return result;
      payment = result.payment;
      receipt = result.receiptCounter;
      order = withPayment(order, payment);
    }

    const appointments = deliveryId && draft.deliveryStart
      ? [{ id: deliveryId, customerId, orderId, purpose: "delivery" as const, start: draft.deliveryStart, minutes: 120, status: "confirmed" as const }, ...state.appointments]
      : state.appointments;

    commit({ ...state, customers, orders: [order, ...state.orders], appointments, counters: { order: state.counters.order + 1, receipt } });
    return { order, payment };
  },

  addExpense(input: { on: string; amount: number; categoryId: string; note?: string; method: PaymentMethod }, now = new Date()): Result<{ expense: Expense }> {
    const error = validateExpense(input);
    if (error) return { error };
    if ((input.note ?? "").length > 120) return { error: "Keep the note under 120 characters." };
    const expense: Expense = { id: newId("e"), on: input.on, amount: Math.round(input.amount * 100) / 100, categoryId: input.categoryId, note: input.note?.trim() || undefined, method: input.method, createdAt: now.toISOString() };
    commit({ ...state, expenses: [expense, ...state.expenses] });
    return { expense };
  },

  removeExpense(expenseId: string) {
    if (!state.expenses.some((e) => e.id === expenseId)) return;
    commit({ ...state, expenses: state.expenses.filter((e) => e.id !== expenseId) });
  },

  setExpenseCategoryActive(categoryId: string, active: boolean) {
    if (!state.expenseCategories.some((c) => c.id === categoryId)) return;
    if (!active && state.expenseCategories.filter((c) => c.active !== false).length <= 1) return;
    commit({ ...state, expenseCategories: state.expenseCategories.map((c) => (c.id === categoryId ? { ...c, active } : c)) });
  },
};
