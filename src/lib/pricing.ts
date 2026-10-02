import { RULES, type Rules } from "../data/business";
import { isBasket, serviceById } from "../data/catalog";
import type { Handback, Intake, OrderItem, Service, Speed } from "../data/types";

/** What the customer picks for one service. */
export type ItemChoice = Pick<OrderItem, "serviceId" | "qty" | "note">;

/** Price of one unit. Quoted services have no price until the counter sets one. */
export const unitPrice = (service: Pick<Service, "kind" | "price">): number => (service.kind === "quote" ? 0 : service.price);

/** Quoted services are priced at the counter. */
export const isQuoted = (service: Pick<Service, "kind">) => service.kind === "quote";

/** How many rider trips an order needs: one to collect, one to bring back. */
export const riderTrips = (intake: Intake, handback: Handback) => (intake === "pickup" ? 1 : 0) + (handback === "delivery" ? 1 : 0);

/** The longest standard turnaround among the items, in hours. */
export function turnaroundHours(items: Pick<OrderItem, "serviceId">[]): number {
  return Math.max(24, ...items.map((item) => serviceById(item.serviceId)?.hours ?? 24));
}

/** Express is only offered when every item on the order can go through in 3 hours. */
export const canExpress = (items: Pick<OrderItem, "serviceId">[]) => items.length > 0 && items.every((item) => serviceById(item.serviceId)?.express !== false);

export interface Estimate {
  subtotal: number;
  expressFee: number;
  riderFee: number;
  /** Basket washes paid for by the client's plan, taken off the subtotal. */
  planCover: number;
  /** Baskets the plan covers on this order. */
  planBaskets: number;
  total: number;
  /** True when at least one line waits on a counter price, so the total is only what we can price so far. */
  hasQuoted: boolean;
}

export interface EstimateOptions {
  speed: Speed;
  trips: number;
  zoneFee: number;
  /** Basket washes left on the client's plan this month. Plan orders ride free. */
  planBasketsLeft?: number;
}

export function estimate(lines: { serviceId: string; unitPrice: number; qty: number }[], opts: EstimateOptions, rules: Rules = RULES): Estimate {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * Math.max(0, line.qty), 0);
  const onPlan = opts.planBasketsLeft !== undefined;
  // The plan covers the dearest baskets first, so a member never pays for a big basket while a small one rides free.
  let left = opts.planBasketsLeft ?? 0;
  let planCover = 0;
  let planBaskets = 0;
  const baskets = lines.filter((line) => isBasket(serviceById(line.serviceId))).sort((a, b) => b.unitPrice - a.unitPrice);
  for (const line of baskets) {
    const covered = Math.min(left, Math.max(0, line.qty));
    planCover += covered * line.unitPrice;
    planBaskets += covered;
    left -= covered;
  }
  const expressFee = opts.speed === "express" && lines.length > 0 ? rules.expressFee : 0;
  const riderFee = onPlan ? 0 : opts.trips * opts.zoneFee;
  return {
    subtotal,
    expressFee,
    riderFee,
    planCover,
    planBaskets,
    total: Math.max(0, subtotal - planCover) + expressFee + riderFee,
    hasQuoted: lines.some((line) => line.unitPrice === 0),
  };
}

/** A sensible first choice: one unit, or the minimum for services sold in pairs. */
export const defaultQty = (service: Pick<Service, "minQty">) => service.minQty ?? 1;
