import type { CarePrefs, CategoryId, Finish, Plan, Scent, Service, Starch } from "./types";

export const CATEGORIES: { id: CategoryId; label: string; short: string; blurb: string }[] = [
  { id: "baskets", label: "Wash, dry, fold & iron", short: "Baskets", blurb: "Priced per basket, everything in it washed, dried, ironed and folded" },
  { id: "ironing", label: "Ironing only", short: "Ironing", blurb: "Already washed? We press it, per item" },
  { id: "suits", label: "Suits, kente & special garments", short: "Suits & kente", blurb: "Cleaned and pressed one by one, by hand" },
  { id: "home", label: "Bedding & home", short: "Bedding", blurb: "Duvets, sheets, curtains and towels" },
  { id: "care", label: "Stain rescue", short: "Stains", blurb: "Palm oil, wine, ink and food, treated before the wash" },
];

export const FINISH_OPTIONS: { id: Finish; label: string; hint: string }[] = [
  { id: "fold", label: "Folded", hint: "Ironed and folded into your bag" },
  { id: "hang", label: "On hangers", hint: "Shirts and dresses pressed onto hangers" },
];

export const STARCH_OPTIONS: { id: Starch; label: string; hint: string }[] = [
  { id: "none", label: "No starch", hint: "Soft, the way it came off the line" },
  { id: "light", label: "Light", hint: "A crisp collar, still soft to wear" },
  { id: "firm", label: "Firm", hint: "Sharp creases for suits and uniforms" },
];

export const SCENT_OPTIONS: { id: Scent; label: string; hint: string }[] = [
  { id: "signature", label: "Aromatic signature", hint: "The house scent, the one people ask about" },
  { id: "lavender", label: "Lavender", hint: "Soft and calming" },
  { id: "fresh-linen", label: "Fresh linen", hint: "Clean and light" },
  { id: "unscented", label: "Unscented", hint: "For sensitive skin and babies" },
];

export const DEFAULT_CARE: CarePrefs = { finish: "fold", starch: "none", scent: "signature" };

/**
 * The starting price list. The three baskets and the ironing range come straight from the shop's
 * own price list (TikTok, 8 June 2026): small GH₵ 50, medium GH₵ 80, big GH₵ 120, ironing GH₵ 5–10
 * per item. Everything else is a sample for the owner to confirm in Services & prices.
 */
const DEFAULT_SERVICES: Service[] = [
  // ── Wash, dry, fold & iron ────────────────────────────────────────────────
  {
    id: "small-basket",
    name: "Small basket",
    category: "baskets",
    description: "Washed, dried, ironed and folded. Right for one person's few days, or the clothes you need back by tonight.",
    kind: "fixed",
    price: 50,
    unit: "basket",
    capacity: "About 6–8 clothes",
    hours: 24,
    express: true,
    featured: true,
    tone: "sky",
    photo: "/photos/basket-small.webp",
  },
  {
    id: "medium-basket",
    name: "Medium basket",
    category: "baskets",
    description: "A full week for one, or a couple's work clothes. Everything washed, dried, ironed and folded.",
    kind: "fixed",
    price: 80,
    unit: "basket",
    capacity: "About 10–15 clothes",
    hours: 24,
    express: true,
    featured: true,
    tone: "aqua",
    photo: "/photos/folded-stack.webp",
  },
  {
    id: "big-basket",
    name: "Big basket",
    category: "baskets",
    description: "The family load. The biggest basket on the list, packed full and still washed, dried, ironed and folded.",
    kind: "fixed",
    price: 120,
    unit: "basket",
    capacity: "About 20–35 clothes",
    hours: 24,
    express: true,
    featured: true,
    tone: "steel",
    photo: "/photos/basket-big.webp",
  },

  // ── Ironing only ──────────────────────────────────────────────────────────
  {
    id: "iron-shirt",
    name: "Shirt or blouse",
    category: "ironing",
    description: "Pressed and returned on a hanger or folded, the way you choose.",
    kind: "fixed",
    price: 5,
    unit: "shirt",
    hours: 24,
    express: true,
    featured: true,
    tone: "mist",
    photo: "/photos/shirts-pressed.webp",
  },
  {
    id: "iron-trousers",
    name: "Trousers or skirt",
    category: "ironing",
    description: "A sharp crease down the front, or a flat press for skirts.",
    kind: "fixed",
    price: 5,
    unit: "item",
    hours: 24,
    express: true,
    tone: "sand",
    photo: "/photos/trousers.webp",
  },
  {
    id: "iron-dress",
    name: "Dress, kaba or slit",
    category: "ironing",
    description: "Pressed with care around the embroidery, pleats and lace.",
    kind: "fixed",
    price: 8,
    unit: "item",
    hours: 24,
    express: true,
    tone: "blush",
    photo: "/photos/dress.webp",
  },
  {
    id: "iron-native",
    name: "Kaftan or native set",
    category: "ironing",
    description: "Top and bottom pressed as a set, embroidery steamed rather than flattened.",
    kind: "fixed",
    price: 10,
    unit: "set",
    hours: 24,
    express: true,
    tone: "lilac",
    photo: "/photos/kaftan.webp",
  },

  // ── Suits, kente & special garments ──────────────────────────────────────
  {
    id: "suit",
    name: "Suit, two-piece",
    category: "suits",
    description: "Jacket and trousers cleaned, steamed and pressed one by one, returned on a hanger in a cover.",
    kind: "fixed",
    price: 60,
    unit: "suit",
    hours: 48,
    express: false,
    featured: true,
    tone: "charcoal",
    photo: "/photos/suit-care.webp",
  },
  {
    id: "blazer",
    name: "Jacket or blazer",
    category: "suits",
    description: "Cleaned and pressed with the shoulders kept in shape.",
    kind: "fixed",
    price: 35,
    unit: "jacket",
    hours: 48,
    express: false,
    tone: "steel",
    photo: "/photos/blazer.webp",
  },
  {
    id: "kente",
    name: "Kente cloth",
    category: "suits",
    description: "Hand-washed cold, dried flat and pressed through a cloth so the weave and colours keep their life.",
    kind: "fixed",
    price: 80,
    unit: "cloth",
    hours: 72,
    express: false,
    featured: true,
    tone: "aqua",
    photo: "/photos/kente.webp",
  },
  {
    id: "agbada",
    name: "Agbada or three-piece native",
    category: "suits",
    description: "All three pieces cleaned and pressed together, embroidery steamed.",
    kind: "fixed",
    price: 50,
    unit: "set",
    hours: 48,
    express: false,
    tone: "sand",
    photo: "/photos/agbada.webp",
  },
  {
    id: "gown",
    name: "Wedding gown or heavy beading",
    category: "suits",
    description: "Lace, beads, trains and leather need a look first. Bring it in and we price it at the counter.",
    kind: "quote",
    price: 0,
    unit: "piece",
    hours: 96,
    express: false,
    tone: "blush",
    photo: "/photos/gown.webp",
  },

  // ── Bedding & home ────────────────────────────────────────────────────────
  {
    id: "duvet",
    name: "Duvet",
    category: "home",
    description: "Washed and tumble-dried right through, so it comes back light and full.",
    kind: "fixed",
    price: 70,
    unit: "duvet",
    hours: 48,
    express: false,
    tone: "sky",
    photo: "/photos/bedding.webp",
  },
  {
    id: "bedsheet-set",
    name: "Bedsheet set",
    category: "home",
    description: "Sheet and pillowcases washed, pressed flat and folded together.",
    kind: "fixed",
    price: 30,
    unit: "set",
    hours: 24,
    express: true,
    tone: "mist",
    photo: "/photos/bedsheets.webp",
  },
  {
    id: "curtains",
    name: "Curtains",
    category: "home",
    description: "Washed, dried and pressed, ready to hang. Priced per panel.",
    kind: "fixed",
    price: 25,
    unit: "panel",
    minQty: 2,
    hours: 48,
    express: false,
    tone: "lilac",
    photo: "/photos/curtains.webp",
  },
  {
    id: "towels",
    name: "Towels",
    category: "home",
    description: "Washed hot and dried soft. Priced per bundle of four.",
    kind: "fixed",
    price: 20,
    unit: "bundle of 4",
    hours: 24,
    express: true,
    tone: "aqua",
    photo: "/photos/towels.webp",
  },

  // ── Stain rescue ──────────────────────────────────────────────────────────
  {
    id: "stain",
    name: "Stain rescue",
    category: "care",
    description: "Palm oil, red wine, ink, sauce and sweat marks broken down by hand before the wash. Not every stain means the end of an outfit.",
    kind: "fixed",
    price: 15,
    unit: "item",
    hours: 24,
    express: false,
    featured: true,
    tone: "sand",
    photo: "/photos/stain-treatment.webp",
  },
];

export const defaultServices = (): Service[] => DEFAULT_SERVICES.map((service) => ({ ...service }));

/** The price list clients see: every service the owner hasn't hidden. `applyServices` keeps it in step with the store. */
export const SERVICES: Service[] = defaultServices();

/** Every service ever offered, hidden ones included, so past orders still show their name. */
const ALL_SERVICES = new Map<string, Service>(SERVICES.map((s) => [s.id, s]));

export function applyServices(services: Service[]) {
  ALL_SERVICES.clear();
  for (const service of services) ALL_SERVICES.set(service.id, service);
  for (const service of DEFAULT_SERVICES) if (!ALL_SERVICES.has(service.id)) ALL_SERVICES.set(service.id, service);
  SERVICES.length = 0;
  SERVICES.push(...services.filter((s) => s.active !== false));
}

export const serviceById = (id: string) => ALL_SERVICES.get(id);
export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const categoryShort = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.short ?? id;
export const finishLabel = (id: Finish) => FINISH_OPTIONS.find((f) => f.id === id)?.label ?? id;
export const starchLabel = (id: Starch) => STARCH_OPTIONS.find((s) => s.id === id)?.label ?? id;
export const scentLabel = (id: Scent) => SCENT_OPTIONS.find((s) => s.id === id)?.label ?? id;
export const isBasket = (service: Pick<Service, "category"> | undefined) => service?.category === "baskets";

/** "Folded · Light starch · Lavender" */
export function careSummary(care: CarePrefs): string {
  const starch = care.starch === "none" ? "No starch" : `${starchLabel(care.starch)} starch`;
  return [finishLabel(care.finish), starch, scentLabel(care.scent)].join(" · ");
}

/**
 * Monthly plans. The shop advertises one at GH₵ 400 a month ("busy professionals and individuals",
 * TikTok, 25 Sept 2026) without saying what it covers, and clients asked whether it includes the
 * whole family. These two tiers are samples for the owner to set in Services & prices.
 */
const DEFAULT_PLANS: Plan[] = [
  {
    id: "plan-solo",
    name: "Solo",
    blurb: "For busy professionals: one basket a week, collected and brought back.",
    price: 400,
    baskets: 4,
    perks: ["4 basket washes a month, any size", "Free rider pickup and delivery", "Your care preferences on every wash"],
    featured: true,
  },
  {
    id: "plan-family",
    name: "Family",
    blurb: "The whole house: two baskets a week, and the school uniforms with them.",
    price: 750,
    baskets: 8,
    perks: ["8 basket washes a month, any size", "Free rider pickup and delivery", "Uniforms, bedding and baby things can share a basket"],
  },
];

export const defaultPlans = (): Plan[] => DEFAULT_PLANS.map((plan) => ({ ...plan, perks: [...plan.perks] }));

/** The plans clients can join. `applyPlans` keeps it in step with the store. */
export const PLANS: Plan[] = defaultPlans();
const ALL_PLANS = new Map<string, Plan>(PLANS.map((p) => [p.id, p]));

export function applyPlans(plans: Plan[]) {
  ALL_PLANS.clear();
  for (const plan of plans) ALL_PLANS.set(plan.id, plan);
  for (const plan of DEFAULT_PLANS) if (!ALL_PLANS.has(plan.id)) ALL_PLANS.set(plan.id, plan);
  PLANS.length = 0;
  PLANS.push(...plans.filter((p) => p.active !== false));
}

export const planById = (id: string) => ALL_PLANS.get(id);
