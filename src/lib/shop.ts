import { SHOP } from "../data/business";
import { careSummary, planById, serviceById } from "../data/catalog";
import type { Customer, LeadSource, Order, OrderStatus, PaymentMethod, Subscription } from "../data/types";
import { fmtDayShort, fmtTime, money, parseLocal, plural, relativeDay } from "./format";
import { basketCount } from "./items";
import { balanceDue, dayPhrase, isInShop, isLate, readyPhrase, stagesFor, type Badge } from "./orders";

export { orderTitle } from "./items";
export { isInShop, isLate } from "./orders";

/* Owner-side order logic: stage labels, what to do next, the day's load and the WhatsApp messages the shop sends. */

export const OWNER_STAGE_LABEL: Record<OrderStatus, string> = {
  booked: "Booked",
  received: "Checked in",
  washing: "Washing",
  finishing: "Ironing",
  ready: "Ready",
  out: "With the rider",
  done: "Handed over",
  cancelled: "Cancelled",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = { momo: "MoMo", cash: "Cash", bank: "Bank", card: "Card" };

export const SOURCE_LABEL: Record<LeadSource, string> = {
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  walkin: "Walk-in",
  referral: "Referral",
  app: "Laundry app",
};

/** The owner sees the exact stage. Tones match the client badges so an order looks the same on both sides. */
export function ownerBadge(order: Pick<Order, "status" | "readyAt" | "payments" | "total">, now: Date): Badge {
  switch (order.status) {
    case "booked":
      return { label: OWNER_STAGE_LABEL.booked, tone: "lilac" };
    case "ready":
      return { label: balanceDue(order) > 0 ? "Ready · owes" : "Ready", tone: balanceDue(order) > 0 ? "sand" : "aqua" };
    case "out":
      return { label: OWNER_STAGE_LABEL.out, tone: "aqua" };
    case "done":
      return { label: OWNER_STAGE_LABEL.done, tone: "mist" };
    case "cancelled":
      return { label: OWNER_STAGE_LABEL.cancelled, tone: "danger" };
    default:
      return isLate(order, now) ? { label: `Late · ${OWNER_STAGE_LABEL[order.status]}`, tone: "sand" } : { label: OWNER_STAGE_LABEL[order.status], tone: "sky" };
  }
}

export function nextStage(order: Pick<Order, "status" | "handback">): OrderStatus | null {
  const stages = stagesFor(order);
  const i = stages.indexOf(order.status);
  return i >= 0 && i < stages.length - 1 ? (stages[i + 1] ?? null) : null;
}

export type StepKind = "checkin" | "payment" | "advance" | "handover";

export interface OwnerStep {
  label: string;
  kind: StepKind;
  /** For "advance": the stage the order moves to. */
  to?: Exclude<OrderStatus, "cancelled" | "booked">;
}

/** The one thing an order needs from the counter next. */
export function ownerNextStep(order: Pick<Order, "status" | "payments" | "total" | "handback" | "intake">): OwnerStep | null {
  switch (order.status) {
    case "booked":
      return { label: order.intake === "pickup" ? "Check in from rider" : "Check in", kind: "checkin" };
    case "received":
      return { label: "Start washing", kind: "advance", to: "washing" };
    case "washing":
      return { label: "Move to ironing", kind: "advance", to: "finishing" };
    case "finishing":
      return { label: "Mark ready", kind: "advance", to: "ready" };
    case "ready":
      if (order.handback === "delivery") return { label: "Send with rider", kind: "advance", to: "out" };
      if (balanceDue(order) > 0) return { label: "Record payment", kind: "payment" };
      return { label: "Mark collected", kind: "handover" };
    case "out":
      if (balanceDue(order) > 0) return { label: "Record payment", kind: "payment" };
      return { label: "Mark delivered", kind: "handover" };
    default:
      return null;
  }
}

/** The time that matters for where the order is. */
export function ownerDateLine(order: Pick<Order, "status" | "readyAt" | "inAt" | "history" | "intake" | "handback">, now: Date): { text: string; late: boolean } {
  const inSentence = (text: string) => (["Today", "Tomorrow", "Yesterday"].includes(text) ? text.toLowerCase() : text);
  const when = (iso: string) => {
    const d = parseLocal(iso);
    return `${inSentence(relativeDay(d, now))} ${fmtTime(d)}`;
  };
  const lastAt = (status: OrderStatus) => {
    const event = [...order.history].reverse().find((h) => h.status === status);
    if (!event) return null;
    const d = new Date(event.at);
    return `${inSentence(relativeDay(d, now))} ${fmtTime(d)}`;
  };
  switch (order.status) {
    case "booked":
      return { text: `${order.intake === "pickup" ? "Pickup" : "Drop-off"} ${when(order.inAt)}`, late: false };
    case "ready": {
      const since = lastAt("ready");
      return { text: since ? `Ready since ${since}` : "Ready", late: false };
    }
    case "out":
      return { text: `Left ${lastAt("out") ?? ""}`.trim(), late: false };
    case "done":
      return { text: `${order.handback === "delivery" ? "Delivered" : "Collected"} ${lastAt("done") ?? ""}`.trim(), late: false };
    case "cancelled":
      return { text: `Cancelled ${lastAt("cancelled") ?? ""}`.trim(), late: false };
    default: {
      if (isLate(order, now)) {
        const minutes = Math.round((now.getTime() - parseLocal(order.readyAt).getTime()) / 60_000);
        const late = minutes >= 120 ? plural(Math.round(minutes / 60), "hour") : plural(minutes, "min");
        return { text: `Late by ${late} · was due ${when(order.readyAt)}`, late: true };
      }
      return { text: `Due ${when(order.readyAt)}`, late: false };
    }
  }
}

/* ---------------- The load ---------------- */

export interface LoadLine {
  serviceId: string;
  name: string;
  qty: number;
  orders: string[];
}

/** What's on the floor right now: every order checked in and not yet ready, with identical services counted together. */
export function floorLoad(orders: Order[]): LoadLine[] {
  const lines = new Map<string, LoadLine>();
  for (const order of orders) {
    if (!isInShop(order)) continue;
    for (const item of order.items) {
      const line = lines.get(item.serviceId) ?? { serviceId: item.serviceId, name: serviceById(item.serviceId)?.name ?? "Laundry", qty: 0, orders: [] };
      line.qty += item.qty;
      if (!line.orders.includes(order.number)) line.orders.push(order.number);
      lines.set(item.serviceId, line);
    }
  }
  return [...lines.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}

/** Orders in the shop, soonest due first: the counter's working order. */
export function dueQueue(orders: Order[]): Order[] {
  return orders.filter(isInShop).sort((a, b) => a.readyAt.localeCompare(b.readyAt) || (a.status === b.status ? 0 : a.status === "finishing" ? -1 : 1));
}

/** Baskets checked in on a day, for the daily load count. */
export function basketsCheckedIn(orders: Order[], day: string): number {
  return orders.reduce((sum, order) => {
    const at = order.history.find((h) => h.status === "received")?.at;
    return at && at.slice(0, 10) === day ? sum + basketCount(order) : sum;
  }, 0);
}

/* ---------------- Messages ---------------- */

const firstName = (customer?: Pick<Customer, "name">) => customer?.name.split(/\s+/)[0] ?? "there";
const sign = () => `\n\n${SHOP.tagline}\n${SHOP.name}`;

/** The WhatsApp update for where the order is now. The owner reviews it before it opens in WhatsApp. */
export function updateMessage(order: Order, customer: Pick<Customer, "name"> | undefined, now: Date): string {
  const hi = `Hi ${firstName(customer)},`;
  const what = `your laundry (${order.number})`;
  const balance = balanceDue(order);
  const inAt = parseLocal(order.inAt);
  switch (order.status) {
    case "booked":
      return order.intake === "pickup"
        ? `${hi} your pickup is booked for ${dayPhrase(inAt, now)} from ${fmtTime(inAt)}. Our rider will call when they're close. Order ${order.number}.${sign()}`
        : `${hi} thank you for booking with us. Bring your laundry to the counter inside West Hills Mall ${dayPhrase(inAt, now)} around ${fmtTime(inAt)}. Order ${order.number}.${sign()}`;
    case "received": {
      const count = order.checkIn ? ` We counted ${plural(order.checkIn.count, "piece")}.` : "";
      const noted = order.checkIn?.notes ? ` Noted: ${order.checkIn.notes}.` : "";
      return `${hi} we've received ${what}.${count}${noted} It'll be ready ${readyPhrase(order.readyAt, now)}. Total: ${money(order.total)}.${sign()}`;
    }
    case "washing":
      return `${hi} ${what} is in the wash now (${careSummary(order.care)}). Ready ${readyPhrase(order.readyAt, now)}.${sign()}`;
    case "finishing":
      return `${hi} ${what} is out of the dryer and being ironed and folded. We'll message you the moment it's ready.${sign()}`;
    case "ready":
      if (order.handback === "delivery") return `${hi} ${what} is ready and goes out with our rider shortly.${balance > 0 ? ` Balance: ${money(balance)}, payable to the rider by MoMo or cash.` : ""}${sign()}`;
      return balance > 0
        ? `${hi} ${what} is ready to collect at the counter inside West Hills Mall, any time until 9pm. Balance: ${money(balance)}. You can pay by MoMo to ${SHOP.phone}.${sign()}`
        : `${hi} ${what} is ready to collect at the counter inside West Hills Mall, any time until 9pm. Just show your order number.${sign()}`;
    case "out":
      return `${hi} ${what} is on its way. The rider will call when they're close.${balance > 0 ? ` Balance: ${money(balance)}.` : ""}${sign()}`;
    case "done":
      return `${hi} thank you for choosing ${SHOP.name}! We hope it smells as good as it looks. We'd love a quick review.${sign()}`;
    case "cancelled":
      return `${hi} your order ${order.number} has been cancelled. Message us any time you'd like us to take care of your laundry.${sign()}`;
  }
}

/** A friendly nudge before a plan renews. */
export function renewalMessage(subscription: Pick<Subscription, "planId" | "renewsOn">, customer: Pick<Customer, "name"> | undefined, now: Date): string {
  const plan = planById(subscription.planId);
  const renews = parseLocal(subscription.renewsOn);
  return `Hi ${firstName(customer)}, your ${plan?.name ?? "monthly"} plan renews ${dayPhrase(renews, now)} (${fmtDayShort(renews)}) at ${money(plan?.price ?? 0)}. Pay by MoMo to ${SHOP.phone} or in the app, and your next ${plan?.baskets ?? ""} basket washes are ready to book.${sign()}`;
}
