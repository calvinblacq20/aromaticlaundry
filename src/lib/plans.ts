import { planById } from "../data/catalog";
import type { Order, Plan, Subscription } from "../data/types";
import { addDays, dayKey, parseLocal, startOfDay } from "./format";
import { basketCount } from "./items";

/** The same day next month, held to the month's last day (31 Jan → 28 Feb). */
export function addMonth(day: Date): Date {
  const target = new Date(day.getFullYear(), day.getMonth() + 1, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(day.getDate(), last));
}

/** Basket washes a subscription has used this month: covered baskets on plan orders placed in the period, cancelled ones aside. */
export function basketsUsed(subscription: Pick<Subscription, "id" | "periodStart" | "renewsOn">, orders: Pick<Order, "subscriptionId" | "createdAt" | "status" | "items">[]): number {
  return orders.reduce((sum, order) => {
    if (order.subscriptionId !== subscription.id || order.status === "cancelled") return sum;
    const placed = dayKey(new Date(order.createdAt));
    return placed >= subscription.periodStart && placed < subscription.renewsOn ? sum + basketCount(order) : sum;
  }, 0);
}

export interface PlanStatus {
  plan: Plan | undefined;
  used: number;
  left: number;
  /** Days until the plan renews (0 = today). */
  renewsIn: number;
  /** The month has run out and the renewal isn't paid. */
  lapsed: boolean;
}

export function planStatus(subscription: Subscription, orders: Order[], now: Date): PlanStatus {
  const plan = planById(subscription.planId);
  const used = basketsUsed(subscription, orders);
  const allowance = plan?.baskets ?? 0;
  const renewsIn = Math.round((parseLocal(subscription.renewsOn).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const lapsed = renewsIn < 0;
  return { plan, used, left: lapsed ? 0 : Math.max(0, allowance - used), renewsIn, lapsed };
}

/** The live subscription for a client: active, with the month still running. */
export function activeSubscription(subscriptions: Subscription[], customerId: string | null | undefined, now: Date): Subscription | undefined {
  if (!customerId) return undefined;
  const today = dayKey(now);
  return subscriptions.find((s) => s.customerId === customerId && s.status === "active" && s.renewsOn > today);
}

/**
 * The month a renewal pays for. Renewing on or up to a week after the renewal day carries on from
 * where the month ended. Renewing early (or long after it lapsed) starts a fresh month today, so the
 * period always covers today and every plan order counts against it.
 */
export function renewedPeriod(subscription: Pick<Subscription, "renewsOn">, now: Date): { periodStart: string; renewsOn: string } {
  const today = startOfDay(now);
  const end = parseLocal(subscription.renewsOn);
  const from = end <= today && end >= addDays(today, -7) ? end : today;
  return { periodStart: dayKey(from), renewsOn: dayKey(addMonth(from)) };
}

/** A renewal worth a reminder: the plan runs out in the next three days and the client hasn't cancelled. */
export function renewalDue(subscription: Pick<Subscription, "status" | "endsAtRenewal" | "renewsOn">, now: Date): boolean {
  if (subscription.status !== "active" || subscription.endsAtRenewal) return false;
  const days = Math.round((parseLocal(subscription.renewsOn).getTime() - startOfDay(now).getTime()) / 86_400_000);
  return days >= 0 && days <= 3;
}
