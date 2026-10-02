import type { Hours } from "../lib/schedule";
import type { Zone } from "./types";

/** In code the business is "the shop": one counter inside West Hills Mall, with a rider for pickups and deliveries. */
export interface ShopDetails {
  name: string;
  tagline: string;
  category: string;
  about: string;
  area: string;
  address: string;
  directions: string;
  mapsQuery: string;
  phone: string;
  email: string;
  whatsappBusiness: string;
  tiktok: string;
  owner: string;
  rating: number;
  reviewCount: number;
}

export interface Policies {
  cancellation: string;
  payment: string;
  handover: string;
  important: string;
}

/** Money rules the owner can change in Settings. */
export interface Rules {
  /** Added once to an order that takes the 3-hour express service. */
  expressFee: number;
  /** Hours the express service takes, counted inside opening hours. */
  expressHours: number;
}

/** Everything the owner can change in Settings. */
export interface ShopSettings {
  shop: ShopDetails;
  hours: Hours;
  policies: Policies;
  rules: Rules;
  zones: Zone[];
}

const DEFAULT_SHOP: ShopDetails = {
  name: "Aromatic Laundry",
  tagline: "Fresh. Clean. Aromatic.",
  category: "Premium laundry & dry cleaning",
  about:
    "Aromatic Laundry is Diane's laundry inside West Hills Mall. Bring a basket to the counter while you shop, or have our rider collect it from your door: we wash, dry, iron and fold, and it comes back smelling the way the name promises. Suits, kente and special garments get their own care, stubborn stains get treated before the wash, and the dryers mean the rainy season never holds your clothes up.",
  area: "West Hills Mall, Weija",
  address: "West Hills Mall, Winneba Road, Dunkonah (Mile 11), Weija, Accra",
  directions:
    "We're inside West Hills Mall on the Kasoa road at Mile 11. Park at the mall and walk in; ask any guard for Aromatic Laundry, or call when you arrive and we'll come out to meet you.",
  mapsQuery: "West Hills Mall, Weija, Accra",
  phone: "054 890 8101",
  email: "",
  whatsappBusiness: "https://wa.me/233548908101",
  tiktok: "https://www.tiktok.com/@aromatic.laundry1",
  owner: "Diane",
  /** Sample figures for the demo. */
  rating: 4.9,
  reviewCount: 63,
};

/** "We are open Mondays – Sundays, 7am to 9pm" (the shop's own TikTok, 8 June 2026). */
const DEFAULT_HOURS: Hours = {
  0: ["07:00", "21:00"],
  1: ["07:00", "21:00"],
  2: ["07:00", "21:00"],
  3: ["07:00", "21:00"],
  4: ["07:00", "21:00"],
  5: ["07:00", "21:00"],
  6: ["07:00", "21:00"],
};

const DEFAULT_POLICIES: Policies = {
  cancellation:
    "Cancel free of charge any time before we receive your laundry: before the rider collects it, or before you drop it off. Once it's at the counter and counted, the wash has started.",
  payment:
    "Pay online with Mobile Money or card when you book, at the counter when you collect, or to the rider on delivery. Plan members' basket washes are already paid for. Laundry goes home once the balance is cleared.",
  handover:
    "Drop off at the counter inside West Hills Mall any day from 7am to 9pm, or book our rider to collect from your door. Collect from the counter once it's ready, or choose a delivery window. Rider trips are priced by area and free for plan members.",
  important:
    "We count every garment at the counter and note stains, damage and missing buttons before washing, so check your ticket. Please empty your pockets: we can't be responsible for money, ink pens or tissue left inside. Tell us about delicate fabrics, colours that run and anything that must not be starched.",
};

const DEFAULT_RULES: Rules = { expressFee: 50, expressHours: 3 };

/** Rider areas around the mall. The fees are samples for the owner to confirm. */
const DEFAULT_ZONES: Zone[] = [
  { id: "z-weija", name: "Weija & Gbawe", areas: "Weija, Gbawe, Dunkonah, SCC, Old Barrier, Tetegu", fee: 15 },
  { id: "z-kasoa", name: "Kasoa road", areas: "Kasoa, Tuba, Galilea, Bortianor, Kokrobite, Budumburam", fee: 20 },
  { id: "z-mallam", name: "Mallam & McCarthy Hill", areas: "Mallam, McCarthy Hill, Kwashieman, Ablekuma, Dansoman", fee: 25 },
  { id: "z-accra", name: "Further into Accra", areas: "Kaneshie, Lapaz, Achimota, Osu, East Legon and beyond", fee: 40 },
];

export const cloneSettings = (settings: ShopSettings): ShopSettings => ({
  shop: { ...settings.shop },
  hours: { ...settings.hours },
  policies: { ...settings.policies },
  rules: { ...settings.rules },
  zones: settings.zones.map((z) => ({ ...z })),
});

export const defaultSettings = (): ShopSettings =>
  cloneSettings({ shop: DEFAULT_SHOP, hours: DEFAULT_HOURS, policies: DEFAULT_POLICIES, rules: DEFAULT_RULES, zones: DEFAULT_ZONES });

/**
 * The shop details every screen reads. The saved settings in the store are the source of truth:
 * `applySettings` copies them in here whenever they change, so both sides show the same details
 * without every screen having to subscribe to the store.
 */
export const SHOP: ShopDetails = { ...DEFAULT_SHOP };
export const HOURS: Hours = { ...DEFAULT_HOURS };
export const POLICIES: Policies = { ...DEFAULT_POLICIES };
export const RULES: Rules = { ...DEFAULT_RULES };
export const ZONES: Zone[] = DEFAULT_ZONES.map((z) => ({ ...z }));

export function applySettings(settings: ShopSettings) {
  Object.assign(SHOP, settings.shop);
  Object.assign(POLICIES, settings.policies);
  Object.assign(RULES, settings.rules);
  for (let day = 0; day < 7; day++) HOURS[day] = settings.hours[day] ?? null;
  ZONES.length = 0;
  ZONES.push(...settings.zones.map((z) => ({ ...z })));
}

export const zoneById = (id: string | undefined) => (id ? ZONES.find((z) => z.id === id) : undefined);

export const SHOP_FEATURES = [
  { icon: "sparkles", label: "The Aromatic finish: clothes that smell as clean as they look" },
  { icon: "clock", label: "Ready in 24 hours, or 3 hours with express" },
  { icon: "truck", label: "Rider pickup and delivery around Weija, Kasoa and Accra" },
  { icon: "shirt", label: "Suits, kente and special garments handled with care" },
  { icon: "droplet", label: "Stain rescue: treated by hand before the wash" },
  { icon: "wallet", label: "MoMo, card, cash and bank transfer" },
] as const;

/** A photo for each part of the price list, for the gallery strip and the Explore tiles. */
export const CATEGORY_PHOTOS: Record<string, string> = {
  baskets: "/photos/folded-stack.webp",
  ironing: "/photos/shirts-pressed.webp",
  suits: "/photos/suit-care.webp",
  home: "/photos/bedding.webp",
  care: "/photos/stain-treatment.webp",
};
