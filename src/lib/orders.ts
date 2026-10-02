import type { Order, OrderStatus } from "../data/types";
import { fmtDate, fmtTime, money, parseLocal, relativeDay } from "./format";

/** Every stage an order can pass through. Orders collected at the counter skip "out". */
export const STAGES: OrderStatus[] = ["booked", "received", "washing", "finishing", "ready", "out", "done"];

/** The stages this order will actually go through. */
export const stagesFor = (order: Pick<Order, "handback">): OrderStatus[] => (order.handback === "delivery" ? STAGES : STAGES.filter((s) => s !== "out"));

export const STATUS_LABEL: Record<OrderStatus, string> = {
  booked: "Booked",
  received: "At the counter",
  washing: "Washing",
  finishing: "Ironing & folding",
  ready: "Ready",
  out: "Out for delivery",
  done: "Done",
  cancelled: "Cancelled",
};

/** Words for a stage on this order: "Pickup booked" or "Drop-off booked", "Collected" or "Delivered". */
export function stageLabel(status: OrderStatus, order: Pick<Order, "intake" | "handback">): string {
  if (status === "booked") return order.intake === "pickup" ? "Pickup booked" : "Drop-off booked";
  if (status === "ready") return order.handback === "delivery" ? "Ready to go out" : "Ready to collect";
  if (status === "done") return order.handback === "delivery" ? "Delivered" : "Collected";
  return STATUS_LABEL[status];
}

export type BadgeTone = "aqua" | "sand" | "sky" | "lilac" | "mist" | "danger" | "wash";

export function paidTotal(order: Pick<Order, "payments">): number {
  return order.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function balanceDue(order: Pick<Order, "payments" | "total">): number {
  return Math.max(0, order.total - paidTotal(order));
}

export function isActive(order: Pick<Order, "status">): boolean {
  return order.status !== "done" && order.status !== "cancelled";
}

/** Clients can cancel until the laundry reaches the counter. */
export function canCancel(order: Pick<Order, "status">): boolean {
  return order.status === "booked";
}

/** In the shop: counted, washing or being ironed. */
export const IN_SHOP: OrderStatus[] = ["received", "washing", "finishing"];
export const isInShop = (order: Pick<Order, "status">) => IN_SHOP.includes(order.status);

/** Late = still in the shop after the time we promised. */
export function isLate(order: Pick<Order, "status" | "readyAt">, now: Date): boolean {
  return isInShop(order) && parseLocal(order.readyAt) < now;
}

export function stageIndex(status: OrderStatus, order?: Pick<Order, "handback">): number {
  return (order ? stagesFor(order) : STAGES).indexOf(status);
}

export interface Badge {
  label: string;
  tone: BadgeTone;
}

export function badgeFor(order: Pick<Order, "status" | "payments" | "total" | "readyAt" | "intake" | "handback">, now: Date): Badge {
  switch (order.status) {
    case "cancelled":
      return { label: "Cancelled", tone: "danger" };
    case "done":
      return { label: order.handback === "delivery" ? "Delivered" : "Collected", tone: "mist" };
    case "ready":
      if (balanceDue(order) > 0) return { label: "Ready · balance due", tone: "sand" };
      return { label: order.handback === "delivery" ? "Ready to go out" : "Ready to collect", tone: "aqua" };
    case "out":
      return { label: "On its way", tone: "aqua" };
    case "booked":
      return { label: order.intake === "pickup" ? "Pickup booked" : "Drop-off booked", tone: "lilac" };
    default:
      if (isLate(order, now)) return { label: "Running late", tone: "sand" };
      return { label: order.status === "received" ? "At the counter" : order.status === "washing" ? "Washing" : "Ironing & folding", tone: "sky" };
  }
}

/** "today", "tomorrow" or "on Tue, 15 Sept" */
export function dayPhrase(day: Date, now: Date): string {
  const rel = relativeDay(day, now);
  return rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : `on ${rel}`;
}

/** "Ready today at 15:00" */
export const readyPhrase = (readyAt: string, now: Date) => {
  const ready = parseLocal(readyAt);
  return `${dayPhrase(ready, now)} at ${fmtTime(ready)}`;
};

export function titleFor(order: Pick<Order, "status" | "readyAt" | "inAt" | "history" | "intake" | "handback">, now: Date): string {
  const last = order.history[order.history.length - 1];
  const inAt = parseLocal(order.inAt);
  switch (order.status) {
    case "done":
      return `${order.handback === "delivery" ? "Delivered" : "Collected"} ${last ? fmtDate(new Date(last.at)) : ""}`.trim();
    case "cancelled":
      return `Cancelled ${last ? fmtDate(new Date(last.at)) : ""}`.trim();
    case "booked":
      return order.intake === "pickup" ? `Pickup ${dayPhrase(inAt, now)} from ${fmtTime(inAt)}` : `Drop off ${dayPhrase(inAt, now)} at ${fmtTime(inAt)}`;
    case "ready":
      return order.handback === "delivery" ? "Ready for delivery" : "Ready to collect";
    case "out":
      return "On its way to you";
    default: {
      const ready = parseLocal(order.readyAt);
      return ready < now ? "Almost ready" : `Ready ${readyPhrase(order.readyAt, now)}`;
    }
  }
}

export interface NextAction {
  title: string;
  body: string;
  cta?: { label: string; kind: "whatsapp" | "pay" | "calendar" | "directions" };
}

/** What the client should do next. `deliveryStart` is the booked delivery window, if any. */
export function nextAction(order: Order, now: Date, deliveryStart?: string): NextAction | null {
  const balance = balanceDue(order);
  const inAt = parseLocal(order.inAt);
  switch (order.status) {
    case "booked":
      return order.intake === "pickup"
        ? {
            title: `Our rider collects ${dayPhrase(inAt, now)} from ${fmtTime(inAt)}`,
            body: "Have the bag ready by the door and keep your phone close. We count everything at the counter and send you the tally on WhatsApp.",
            cta: { label: "Add to calendar", kind: "calendar" },
          }
        : {
            title: `Bring it in ${dayPhrase(inAt, now)} at ${fmtTime(inAt)}`,
            body: "Come to the counter inside West Hills Mall. We count it with you and give you a ticket with your order number.",
            cta: { label: "Get directions", kind: "directions" },
          };
    case "received":
      return order.checkIn
        ? {
            title: `We counted ${order.checkIn.count} ${order.checkIn.count === 1 ? "piece" : "pieces"}`,
            body: order.checkIn.notes ? `Noted at the counter: ${order.checkIn.notes}` : "Check the count against your bag. It goes into the wash next.",
            cta: { label: "Chat on WhatsApp", kind: "whatsapp" },
          }
        : null;
    case "washing":
    case "finishing":
      if (balance > 0 && order.payChoice === "later") return { title: `Ready ${readyPhrase(order.readyAt, now)}`, body: `Pay the ${money(balance)} now so it's ready to go the moment it's done, or pay when you collect.`, cta: { label: "Pay now", kind: "pay" } };
      return null;
    case "ready":
      if (order.handback === "delivery") {
        const when = deliveryStart ? `${dayPhrase(parseLocal(deliveryStart), now)} from ${fmtTime(parseLocal(deliveryStart))}` : "soon";
        return balance > 0
          ? { title: `Delivery ${when}`, body: `Pay the ${money(balance)} now, or pay the rider by MoMo or cash on arrival.`, cta: { label: "Pay now", kind: "pay" } }
          : { title: `Delivery ${when}`, body: "Keep your phone close: the rider calls when they're near.", cta: { label: "Add to calendar", kind: "calendar" } };
      }
      return balance > 0
        ? { title: "Your laundry is ready", body: `Pay the ${money(balance)} now and just pick it up, or pay at the counter.`, cta: { label: "Pay now", kind: "pay" } }
        : { title: "Your laundry is ready to collect", body: "Show your order number at the counter inside West Hills Mall, any day until 9pm.", cta: { label: "Get directions", kind: "directions" } };
    case "out":
      return balance > 0
        ? { title: "On its way to you", body: `The rider will call when they're close. Pay the ${money(balance)} now or on arrival.`, cta: { label: "Pay now", kind: "pay" } }
        : { title: "On its way to you", body: "The rider will call when they're close.", cta: { label: "Chat on WhatsApp", kind: "whatsapp" } };
    default:
      return null;
  }
}

/** Returns an error message, or null when the payment is valid. */
export function validatePayment(order: Pick<Order, "payments" | "total" | "status">, amount: number): string | null {
  if (order.status === "cancelled") return "This order is cancelled, so it can't take payments.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above zero.";
  const balance = balanceDue(order);
  if (amount > balance) return `That's more than the ${money(balance)} balance.`;
  return null;
}
