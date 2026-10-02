import { ZONES } from "../data/business";
import { CATEGORIES, serviceById } from "../data/catalog";
import type { CategoryId, Customer, LeadSource, Order, OrderStatus, Payment, PaymentMethod } from "../data/types";
import { addDays, dayKey, monthShort, parseLocal, startOfDay } from "./format";
import { IN_SHOP, isInShop, isLate } from "./orders";
import { METHOD_LABEL, SOURCE_LABEL } from "./shop";

/* Numbers for the owner's dashboard and reports. Every function is pure: data in, numbers out. */

export type PeriodId = "7d" | "30d" | "90d" | "year";

export const PERIODS: { id: PeriodId; label: string; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7 days" },
  { id: "30d", label: "Last 30 days", short: "30 days" },
  { id: "90d", label: "Last 90 days", short: "90 days" },
  { id: "year", label: "Last 12 months", short: "12 months" },
];

export const periodLabel = (id: PeriodId) => PERIODS.find((p) => p.id === id)?.label ?? "";
export const isPeriodId = (value: string | null): value is PeriodId => PERIODS.some((p) => p.id === value);

/** Half-open time range: start ≤ t < end. */
export interface Range {
  start: Date;
  end: Date;
}

export interface Bucket extends Range {
  label: string;
}

const DAYS: Record<Exclude<PeriodId, "year">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function periodRange(id: PeriodId, now: Date): Range {
  const end = addDays(startOfDay(now), 1);
  if (id === "year") return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end };
  return { start: addDays(end, -DAYS[id]), end };
}

/** The period of the same length just before this one. */
export function previousRange(id: PeriodId, range: Range): Range {
  if (id === "year") return { start: new Date(range.start.getFullYear(), range.start.getMonth() - 12, 1), end: range.start };
  return { start: addDays(range.start, -DAYS[id]), end: range.start };
}

/** Days for 7 and 30 days, weeks for 90 days, months for a year. */
export function bucketsFor(id: PeriodId, range: Range): Bucket[] {
  const buckets: Bucket[] = [];
  if (id === "year") {
    for (let i = 0; i < 12; i++) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1);
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({ start, end: next < range.end ? next : range.end, label: monthShort(start) });
    }
    return buckets;
  }
  const step = id === "90d" ? 7 : 1;
  for (let start = range.start; start < range.end; start = addDays(start, step)) {
    const next = addDays(start, step);
    buckets.push({ start, end: next < range.end ? next : range.end, label: `${start.getDate()} ${monthShort(start)}` });
  }
  return buckets;
}

const inRange = (iso: string, r: Range) => {
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
};

/** Where an order stood at a moment in time, from its history. */
export function statusAt(order: Pick<Order, "history">, at: Date): OrderStatus | null {
  let status: OrderStatus | null = null;
  for (const event of order.history) {
    if (new Date(event.at) <= at) status = event.status;
  }
  return status;
}

/* ---------------- Metrics ---------------- */

export type MetricId = "cash" | "newOrders" | "owed" | "collected" | "avgOrder" | "onTime";
export type MetricFormat = "money" | "count" | "percent";

export interface MetricDef {
  id: MetricId;
  label: string;
  /** Which direction is good news. */
  good: "up" | "down";
  format: MetricFormat;
  /** Short line under the chart. */
  hint: string;
}

export const METRICS: Record<MetricId, MetricDef> = {
  cash: { id: "cash", label: "Cash received", good: "up", format: "money", hint: "Every payment, plans included: MoMo, cash, bank and card" },
  newOrders: { id: "newOrders", label: "New orders", good: "up", format: "count", hint: "App bookings, WhatsApp orders and counter drop-offs" },
  owed: { id: "owed", label: "Unpaid", good: "down", format: "money", hint: "Balances on laundry that's in the shop or waiting to go home" },
  collected: { id: "collected", label: "Handed over", good: "up", format: "count", hint: "Orders collected at the counter or delivered" },
  avgOrder: { id: "avgOrder", label: "Average order", good: "up", format: "money", hint: "Average total of orders taken" },
  onTime: { id: "onTime", label: "On time", good: "up", format: "percent", hint: "Orders ready by the time we promised" },
};

/** Balance owed at a moment: laundry checked in and not yet handed over, minus what had been paid by then. */
export function owedAt(orders: Order[], at: Date): number {
  let sum = 0;
  for (const order of orders) {
    const status = statusAt(order, at);
    if (!status || status === "booked" || status === "done" || status === "cancelled") continue;
    const paid = order.payments.reduce((s, p) => (new Date(p.at) <= at ? s + p.amount : s), 0);
    sum += Math.max(0, order.total - paid);
  }
  return sum;
}

function readyOnTime(orders: Order[], r: Range): { ready: number; onTime: number } {
  let ready = 0;
  let onTime = 0;
  for (const order of orders) {
    const event = order.history.find((h) => h.status === "ready");
    if (!event || !inRange(event.at, r)) continue;
    ready++;
    if (new Date(event.at) <= parseLocal(order.readyAt)) onTime++;
  }
  return { ready, onTime };
}

/** The metric's value for a range. Snapshot metrics (balance owed) read the moment the range ends, capped at now. */
export function metricValue(id: MetricId, orders: Order[], r: Range, now: Date, planPayments: Payment[] = []): number | null {
  switch (id) {
    case "cash":
      return orders.reduce((sum, o) => sum + o.payments.reduce((s, p) => (inRange(p.at, r) ? s + p.amount : s), 0), 0) + planPayments.reduce((s, p) => (inRange(p.at, r) ? s + p.amount : s), 0);
    case "newOrders":
      return orders.filter((o) => inRange(o.createdAt, r)).length;
    case "collected":
      return orders.filter((o) => o.history.some((h) => h.status === "done" && inRange(h.at, r))).length;
    case "avgOrder": {
      const taken = orders.filter((o) => inRange(o.createdAt, r) && o.status !== "cancelled" && o.payChoice !== "plan");
      return taken.length ? Math.round(taken.reduce((s, o) => s + o.total, 0) / taken.length) : null;
    }
    case "onTime": {
      const { ready, onTime } = readyOnTime(orders, r);
      return ready ? Math.round((onTime / ready) * 100) : null;
    }
    case "owed":
      return owedAt(orders, r.end < now ? r.end : now);
  }
}

export function metricSeries(id: MetricId, orders: Order[], buckets: Bucket[], now: Date, planPayments: Payment[] = []): (number | null)[] {
  return buckets.map((b) => (b.start > now ? null : metricValue(id, orders, b, now, planPayments)));
}

export type Tone = "good" | "bad" | "neutral";

export interface Delta {
  /** Fractional change, e.g. 0.12 for +12%. Null when there's nothing to compare with. */
  change: number | null;
  direction: "up" | "down" | "flat";
  tone: Tone;
}

export function delta(current: number | null, previous: number | null, good: "up" | "down"): Delta {
  if (current === null || previous === null) return { change: null, direction: "flat", tone: "neutral" };
  if (current === previous) return { change: 0, direction: "flat", tone: "neutral" };
  const direction = current > previous ? "up" : "down";
  const change = previous === 0 ? null : (current - previous) / Math.abs(previous);
  if (change !== null && Math.abs(change) < 0.005) return { change: 0, direction: "flat", tone: "neutral" };
  return { change, direction, tone: direction === good ? "good" : "bad" };
}

export interface Kpi {
  def: MetricDef;
  value: number | null;
  previous: number | null;
  delta: Delta;
  series: (number | null)[];
  previousSeries: (number | null)[];
}

export function kpi(id: MetricId, orders: Order[], period: PeriodId, now: Date, planPayments: Payment[] = []): Kpi {
  const range = periodRange(period, now);
  const prev = previousRange(period, range);
  const def = METRICS[id];
  const value = metricValue(id, orders, range, now, planPayments);
  const previous = metricValue(id, orders, prev, now, planPayments);
  return {
    def,
    value,
    previous,
    delta: delta(value, previous, def.good),
    series: metricSeries(id, orders, bucketsFor(period, range), now, planPayments),
    previousSeries: metricSeries(id, orders, bucketsFor(period, prev), now, planPayments),
  };
}

/* ---------------- The floor right now ---------------- */

export interface Floor {
  inShop: number;
  stages: { status: OrderStatus; count: number }[];
  late: number;
  /** Ready and waiting: on the shelf, or with the rider. */
  ready: number;
  /** In the shop and promised for later today. */
  dueToday: number;
  /** Booked pickups and drop-offs still to arrive today. */
  arrivingToday: number;
  express: number;
}

export function floorNow(orders: Order[], now: Date): Floor {
  const today = dayKey(now);
  const shop = orders.filter(isInShop);
  return {
    inShop: shop.length,
    stages: IN_SHOP.map((status) => ({ status, count: shop.filter((o) => o.status === status).length })),
    late: shop.filter((o) => isLate(o, now)).length,
    ready: orders.filter((o) => o.status === "ready" || o.status === "out").length,
    dueToday: shop.filter((o) => o.readyAt.slice(0, 10) === today).length,
    arrivingToday: orders.filter((o) => o.status === "booked" && o.inAt.slice(0, 10) === today).length,
    express: shop.filter((o) => o.speed === "express").length,
  };
}

export interface HourLoad {
  hour: number;
  label: string;
  count: number;
}

/** Orders in the shop due in each remaining hour of today: the counter's afternoon at a glance. */
export function dueByHour(orders: Order[], now: Date, from = 7, to = 21): HourLoad[] {
  const today = dayKey(now);
  const shop = orders.filter((o) => isInShop(o) && o.readyAt.slice(0, 10) === today);
  return Array.from({ length: to - from }, (_, i) => {
    const hour = from + i;
    return { hour, label: `${String(hour).padStart(2, "0")}:00`, count: shop.filter((o) => parseLocal(o.readyAt).getHours() === hour).length };
  });
}

/* ---------------- Rankings and shares ---------------- */

export interface Share<K extends string = string> {
  key: K;
  label: string;
  value: number;
  share: number;
  count: number;
}

function toShares<K extends string>(totals: Map<K, { value: number; count: number }>, label: (key: K) => string): Share<K>[] {
  const sum = [...totals.values()].reduce((s, t) => s + t.value, 0);
  return [...totals.entries()]
    .map(([key, t]) => ({ key, label: label(key), value: t.value, count: t.count, share: sum ? t.value / sum : 0 }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function tally<K extends string>(entries: [K, number][]) {
  const totals = new Map<K, { value: number; count: number }>();
  for (const [key, value] of entries) {
    const t = totals.get(key) ?? { value: 0, count: 0 };
    t.value += value;
    t.count += 1;
    totals.set(key, t);
  }
  return totals;
}

const takenIn = (orders: Order[], r: Range) => orders.filter((o) => inRange(o.createdAt, r) && o.status !== "cancelled");

/** Services by the number of orders that carried them. */
export function topServices(orders: Order[], r: Range): Share[] {
  const entries = takenIn(orders, r).flatMap((o) => [...new Set(o.items.map((i) => i.serviceId))].map((id): [string, number] => [id, 1]));
  return toShares(tally(entries), (id) => serviceById(id)?.name ?? "Laundry");
}

/** Takings by part of the price list, from what was sold (plan baskets at list price). */
export function categoryShares(orders: Order[], r: Range): Share<CategoryId>[] {
  const entries = takenIn(orders, r).flatMap((o) => o.items.map((i): [CategoryId, number] => [serviceById(i.serviceId)?.category ?? "baskets", i.unitPrice * i.qty]));
  return toShares(tally(entries), (k) => CATEGORIES.find((c) => c.id === k)?.short ?? k);
}

export function leadSources(orders: Order[], customers: Customer[], r: Range): Share<LeadSource>[] {
  const sourceOf = new Map(customers.map((c) => [c.id, c.source ?? "app"]));
  return toShares(tally(takenIn(orders, r).map((o): [LeadSource, number] => [sourceOf.get(o.customerId) ?? "app", 1])), (k) => SOURCE_LABEL[k]);
}

/** Where the rider goes: orders picked up or delivered, by zone. */
export function zoneShares(orders: Order[], r: Range): Share[] {
  const entries = takenIn(orders, r).flatMap((o): [string, number][] => (o.zoneId ? [[o.zoneId, 1]] : []));
  return toShares(tally(entries), (id) => ZONES.find((z) => z.id === id)?.name ?? "Other");
}

/** How orders reach the counter and go home. */
export function handoverShares(orders: Order[], r: Range): Share<"counter" | "rider">[] {
  const entries = takenIn(orders, r).map((o): ["counter" | "rider", number] => [o.intake === "pickup" || o.handback === "delivery" ? "rider" : "counter", 1]);
  return toShares(tally(entries), (k) => (k === "rider" ? "Rider pickup or delivery" : "Counter only"));
}

/** Share of orders that took express. */
export function expressShare(orders: Order[], r: Range): number | null {
  const taken = takenIn(orders, r);
  return taken.length ? taken.filter((o) => o.speed === "express").length / taken.length : null;
}

export function paymentsByMethod(orders: Order[], r: Range, planPayments: Payment[] = []): Share<PaymentMethod>[] {
  const entries = [...orders.flatMap((o) => o.payments), ...planPayments].filter((p) => inRange(p.at, r)).map((p): [PaymentMethod, number] => [p.method, p.amount]);
  return toShares(tally(entries), (k) => METHOD_LABEL[k]);
}

export interface ClientSpend {
  customer: Customer;
  amount: number;
  orders: number;
}

export function topClients(orders: Order[], customers: Customer[], r: Range): ClientSpend[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const totals = new Map<string, { amount: number; orders: Set<string> }>();
  for (const order of orders) {
    for (const p of order.payments) {
      if (!inRange(p.at, r)) continue;
      const t = totals.get(order.customerId) ?? { amount: 0, orders: new Set<string>() };
      t.amount += p.amount;
      t.orders.add(order.id);
      totals.set(order.customerId, t);
    }
  }
  return [...totals.entries()]
    .flatMap(([id, t]) => {
      const customer = byId.get(id);
      return customer ? [{ customer, amount: t.amount, orders: t.orders.size }] : [];
    })
    .sort((a, b) => b.amount - a.amount);
}

/* ---------------- Formatting ---------------- */

/** GH₵ 18.4k for chart axes and small cards. */
export function compactMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `GH₵ ${trim(amount / 1_000_000)}m`;
  if (abs >= 1_000) return `GH₵ ${trim(amount / 1_000)}k`;
  return `GH₵ ${Math.round(amount)}`;
}

const trim = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

export function formatPercentChange(change: number | null): string {
  if (change === null) return "new";
  if (change === 0) return "no change";
  return `${Math.round(Math.abs(change) * 100)}%`;
}
