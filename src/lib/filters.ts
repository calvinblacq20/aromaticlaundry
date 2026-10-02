import { serviceById } from "../data/catalog";
import type { Customer, LeadSource, Order, OrderStatus } from "../data/types";
import { normalizeGhPhone } from "./contact";
import { addDays, dayKey, startOfDay } from "./format";
import { balanceDue, isActive, isLate, paidTotal } from "./orders";

/* Search, filters and sorting for the owner's lists. Filters live in the URL so Back and shared links restore them. */

export const PAGE_SIZE = 20;

export type StageGroup = "booked" | "shop" | "ready" | "done" | "cancelled";

export const STAGE_GROUPS: { id: StageGroup; label: string; statuses: OrderStatus[] }[] = [
  { id: "booked", label: "Booked", statuses: ["booked"] },
  { id: "shop", label: "In the shop", statuses: ["received", "washing", "finishing"] },
  { id: "ready", label: "Ready", statuses: ["ready", "out"] },
  { id: "done", label: "Handed over", statuses: ["done"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

export const ACTIVE_GROUPS: StageGroup[] = ["booked", "shop", "ready"];

export const groupOf = (status: OrderStatus): StageGroup => STAGE_GROUPS.find((g) => g.statuses.includes(status))?.id ?? "booked";

/** Order tags the owner can narrow by: express jobs, rider runs and plan washes. */
export type OrderTag = "express" | "rider" | "plan";

export const TAG_OPTIONS: { id: OrderTag; label: string }[] = [
  { id: "express", label: "Express" },
  { id: "rider", label: "Rider pickup or delivery" },
  { id: "plan", label: "On a plan" },
];

export const hasTag = (order: Pick<Order, "speed" | "intake" | "handback" | "payChoice">, tag: OrderTag) =>
  tag === "express" ? order.speed === "express" : tag === "rider" ? order.intake === "pickup" || order.handback === "delivery" : order.payChoice === "plan";

export type PayState = "any" | "paid" | "part" | "none";
export type DueWindow = "any" | "late" | "today" | "tomorrow";
export type OrderSort = "due" | "newest" | "owed" | "client";

export const PAY_OPTIONS: { id: PayState; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "paid", label: "Paid in full" },
  { id: "part", label: "Part paid" },
  { id: "none", label: "Nothing paid" },
];

export const DUE_OPTIONS: { id: DueWindow; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "late", label: "Late" },
  { id: "today", label: "Due today" },
  { id: "tomorrow", label: "Due tomorrow" },
];

export const SORT_OPTIONS: { id: OrderSort; label: string }[] = [
  { id: "due", label: "Soonest due" },
  { id: "newest", label: "Newest" },
  { id: "owed", label: "Unpaid" },
  { id: "client", label: "Client A–Z" },
];

export interface OrderFilters {
  q: string;
  stages: StageGroup[];
  tags: OrderTag[];
  pay: PayState;
  due: DueWindow;
  /** Only orders owing at least this much. */
  owedMin: number;
  /** Only orders owing at most this much; null = no upper limit. */
  owedMax: number | null;
  sort: OrderSort;
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = { q: "", stages: ACTIVE_GROUPS, tags: [], pay: "any", due: "any", owedMin: 0, owedMax: null, sort: "due" };

const list = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));

const oneOf = <T extends string>(value: string | null, allowed: readonly { id: T }[], fallback: T): T => allowed.find((a) => a.id === value)?.id ?? fallback;

const num = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseOrderFilters(params: URLSearchParams): OrderFilters {
  const stageParam = params.get("stage");
  return {
    q: params.get("q")?.slice(0, 80) ?? "",
    stages: stageParam === null ? ACTIVE_GROUPS : list(stageParam, STAGE_GROUPS.map((g) => g.id)),
    tags: list(params.get("tag"), TAG_OPTIONS.map((t) => t.id)),
    pay: oneOf(params.get("pay"), PAY_OPTIONS, "any"),
    due: oneOf(params.get("due"), DUE_OPTIONS, "any"),
    owedMin: num(params.get("owedMin")) ?? 0,
    owedMax: num(params.get("owedMax")),
    sort: oneOf(params.get("sort"), SORT_OPTIONS, "due"),
  };
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v));

/** Only non-default values go in the URL. */
export function orderFiltersToParams(f: OrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (!sameList(f.stages, ACTIVE_GROUPS)) params.set("stage", f.stages.join(","));
  if (f.tags.length) params.set("tag", f.tags.join(","));
  if (f.pay !== "any") params.set("pay", f.pay);
  if (f.due !== "any") params.set("due", f.due);
  if (f.owedMin > 0) params.set("owedMin", String(f.owedMin));
  if (f.owedMax !== null) params.set("owedMax", String(f.owedMax));
  if (f.sort !== "due") params.set("sort", f.sort);
  return params;
}

/** How many filters differ from the defaults (search and sort don't count). */
export function activeFilterCount(f: OrderFilters): number {
  return [!sameList(f.stages, ACTIVE_GROUPS), f.tags.length > 0, f.pay !== "any", f.due !== "any", f.owedMin > 0 || f.owedMax !== null].filter(Boolean).length;
}

/** Name, phone in any Ghana format, order number (AL-1042, 1042) or service. */
export function matchesQuery(order: Pick<Order, "number" | "items">, customer: Pick<Customer, "name" | "phone"> | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (customer?.name.toLowerCase().includes(q)) return true;
  const numberQuery = q.replace(/^al[\s-]*/, "");
  if (/^\d+$/.test(numberQuery) && order.number.replace(/\D/g, "").includes(numberQuery)) return true;
  const digits = q.replace(/\D/g, "");
  if (customer && digits.length >= 3) {
    const phone = normalizeGhPhone(customer.phone) ?? customer.phone.replace(/\D/g, "");
    const needle = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("233") ? digits.slice(3) : digits;
    if (needle && phone.includes(needle)) return true;
  }
  return order.items.some((item) => serviceById(item.serviceId)?.name.toLowerCase().includes(q));
}

function payState(order: Pick<Order, "payments" | "total">): Exclude<PayState, "any"> {
  const paid = paidTotal(order);
  if (paid === 0) return "none";
  return balanceDue(order) === 0 ? "paid" : "part";
}

function inDueWindow(order: Order, due: DueWindow, now: Date): boolean {
  if (due === "any") return true;
  if (due === "late") return isLate(order, now);
  const day = dayKey(addDays(startOfDay(now), due === "today" ? 0 : 1));
  return isActive(order) && order.readyAt.slice(0, 10) === day;
}

export function filterOrders(orders: Order[], customers: Customer[], f: OrderFilters, now: Date, ignoreStages = false): Order[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const allowed = new Set(STAGE_GROUPS.filter((g) => f.stages.includes(g.id)).flatMap((g) => g.statuses));
  return orders.filter((o) => {
    if (!ignoreStages && !allowed.has(o.status)) return false;
    if (f.tags.length && !f.tags.every((tag) => hasTag(o, tag))) return false;
    if (f.pay !== "any" && payState(o) !== f.pay) return false;
    if (!inDueWindow(o, f.due, now)) return false;
    const owed = balanceDue(o);
    if (owed < f.owedMin) return false;
    if (f.owedMax !== null && owed > f.owedMax) return false;
    return matchesQuery(o, byId.get(o.customerId), f.q);
  });
}

/** Result counts per stage group with every other filter applied, for the filter panel. */
export function stageCounts(orders: Order[], customers: Customer[], f: OrderFilters, now: Date): Record<StageGroup, number> {
  const counts: Record<StageGroup, number> = { booked: 0, shop: 0, ready: 0, done: 0, cancelled: 0 };
  for (const order of filterOrders(orders, customers, f, now, true)) counts[groupOf(order.status)]++;
  return counts;
}

export function sortOrders(orders: Order[], sort: OrderSort, customers: Customer[]): Order[] {
  const name = new Map(customers.map((c) => [c.id, c.name]));
  const finished = (o: Order) => (isActive(o) ? 0 : 1);
  const copy = [...orders];
  switch (sort) {
    case "due":
      return copy.sort((a, b) => finished(a) - finished(b) || a.readyAt.localeCompare(b.readyAt) || a.number.localeCompare(b.number));
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "owed":
      return copy.sort((a, b) => balanceDue(b) - balanceDue(a) || a.readyAt.localeCompare(b.readyAt));
    case "client":
      return copy.sort((a, b) => (name.get(a.customerId) ?? "").localeCompare(name.get(b.customerId) ?? "") || b.createdAt.localeCompare(a.createdAt));
  }
}

/* ---------------- Clients ---------------- */

export interface ClientRow {
  customer: Customer;
  orders: number;
  active: number;
  spend: number;
  owed: number;
  onPlan: boolean;
  lastOrderAt?: string;
}

/** `planCustomerIds`: clients with a running plan, for the badge and the filter. */
export function clientRows(customers: Customer[], orders: Order[], planCustomerIds: ReadonlySet<string> = new Set()): ClientRow[] {
  const rows = new Map<string, ClientRow>(customers.map((c) => [c.id, { customer: c, orders: 0, active: 0, spend: 0, owed: 0, onPlan: planCustomerIds.has(c.id) }]));
  for (const order of orders) {
    const row = rows.get(order.customerId);
    if (!row) continue;
    row.orders++;
    row.spend += paidTotal(order);
    if (isActive(order) && order.status !== "booked") row.owed += balanceDue(order);
    if (isActive(order)) row.active++;
    if (!row.lastOrderAt || order.createdAt > row.lastOrderAt) row.lastOrderAt = order.createdAt;
  }
  return [...rows.values()];
}

export type ClientSort = "recent" | "spend" | "owed" | "name";

export const CLIENT_SORT_OPTIONS: { id: ClientSort; label: string }[] = [
  { id: "recent", label: "Last order" },
  { id: "spend", label: "Most spent" },
  { id: "owed", label: "Balance owed" },
  { id: "name", label: "Name A–Z" },
];

export interface ClientFilters {
  q: string;
  towns: string[];
  sources: LeadSource[];
  owes: boolean;
  activeOnly: boolean;
  planOnly: boolean;
  sort: ClientSort;
}

export const DEFAULT_CLIENT_FILTERS: ClientFilters = { q: "", towns: [], sources: [], owes: false, activeOnly: false, planOnly: false, sort: "recent" };

export function parseClientFilters(params: URLSearchParams): ClientFilters {
  return {
    q: params.get("q")?.slice(0, 80) ?? "",
    towns: (params.get("town") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    sources: list(params.get("source"), ["tiktok", "whatsapp", "walkin", "referral", "app"] as const),
    owes: params.get("owes") === "1",
    activeOnly: params.get("active") === "1",
    planOnly: params.get("plan") === "1",
    sort: oneOf(params.get("sort"), CLIENT_SORT_OPTIONS, "recent"),
  };
}

export function clientFiltersToParams(f: ClientFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.towns.length) params.set("town", f.towns.join(","));
  if (f.sources.length) params.set("source", f.sources.join(","));
  if (f.owes) params.set("owes", "1");
  if (f.activeOnly) params.set("active", "1");
  if (f.planOnly) params.set("plan", "1");
  if (f.sort !== "recent") params.set("sort", f.sort);
  return params;
}

export function filterClients(rows: ClientRow[], f: ClientFilters): ClientRow[] {
  const q = f.q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const needle = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("233") ? digits.slice(3) : digits;
  const filtered = rows.filter(({ customer: c, owed, active, onPlan }) => {
    if (f.towns.length && !f.towns.includes(c.town)) return false;
    if (f.sources.length && !f.sources.includes(c.source ?? "app")) return false;
    if (f.owes && owed <= 0) return false;
    if (f.activeOnly && active === 0) return false;
    if (f.planOnly && !onPlan) return false;
    if (!q) return true;
    if (c.name.toLowerCase().includes(q) || c.town.toLowerCase().includes(q)) return true;
    const phone = normalizeGhPhone(c.phone) ?? c.phone.replace(/\D/g, "");
    return needle.length >= 3 && phone.includes(needle);
  });
  switch (f.sort) {
    case "recent":
      return filtered.sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
    case "spend":
      return filtered.sort((a, b) => b.spend - a.spend);
    case "owed":
      return filtered.sort((a, b) => b.owed - a.owed || b.spend - a.spend);
    case "name":
      return filtered.sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }
}
