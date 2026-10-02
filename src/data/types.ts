export type ID = string;

/** The price list, grouped the way the counter talks about it. */
export type CategoryId = "baskets" | "ironing" | "suits" | "home" | "care";

/** Pastel tile colours behind photos and fallbacks (see .photo.tone-* in ui.css). */
export type Tone = "lilac" | "sky" | "sand" | "blush" | "steel" | "mist" | "aqua" | "charcoal";

/**
 * How a service is priced.
 * fixed: a price on the list, per basket or per item.
 * quote: priced at the counter once we've seen it (wedding gowns, leather, heavy beading).
 */
export type PriceKind = "fixed" | "quote";

export interface Service {
  id: ID;
  name: string;
  category: CategoryId;
  description: string;
  kind: PriceKind;
  /** Price per unit. 0 for quoted services until the counter prices them. */
  price: number;
  /** What one unit is: "basket", "shirt", "suit", "panel". */
  unit: string;
  /** Baskets only: roughly how much fits, from the price list ("About 6–8 clothes"). */
  capacity?: string;
  minQty?: number;
  /** Standard turnaround in hours. Most of the list is 24; duvets, suits and kente take longer. */
  hours: number;
  /** Whether the 3-hour express service can be added. */
  express: boolean;
  featured?: boolean;
  /** False hides the service from clients. Past orders keep showing it. */
  active?: boolean;
  tone: Tone;
  /** Optional real photo in /public/photos. */
  photo?: string;
}

export interface OrderItem {
  id: ID;
  serviceId: ID;
  qty: number;
  /** Copied at order time so a later price change doesn't rewrite history. 0 until a quote is priced. */
  unitPrice: number;
  /** "Navy suit, missing button on the left cuff". */
  note?: string;
}

/** How clothes come back: folded into the bag, or pressed onto hangers. */
export type Finish = "fold" | "hang";
export type Starch = "none" | "light" | "firm";
/** The scent in the final rinse: the house signature, two alternatives, or none for sensitive skin. */
export type Scent = "signature" | "lavender" | "fresh-linen" | "unscented";

/** How a client likes their laundry done. Saved on the account and copied onto each order. */
export interface CarePrefs {
  finish: Finish;
  starch: Starch;
  scent: Scent;
  /** "Wash the whites separately", "No bleach on the blue shirts". */
  notes?: string;
}

/**
 * booked: placed, waiting for the rider's pickup or the client's drop-off.
 * received: at the counter, counted and tagged, price confirmed.
 * washing: washing and drying.
 * finishing: ironing and folding.
 * ready: bagged and labelled.
 * out: with the rider (delivery orders only).
 * done: collected at the counter or delivered.
 */
export type OrderStatus = "booked" | "received" | "washing" | "finishing" | "ready" | "out" | "done" | "cancelled";

/** standard: 24 hours. express: 3 hours, for the express fee. */
export type Speed = "standard" | "express";
/** How the laundry reaches us: brought to the counter at West Hills Mall, or collected by our rider. */
export type Intake = "dropoff" | "pickup";
/** How it goes home: collected at the counter, or brought back by our rider. */
export type Handback = "collect" | "delivery";
export type PaymentMethod = "momo" | "card" | "cash" | "bank";
/** now: paid online at checkout. later: at the counter or to the rider. plan: covered by the client's monthly plan. */
export type PayChoice = "now" | "later" | "plan";

export interface StatusEvent {
  status: OrderStatus;
  at: string;
}

export interface Payment {
  id: ID;
  amount: number;
  method: PaymentMethod;
  reference: string;
  at: string;
  receiptNo: string;
  kind: "full" | "part" | "final";
  receivedBy: string;
  /** Who or what paid, e.g. "MTN MoMo · 054 890 8101". */
  payer?: string;
}

/** What the counter writes down when the bag is opened: the defence against "you lost my shirt". */
export interface CheckIn {
  /** Garments counted at the counter. */
  count: number;
  /** Stains, damage, missing buttons, things left in pockets. */
  notes?: string;
  /** Small photos taken at the counter (data URLs, downsized). */
  photos?: string[];
  at: string;
}

export interface Order {
  id: ID;
  number: string;
  customerId: ID;
  createdAt: string;
  items: OrderItem[];
  speed: Speed;
  care: CarePrefs;
  intake: Intake;
  handback: Handback;
  /** The delivery zone, when the rider goes either way. */
  zoneId?: ID;
  /** When the laundry reaches us: the drop-off time or the start of the pickup window. Local ISO, YYYY-MM-DDTHH:mm. */
  inAt: string;
  /** When it will be ready. Local ISO, YYYY-MM-DDTHH:mm. */
  readyAt: string;
  /** The rider's pickup and delivery windows. */
  pickupId?: ID;
  deliveryId?: ID;
  comments?: string;
  checkIn?: CheckIn;
  status: OrderStatus;
  history: StatusEvent[];
  total: number;
  /** What makes up the total beyond the items, kept apart so receipts and reports can show it. */
  riderFee: number;
  expressFee: number;
  /** Basket washes paid for by the client's plan, taken off the items. */
  planCover: number;
  /** Loyalty points spent on the order. */
  discount: number;
  payChoice: PayChoice;
  /** Set when the order is covered by a plan. */
  subscriptionId?: ID;
  payments: Payment[];
  /** When the shop last sent the client a WhatsApp update about this order. */
  lastUpdateAt?: string;
}

/* ---------------- Monthly plans ---------------- */

/** A monthly package: a number of basket washes, with pickup and delivery included. */
export interface Plan {
  id: ID;
  name: string;
  /** Who it's for, one line. */
  blurb: string;
  price: number;
  /** Basket washes included each month (any basket size). */
  baskets: number;
  /** What else comes with it, shown as a list. */
  perks: string[];
  featured?: boolean;
  active?: boolean;
}

export interface Subscription {
  id: ID;
  customerId: ID;
  planId: ID;
  startedAt: string;
  /** The current month runs from periodStart (inclusive) to renewsOn (exclusive). Day keys. */
  periodStart: string;
  renewsOn: string;
  status: "active" | "paused" | "cancelled";
  /** Set when the client cancels: the month already paid for still runs, it just won't renew. */
  endsAtRenewal?: boolean;
  /** Monthly payments, each with its own receipt. */
  payments: Payment[];
}

/* ---------------- Rider runs ---------------- */

/** Areas the rider covers, priced per trip. */
export interface Zone {
  id: ID;
  name: string;
  /** "Weija, Gbawe, Dunkonah, SCC". */
  areas: string;
  fee: number;
}

export type AppointmentPurpose = "pickup" | "delivery";

export interface Appointment {
  id: ID;
  customerId: ID;
  orderId?: ID;
  purpose: AppointmentPurpose;
  /** Start of the window. Local ISO date-time, YYYY-MM-DDTHH:mm. */
  start: string;
  minutes: number;
  status: "requested" | "confirmed" | "cancelled" | "done";
}

/** How a client first found the shop. */
export type LeadSource = "tiktok" | "whatsapp" | "walkin" | "referral" | "app";

/**
 * Everyone who has used the shop, with or without an account. Records are matched by
 * WhatsApp number, so repeat guest orders land on one customer.
 */
export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email: string;
  town: string;
  /** Street or landmark, for the rider. */
  address?: string;
  /** GhanaPost GPS address, e.g. GS-0123-4567. */
  digitalAddress?: string;
  memberSince: string;
  /** True once they confirmed their WhatsApp number with a code. Accounts are optional. */
  hasAccount: boolean;
  points: number;
  source?: LeadSource;
  /** How they like it done. Shown to both sides. */
  care?: CarePrefs;
  /** The owner's notebook: gate codes, who to call, what not to starch. Never shown to the client. */
  notes?: string;
}

/** What the customer types at checkout. */
export interface ContactDetails {
  name: string;
  phone: string;
  email: string;
  town: string;
  address: string;
  digitalAddress: string;
}

export type ReviewStatus = "pending" | "published" | "hidden";

export interface Review {
  id: ID;
  name: string;
  rating: number;
  text: string;
  at: string;
  serviceId: ID;
  customerId?: ID;
  /** Only published reviews appear on the shop page. */
  status: ReviewStatus;
  reply?: string;
}

/* ---------------- Money going out ---------------- */

/**
 * What the shop spends on. The owner picks which ones she keeps: switching one off hides it from
 * the add form and the charts, and past expenses keep it.
 */
export interface ExpenseCategory {
  id: ID;
  label: string;
  /**
   * direct: bought for the washing itself (detergent, fragrance, the rider's fuel).
   * overhead: paid whatever the month brings (rent, power, data).
   */
  kind: "direct" | "overhead";
  active?: boolean;
}

export interface Expense {
  id: ID;
  /** The day the money went out. Day key, YYYY-MM-DD. */
  on: string;
  amount: number;
  categoryId: ID;
  /** "Two gallons of softener", "ECG prepaid". */
  note?: string;
  method: PaymentMethod;
  createdAt: string;
}
