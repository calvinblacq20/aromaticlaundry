import { serviceById } from "../data/catalog";
import type { OrderItem, Service } from "../data/types";
import { money } from "./format";

/** "About 10–15 clothes", "Per shirt", "Priced at the counter", plus the line's note. */
export function itemSummary(item: Pick<OrderItem, "note">, service: Pick<Service, "kind" | "unit" | "capacity"> | undefined): string {
  const parts: string[] = [];
  if (service?.capacity) parts.push(service.capacity);
  else if (service?.kind === "quote") parts.push("Priced at the counter");
  else if (service) parts.push(`Per ${service.unit}`);
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

/** "Medium basket × 2 + 1 more" */
export function orderTitle(order: { items: Pick<OrderItem, "serviceId" | "qty">[] }): string {
  const first = order.items[0];
  const name = first ? (serviceById(first.serviceId)?.name ?? "Laundry") : "Laundry";
  const qty = first && first.qty > 1 ? ` × ${first.qty}` : "";
  const more = order.items.length > 1 ? ` + ${order.items.length - 1} more` : "";
  return `${name}${qty}${more}`;
}

const pluralUnit = (noun: string) => (/(s|x|sh|ch)$/.test(noun) ? `${noun}es` : `${noun}s`);

/** Units in words: "2 baskets", "5 shirts", "1 suit", "2 bundles of 4". */
export function unitCount(item: Pick<OrderItem, "qty">, service: Pick<Service, "unit"> | undefined): string {
  const unit = service?.unit ?? "item";
  const [noun = "item", ...rest] = unit.split(" ");
  const tail = rest.length ? ` ${rest.join(" ")}` : "";
  return `${item.qty} ${item.qty === 1 ? noun : pluralUnit(noun)}${tail}`;
}

/** How many baskets an order carries, for the counter's daily load count. */
export function basketCount(order: { items: Pick<OrderItem, "serviceId" | "qty">[] }): number {
  return order.items.reduce((sum, item) => (serviceById(item.serviceId)?.category === "baskets" ? sum + item.qty : sum), 0);
}

/** "About 6–8 clothes · ready in 24 hours", "Per shirt · ready in 24 hours", "Priced at the counter · ready in 4 days". */
export function serviceLine(service: Pick<Service, "capacity" | "kind" | "unit" | "hours">): string {
  const lead = service.capacity ?? (service.kind === "quote" ? "Priced at the counter" : `Per ${service.unit}`);
  const ready = service.hours <= 24 ? "ready in 24 hours" : service.hours % 24 === 0 ? `ready in ${service.hours / 24} days` : `ready in ${service.hours} hours`;
  return `${lead} · ${ready}`;
}

/** "GH₵ 50", or "Priced at the counter" for quoted services. */
export const servicePrice = (service: Pick<Service, "kind" | "price">) => (service.kind === "quote" ? "Priced at the counter" : money(service.price));
