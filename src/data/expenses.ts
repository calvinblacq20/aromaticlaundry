import type { ExpenseCategory } from "./types";

/**
 * The starting set of things the shop spends money on: what goes into every wash, what keeps the
 * machines running, and the bills that arrive whether or not anyone brings a basket.
 *
 * The owner isn't expected to use all of them. Every one can be switched off in Expenses, which
 * takes it out of the add form and the charts without touching what she has already recorded.
 */
const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: "detergent", label: "Detergent & softener", kind: "direct" },
  { id: "fragrance", label: "Fragrance", kind: "direct" },
  { id: "packaging", label: "Bags, hangers & tags", kind: "direct" },
  { id: "rider", label: "Rider & fuel", kind: "direct" },
  { id: "power", label: "Electricity & water", kind: "overhead" },
  { id: "rent", label: "Shop rent", kind: "overhead" },
  { id: "repairs", label: "Machine repairs", kind: "overhead" },
  { id: "staff", label: "Staff", kind: "overhead" },
  { id: "marketing", label: "Marketing & promos", kind: "overhead" },
];

export const defaultExpenseCategories = (): ExpenseCategory[] => DEFAULT_CATEGORIES.map((c) => ({ ...c }));

/** Every category ever offered, switched-off ones included, so old expenses still name themselves. */
const ALL = new Map<string, ExpenseCategory>(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

/** The categories the owner is using: what the add form and the charts show. */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = defaultExpenseCategories();

export function applyExpenseCategories(categories: ExpenseCategory[]) {
  for (const c of categories) ALL.set(c.id, c);
  for (const c of DEFAULT_CATEGORIES) if (!ALL.has(c.id)) ALL.set(c.id, c);
  EXPENSE_CATEGORIES.length = 0;
  EXPENSE_CATEGORIES.push(...categories.filter((c) => c.active !== false));
}

export const expenseCategory = (id: string) => ALL.get(id);
export const expenseCategoryLabel = (id: string) => ALL.get(id)?.label ?? id;
