import { addDays, dayKey, localIso, startOfDay } from "../lib/format";
import { addMonth } from "../lib/plans";
import { canExpress, estimate, riderTrips, turnaroundHours, unitPrice } from "../lib/pricing";
import { addOpenHours, nextOpenTime, readyTime } from "../lib/schedule";
import { HOURS, RULES, ZONES } from "./business";
import { DEFAULT_CARE, SERVICES } from "./catalog";
import type { Appointment, CarePrefs, Customer, Expense, Handback, Intake, LeadSource, Order, OrderItem, OrderStatus, Payment, PaymentMethod, Review, Scent, Service, Speed, Starch, Subscription } from "./types";

/**
 * The shop's own book for the demo: every client and order the owner sees on the admin side.
 * Orders are simulated from the day the shop opened (1 June 2026, from its TikTok), so each order's
 * stage today follows from its own times: booked, checked in, washed, ironed, ready, handed over.
 * Fixed seeds keep it the same on every reset.
 */

type Rng = ReturnType<typeof random>;

/** Small deterministic random generator (mulberry32). */
export function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const range = (min: number, max: number) => min + next() * (max - min);
  const chance = (p: number) => next() < p;
  function pick<T>(items: readonly T[]): T {
    return items[Math.floor(next() * items.length)] as T;
  }
  function weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let roll = next() * total;
    for (const [item, weight] of items) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return (items[items.length - 1] as readonly [T, number])[0];
  }
  return { next, int, range, chance, pick, weighted };
}

interface ClientSeed {
  name: string;
  phone: string;
  town: string;
  zone: string;
  source: LeadSource;
  care?: Partial<CarePrefs>;
  notes?: string;
  address?: string;
}

const CLIENTS: ClientSeed[] = [
  { name: "Esi Boateng", phone: "055 902 1147", town: "Weija", zone: "z-weija", source: "tiktok", care: { finish: "hang", starch: "light" }, notes: "Banker. Ten work shirts on hangers every Monday, light starch on the collars only.", address: "Weija Paradise, two streets behind the police station" },
  { name: "Kwame Mensah", phone: "020 664 3391", town: "Kasoa", zone: "z-kasoa", source: "walkin", care: { starch: "firm" }, notes: "Pastor. Suits and agbada for Sunday, needs them back by Saturday evening without fail." },
  { name: "Adwoa Asante", phone: "024 318 7702", town: "Gbawe", zone: "z-weija", source: "tiktok", care: { scent: "unscented" }, notes: "Twin toddlers with sensitive skin: always unscented, and the baby things in their own bag.", address: "Gbawe Zero, yellow gate opposite the church" },
  { name: "Naa Adjeley Tetteh", phone: "054 771 2098", town: "Dansoman", zone: "z-mallam", source: "referral", notes: "Events planner. Kente and table linen after big weekends; drops off Monday, wants Wednesday." },
  { name: "Yaw Darko", phone: "024 190 6655", town: "Weija", zone: "z-weija", source: "whatsapp" },
  { name: "Abigail Osei", phone: "050 233 4417", town: "Kasoa", zone: "z-kasoa", source: "tiktok", care: { finish: "fold", scent: "lavender" } },
  { name: "Selasi Agbeko", phone: "026 812 0934", town: "Mallam", zone: "z-mallam", source: "referral", notes: "Referred by Esi Boateng. Nurse on shifts; call before the rider comes, she sleeps till noon after nights." },
  { name: "Efua Quaye", phone: "055 347 6612", town: "McCarthy Hill", zone: "z-mallam", source: "tiktok", address: "McCarthy Hill, the apartments behind the filling station, block C" },
  { name: "Mawuli Ampofo", phone: "024 604 5578", town: "SCC", zone: "z-weija", source: "walkin" },
  { name: "Priscilla Nyarko", phone: "059 118 2240", town: "Weija", zone: "z-weija", source: "tiktok", care: { finish: "hang", starch: "firm" }, notes: "Leads the choir. Robes before every big Sunday, firm starch." },
  { name: "Daniel Larbi", phone: "020 997 3316", town: "Bortianor", zone: "z-kasoa", source: "whatsapp" },
  { name: "Gifty Appiah", phone: "027 239 8804", town: "Gbawe", zone: "z-weija", source: "referral", notes: "Brings the big basket most Fridays on her way to the mall shopping." },
  { name: "Rita Amoah", phone: "054 480 1126", town: "Weija", zone: "z-weija", source: "tiktok" },
  { name: "Michael Sarpong", phone: "024 755 9031", town: "Kasoa", zone: "z-kasoa", source: "walkin", care: { starch: "light" } },
  { name: "Linda Frimpong", phone: "055 620 4478", town: "Dansoman", zone: "z-mallam", source: "tiktok", care: { scent: "fresh-linen" } },
  { name: "Ama Serwaa Kyei", phone: "026 301 7765", town: "Kasoa", zone: "z-kasoa", source: "whatsapp", notes: "Runs a Montessori school in Kasoa. Curtains and nap-time bedding at the end of every term." },
  { name: "Joyce Addo", phone: "050 874 2201", town: "Weija", zone: "z-weija", source: "tiktok" },
  { name: "Kojo Antwi", phone: "024 426 3358", town: "Lapaz", zone: "z-accra", source: "tiktok", notes: "Works at Lapaz, lives alone. Pickup at the office gate after 17:00 only." },
  { name: "Beatrice Aidoo", phone: "057 112 9047", town: "Gbawe", zone: "z-weija", source: "walkin" },
  { name: "Emmanuel Ofori", phone: "020 558 6613", town: "Kaneshie", zone: "z-accra", source: "referral", care: { finish: "hang" } },
  { name: "Patience Badu", phone: "024 963 0182", town: "Weija", zone: "z-weija", source: "whatsapp", notes: "Flood in June: brought everything in for the discount and has stayed since." },
  { name: "Dzifa Kumah", phone: "055 781 3390", town: "Kasoa", zone: "z-kasoa", source: "tiktok" },
  { name: "Samuel Acquah", phone: "027 646 1259", town: "Tetegu", zone: "z-weija", source: "tiktok" },
  { name: "Comfort Ansah", phone: "054 207 8836", town: "Weija", zone: "z-weija", source: "walkin" },
  { name: "Nana Ama Agyeman", phone: "024 872 4403", town: "Achimota", zone: "z-accra", source: "referral", care: { scent: "lavender", finish: "hang" } },
  { name: "Edem Mensah", phone: "059 330 7721", town: "Mallam", zone: "z-mallam", source: "app" },
  { name: "Josephine Asamoah", phone: "050 419 5584", town: "Weija", zone: "z-weija", source: "app" },
  { name: "Kofi Owusu-Ansah", phone: "024 561 2290", town: "SCC", zone: "z-weija", source: "tiktok", care: { starch: "firm", finish: "hang" }, notes: "Lawyer. Two suits a week, white shirts; firm starch, hangers only." },
];

const SERVICE_WEIGHTS: [string, number][] = [
  ["medium-basket", 22], ["big-basket", 18], ["small-basket", 14],
  ["iron-shirt", 10], ["iron-trousers", 4], ["iron-dress", 5], ["iron-native", 4],
  ["suit", 6], ["blazer", 2], ["kente", 3], ["agbada", 2], ["gown", 1],
  ["duvet", 4], ["bedsheet-set", 4], ["curtains", 2], ["towels", 3], ["stain", 4],
];

/** How many units people usually bring. */
const UNIT_QTY: Record<string, [number, number]> = {
  "iron-shirt": [3, 10],
  "iron-trousers": [2, 6],
  "iron-dress": [1, 4],
  "iron-native": [1, 3],
  suit: [1, 3],
  blazer: [1, 2],
  agbada: [1, 2],
  duvet: [1, 2],
  "bedsheet-set": [1, 3],
  curtains: [2, 6],
  towels: [1, 3],
  stain: [1, 3],
};

const METHOD_WEIGHTS: [PaymentMethod, number][] = [["momo", 62], ["cash", 26], ["bank", 4], ["card", 8]];
const STARCH_WEIGHTS: [Starch, number][] = [["none", 60], ["light", 30], ["firm", 10]];
const SCENT_WEIGHTS: [Scent, number][] = [["signature", 70], ["lavender", 12], ["fresh-linen", 12], ["unscented", 6]];

/** What clients write on the order, and what the counter notes when the bag is opened. */
const ITEM_NOTES = ["White shirt, ink mark on the pocket", "Navy suit, missing button on the left cuff", "Gold kente, hand wash only", "Red wine on the cream dress", "School uniforms, name tags inside"];
const CHECKIN_NOTES = [
  "Palm oil stain on a white blouse, treated",
  "One button loose on a blue shirt, sewn back",
  "Coins and a pen found in pockets, returned in a pouch",
  "Faded patch on the black trousers, already there",
  "Small tear on a pillowcase hem, already there",
  "Collar ring on two shirts, pre-treated",
];
const COMMENTS = ["Please call when the rider is at the gate.", "Hangers for the shirts, please.", "Separate the whites.", "Need it before church on Sunday.", "Gate code 1290."];

/** The day the shop opened its doors, from its TikTok ("Aromatic Laundry is officially here", 2 June 2026). */
const OPENED = new Date(2026, 5, 1);

export interface ShopBook {
  customers: Customer[];
  orders: Order[];
  appointments: Appointment[];
  reviews: Review[];
  subscriptions: Subscription[];
  expenses: Expense[];
}

/** The first rider window (07:00, 09:00 … 19:00) that starts at or after `time`. */
export function windowAtOrAfter(time: Date): Date {
  let t = nextOpenTime(time, HOURS);
  for (let guard = 0; guard < 20; guard++) {
    const span = HOURS[t.getDay()];
    if (span) {
      const [oh = 7, om = 0] = span[0].split(":").map(Number);
      const [ch = 21] = span[1].split(":").map(Number);
      const opens = new Date(t.getFullYear(), t.getMonth(), t.getDate(), oh, om);
      const steps = Math.max(0, Math.ceil((t.getTime() - opens.getTime()) / 7_200_000));
      const start = new Date(opens.getTime() + steps * 7_200_000);
      if (start.getHours() + 2 <= ch) return start;
    }
    t = nextOpenTime(addDays(startOfDay(t), 1), HOURS);
  }
  return t;
}

export function createShopBook(now: Date): ShopBook {
  const today = startOfDay(now);
  const nowMs = now.getTime();
  const at = (offset: number, hour: number, minute = 0) => {
    const d = addDays(today, offset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const historyDays = Math.max(30, Math.round((today.getTime() - startOfDay(OPENED).getTime()) / 86_400_000));

  const careFor = (seed: ClientSeed | undefined, r: Rng): CarePrefs => ({
    finish: seed?.care?.finish ?? (r.chance(0.3) ? "hang" : "fold"),
    starch: seed?.care?.starch ?? r.weighted(STARCH_WEIGHTS),
    scent: seed?.care?.scent ?? r.weighted(SCENT_WEIGHTS),
  });

  const customers: Customer[] = CLIENTS.map((c, i) => {
    const r = random(9100 + i);
    return {
      id: `c-${String(i + 1).padStart(2, "0")}`,
      name: c.name,
      phone: c.phone,
      email: `${c.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@gmail.com`,
      town: c.town,
      address: c.address,
      memberSince: at(-r.int(5, historyDays - 2), 10).toISOString(),
      hasAccount: c.source === "app" || r.chance(0.3),
      points: r.int(0, 25) * 10,
      source: c.source,
      care: c.care ? { ...DEFAULT_CARE, ...c.care } : undefined,
      notes: c.notes,
    };
  });
  const clientId = (index: number) => (customers[index] ?? customers[0])!.id;
  const serviceFor = (id: string): Service => SERVICES.find((s) => s.id === id) ?? SERVICES[0]!;

  /* ---------------- Plans: launched on TikTok on 25 Sept 2026, first ten subscribers get free pickup ---------------- */

  const subscriptions: Subscription[] = [];
  const planMembers: [number, string, number][] = [
    [0, "plan-solo", -6], [2, "plan-family", -6], [27, "plan-solo", -5], [11, "plan-family", -4], [6, "plan-solo", -3], [9, "plan-solo", -2],
  ];
  planMembers.forEach(([index, planId, offset], i) => {
    const r = random(7700 + i);
    const started = at(offset, r.int(9, 19), r.pick([0, 15, 30, 45]));
    const plan = planId === "plan-family" ? 750 : 400;
    const method = r.weighted(METHOD_WEIGHTS);
    subscriptions.push({
      id: `s-${String(i + 1).padStart(2, "0")}`,
      customerId: clientId(index),
      planId,
      startedAt: started.toISOString(),
      periodStart: dayKey(started),
      renewsOn: dayKey(addMonth(started)),
      status: "active",
      payments: [
        {
          id: "",
          amount: plan,
          method,
          reference: method === "momo" ? `MTN ${r.int(10_000_000, 99_999_999)}` : method === "card" ? `PSK-${r.int(10_000_000, 99_999_999)}` : "Cash",
          at: started.toISOString(),
          receiptNo: "",
          kind: "full",
          receivedBy: method === "card" ? "Paystack (online)" : "Aromatic Laundry",
          payer: method === "momo" ? `MTN MoMo · ${CLIENTS[index]?.phone ?? ""}` : undefined,
        },
      ],
    });
  });
  const subscriptionOf = (customerIndex: number, time: Date) =>
    subscriptions.find((s) => s.customerId === clientId(customerIndex) && new Date(s.startedAt) <= time);

  const payment = (r: Rng, amount: number, time: number, kind: Payment["kind"], phone: string, online = false): Payment => {
    const method = online ? r.weighted([["momo", 70], ["card", 30]] as const) : r.weighted(METHOD_WEIGHTS);
    const digits = String(r.int(10_000_000, 99_999_999));
    return {
      id: "",
      amount,
      method,
      reference: method === "momo" ? (online ? `PSK-${digits}` : `MTN ${digits}`) : method === "bank" ? `GCB ${digits}` : method === "card" ? `PSK-${digits}` : "Cash",
      at: new Date(time).toISOString(),
      receiptNo: "",
      kind,
      receivedBy: online || method === "card" ? "Paystack (online)" : "Aromatic Laundry",
      payer: method === "momo" ? `MTN MoMo · ${phone}` : undefined,
    };
  };

  const makeItem = (r: Rng, service: Service, id: string, basketQty = 1): OrderItem => {
    if (service.kind === "quote") return { id, serviceId: service.id, qty: 1, unitPrice: r.int(15, 40) * 10, note: "Ivory lace gown with a beaded bodice" };
    const [lo, hi] = UNIT_QTY[service.id] ?? [basketQty, basketQty];
    const qty = Math.max(service.minQty ?? 1, r.int(lo, hi));
    const note = r.chance(0.08) ? r.pick(ITEM_NOTES) : undefined;
    return { id, serviceId: service.id, qty, unitPrice: unitPrice(service), note };
  };

  const orders: Order[] = [];
  const appointments: Appointment[] = [];
  let apptSeq = 0;

  interface SimOpts {
    service?: string;
    customer?: number;
    /** Force where the order is now: hours from now that it was checked in (negative = past), or a future booking. */
    inHours?: number;
    intake?: Intake;
    handback?: Handback;
    speed?: Speed;
    plan?: boolean;
  }

  /** One order placed `offset` days ago, carried forward along its own timeline to now. */
  const simulate = (r: Rng, offset: number, seq: number, opts: SimOpts = {}) => {
    const service = serviceFor(opts.service ?? r.weighted(SERVICE_WEIGHTS));
    const customerIndex = opts.customer ?? (r.chance(0.6) ? r.int(0, 13) : r.int(0, CLIENTS.length - 1));
    const seed = CLIENTS[customerIndex];
    const phone = seed?.phone ?? "";
    const n = String(seq).padStart(3, "0");
    const items = [makeItem(r, service, `i-s${n}`, r.chance(0.12) ? 2 : 1)];
    // A basket often comes with a few things to press, and a stained outfit with stain rescue.
    if (service.category === "baskets" && r.chance(0.18)) items.push(makeItem(r, serviceFor(r.pick(["iron-shirt", "stain", "bedsheet-set", "suit"])), `i-s${n}b`));
    else if (service.category !== "baskets" && service.id !== "stain" && r.chance(0.12)) items.push(makeItem(r, serviceFor("stain"), `i-s${n}b`));

    // When it was booked, and when the laundry reached the counter.
    const booked = opts.inHours !== undefined ? new Date(nowMs + Math.min(0, opts.inHours - r.range(2, 20)) * 3_600_000) : new Date(Math.min(at(offset, r.int(7, 19), r.pick([0, 10, 20, 30, 40, 50])).getTime(), nowMs - 15 * 60_000));
    const intake: Intake = opts.intake ?? (r.chance(0.34) ? "pickup" : "dropoff");
    const handback: Handback = opts.handback ?? (intake === "pickup" ? (r.chance(0.8) ? "delivery" : "collect") : r.chance(0.12) ? "delivery" : "collect");
    const zoneId = intake === "pickup" || handback === "delivery" ? (seed?.zone ?? r.pick(ZONES).id) : undefined;
    let inTime: Date;
    if (opts.inHours !== undefined) inTime = intake === "pickup" ? windowAtOrAfter(new Date(nowMs + opts.inHours * 3_600_000)) : nextOpenTime(new Date(nowMs + opts.inHours * 3_600_000), HOURS);
    else if (intake === "pickup") inTime = windowAtOrAfter(new Date(booked.getTime() + r.range(2, 18) * 3_600_000));
    else inTime = r.chance(0.7) ? nextOpenTime(booked, HOURS) : nextOpenTime(new Date(booked.getTime() + r.range(1, 20) * 3_600_000), HOURS);
    // The rider brings a pickup back to the counter within the hour.
    const receivedTime = new Date(Math.max(inTime.getTime(), nextOpenTime(new Date(inTime.getTime() + (intake === "pickup" ? r.range(40, 110) : r.range(0, 10)) * 60_000), HOURS).getTime()));

    const speed: Speed = opts.speed ?? (canExpress(items) && r.chance(0.14) ? "express" : "standard");
    const sub = opts.plan === false ? undefined : subscriptionOf(customerIndex, booked);
    const onPlan = Boolean(sub && service.category === "baskets" && (opts.plan || r.chance(0.9)));
    const zoneFee = ZONES.find((z) => z.id === zoneId)?.fee ?? 0;
    const est = estimate(items, { speed, trips: riderTrips(intake, handback), zoneFee, planBasketsLeft: onPlan ? 4 : undefined });
    const total = est.total;
    const readyAt = readyTime(receivedTime, turnaroundHours(items), speed === "express", RULES.expressHours, HOURS);

    // The work itself: into the wash within a couple of open hours, ironed after, ready before the promise (mostly).
    const washTime = addOpenHours(receivedTime, r.range(0.2, speed === "express" ? 0.5 : 2.5), HOURS);
    const ironTime = addOpenHours(washTime, r.range(speed === "express" ? 1 : 1.5, speed === "express" ? 1.4 : 3), HOURS);
    const lateBy = r.chance(0.07) ? r.range(0.5, 3) : 0;
    const readyTimeActual = lateBy ? addOpenHours(readyAt, lateBy, HOURS) : new Date(Math.min(readyAt.getTime(), addOpenHours(ironTime, r.range(0.5, 2), HOURS).getTime()));
    const deliveryWindow = handback === "delivery" ? windowAtOrAfter(new Date(Math.max(readyAt.getTime(), readyTimeActual.getTime()) + r.range(0.5, 6) * 3_600_000)) : undefined;
    const outTime = deliveryWindow ? new Date(deliveryWindow.getTime() + r.range(0, 30) * 60_000) : undefined;
    const doneTime = deliveryWindow
      ? new Date(deliveryWindow.getTime() + r.range(30, 110) * 60_000)
      : nextOpenTime(new Date(readyTimeActual.getTime() + r.weighted([[r.range(1, 6), 6], [r.range(18, 30), 3], [r.range(40, 72), 1]] as const) * 3_600_000), HOURS);

    const cancelled = opts.inHours === undefined && r.chance(0.03);
    const plan: [OrderStatus, Date][] = [["booked", booked]];
    if (cancelled) plan.push(["cancelled", new Date(Math.min(inTime.getTime(), booked.getTime() + r.range(1, 6) * 3_600_000))]);
    else {
      plan.push(["received", receivedTime], ["washing", washTime], ["finishing", ironTime], ["ready", readyTimeActual]);
      if (outTime) plan.push(["out", outTime]);
      plan.push(["done", doneTime]);
    }
    const history: { status: OrderStatus; at: string; time: number }[] = [];
    let last = 0;
    for (const [status, time] of plan) {
      const t = Math.max(time.getTime(), last + (history.length ? 5 * 60_000 : 0));
      if (t > nowMs - 5 * 60_000) break;
      last = t;
      history.push({ status, at: new Date(t).toISOString(), time: t });
    }
    if (!history.length) history.push({ status: "booked", at: booked.toISOString(), time: booked.getTime() });
    const status = history[history.length - 1]!.status;
    const timeOf = (s: OrderStatus) => history.find((h) => h.status === s)?.time;

    // Paid online when booking, at the counter on check-in, or when it goes home.
    const payChoice = onPlan ? "plan" : r.chance(0.24) ? "now" : "later";
    const payments: Payment[] = [];
    if (total > 0 && status !== "cancelled") {
      if (payChoice === "now") payments.push(payment(r, total, booked.getTime() + 60_000, "full", phone, true));
      else {
        const counterTime = timeOf("received");
        const settle = timeOf("done");
        if (counterTime !== undefined && r.chance(0.3)) payments.push(payment(r, total, counterTime + 5 * 60_000, "full", phone));
        else if (settle !== undefined) payments.push(payment(r, total, settle - 2 * 60_000, "full", phone));
      }
    }

    const id = `o-s${n}`;
    let pickupId: string | undefined;
    let deliveryId: string | undefined;
    if (intake === "pickup") {
      pickupId = `a-${String(++apptSeq).padStart(3, "0")}`;
      appointments.push({ id: pickupId, customerId: clientId(customerIndex), orderId: id, purpose: "pickup", start: localIso(inTime), minutes: 120, status: status === "cancelled" ? "cancelled" : status === "booked" ? (r.chance(0.8) ? "confirmed" : "requested") : "done" });
    }
    if (deliveryWindow && status !== "cancelled") {
      deliveryId = `a-${String(++apptSeq).padStart(3, "0")}`;
      appointments.push({ id: deliveryId, customerId: clientId(customerIndex), orderId: id, purpose: "delivery", start: localIso(deliveryWindow), minutes: 120, status: status === "done" ? "done" : r.chance(0.85) ? "confirmed" : "requested" });
    }

    const counted = items.reduce((s, i) => s + (serviceFor(i.serviceId).category === "baskets" ? i.qty * r.int(8, 22) : i.qty), 0);
    orders.push({
      id,
      number: "",
      customerId: clientId(customerIndex),
      createdAt: booked.toISOString(),
      items,
      speed,
      care: careFor(seed, r),
      intake,
      handback,
      zoneId,
      inAt: localIso(inTime),
      readyAt: localIso(readyAt),
      pickupId,
      deliveryId,
      comments: r.chance(0.12) ? r.pick(COMMENTS) : undefined,
      checkIn: timeOf("received") !== undefined ? { count: counted, notes: r.chance(0.22) ? r.pick(CHECKIN_NOTES) : undefined, at: new Date(timeOf("received")!).toISOString() } : undefined,
      status,
      history: history.map(({ status: s, at: t }) => ({ status: s, at: t })),
      total,
      riderFee: est.riderFee,
      expressFee: est.expressFee,
      planCover: est.planCover,
      discount: 0,
      payChoice,
      subscriptionId: onPlan ? sub?.id : undefined,
      payments,
      lastUpdateAt: status === "booked" ? undefined : history[history.length - 1]?.at,
    });
  };

  let seq = 0;
  for (let offset = -historyDays; offset <= -1; offset++) {
    // Each day draws from its own seed, so the book doesn't shift with the weekday the demo is opened on.
    const r = random(20261001 + (offset + 1000) * 7919);
    const age = (offset + historyDays) / historyDays; // 0 on opening day, 1 yesterday
    const weekend = [0, 6].includes(addDays(today, offset).getDay());
    const base = 1 + Math.round(age * 4) + (weekend ? 1 : 0);
    const count = Math.max(0, base + r.int(-1, 2));
    for (let i = 0; i < count; i++) simulate(r, offset, ++seq);
  }

  // Whatever the time: a full counter today. Hours are from now; negative means it's already in.
  const today_: [SimOpts][] = [
    [{ service: "big-basket", customer: 0, inHours: -5, intake: "pickup", handback: "delivery", plan: true }],
    [{ service: "medium-basket", customer: 11, inHours: -3, intake: "dropoff", handback: "collect", plan: true }],
    [{ service: "small-basket", customer: 4, inHours: -1.5, intake: "dropoff", handback: "collect", speed: "express" }],
    [{ service: "suit", customer: 1, inHours: -20, intake: "dropoff", handback: "collect" }],
    [{ service: "iron-shirt", customer: 27, inHours: -2.2, intake: "dropoff", handback: "collect", plan: false }],
    [{ service: "kente", customer: 3, inHours: -26, intake: "dropoff", handback: "delivery" }],
    [{ service: "medium-basket", customer: 12, inHours: -7, intake: "dropoff", handback: "collect" }],
    [{ service: "duvet", customer: 15, inHours: -30, intake: "pickup", handback: "delivery" }],
    [{ service: "big-basket", customer: 2, inHours: 1.5, intake: "pickup", handback: "delivery", plan: true }],
    [{ service: "medium-basket", customer: 6, inHours: 3, intake: "pickup", handback: "delivery", plan: true }],
    [{ service: "small-basket", customer: 13, inHours: 2, intake: "dropoff", handback: "collect" }],
    [{ service: "iron-native", customer: 9, inHours: 18, intake: "dropoff", handback: "collect", plan: false }],
    [{ service: "big-basket", customer: 17, inHours: 22, intake: "pickup", handback: "delivery" }],
    // Just through the door: counted, not yet in a machine.
    [{ service: "medium-basket", customer: 8, inHours: -0.25, intake: "dropoff", handback: "collect", plan: false }],
  ];
  today_.forEach(([opts], i) => simulate(random(5200 + i), 0, ++seq, opts));

  // Reviews waiting for the owner's approval, in the words people use on the shop's TikTok.
  const reviews: Review[] = [
    { id: "r-s1", name: "Esi B.", rating: 5, text: "Ten shirts on hangers every Monday, collars exactly how I like them. The rider is always on time.", at: at(-1, 19).toISOString(), serviceId: "iron-shirt", customerId: clientId(0), status: "pending" },
    { id: "r-s2", name: "Kwame M.", rating: 5, text: "Brought my suits in on Thursday and they were ready Saturday morning, pressed better than I could do it.", at: at(-2, 13).toISOString(), serviceId: "suit", customerId: clientId(1), status: "pending" },
    { id: "r-s3", name: "Adwoa A.", rating: 5, text: "They remember the twins' things go unscented without me saying it. That alone keeps me coming back.", at: at(-3, 10).toISOString(), serviceId: "big-basket", customerId: clientId(2), status: "pending" },
    { id: "r-s4", name: "Patience B.", rating: 4, text: "Saved my clothes after the flood. A few stains didn't come out completely, but they told me before I paid.", at: at(-6, 16).toISOString(), serviceId: "stain", customerId: clientId(20), status: "pending" },
    { id: "r-s5", name: "Unknown", rating: 1, text: "Wrong shop, sorry.", at: at(-8, 21).toISOString(), serviceId: "small-basket", status: "hidden" },
  ];

  /* ---------------- Money going out ---------------- */

  const expenses: Expense[] = [];
  let eSeq = 0;
  const spend = (offset: number, amount: number, categoryId: string, note: string, method: PaymentMethod) => {
    if (offset > 0) return;
    expenses.push({ id: `e-${String(++eSeq).padStart(3, "0")}`, on: dayKey(addDays(today, offset)), amount, categoryId, note, method, createdAt: at(offset, 18).toISOString() });
  };
  for (let offset = -historyDays; offset <= 0; offset++) {
    const r = random(31000 + (offset + 1000) * 13);
    const d = addDays(today, offset);
    if (d.getDate() === 1) {
      spend(offset, 2000, "rent", "Shop rent, West Hills Mall", "bank");
      spend(offset, 2400, "staff", "Two attendants", "momo");
    }
    if (d.getDay() === 1) {
      spend(offset, r.int(22, 34) * 10, "detergent", r.pick(["Detergent and softener, 2 gallons each", "Detergent, bleach and softener"]), "momo");
      spend(offset, r.int(28, 45) * 10, "power", "ECG prepaid top-up", "momo");
    }
    if (d.getDay() === 4 && r.chance(0.6)) spend(offset, r.int(12, 18) * 10, "fragrance", r.pick(["Signature fragrance, 1 litre", "Lavender and fresh linen refills"]), "momo");
    if (d.getDate() === 15) spend(offset, r.int(15, 25) * 10, "packaging", "Laundry bags, hangers and tags", "cash");
    if (offset % 2 === 0) spend(offset, r.int(3, 6) * 10, "rider", "Fuel for the rider's motorbike", "cash");
    if (d.getDay() === 5 && r.chance(0.35)) spend(offset, r.int(5, 15) * 10, "marketing", "TikTok promotion", "momo");
  }
  spend(-38, 350, "repairs", "Dryer belt replaced", "cash");
  spend(-91, 300, "marketing", "Opening flyers and banner", "cash");

  return { customers, orders, appointments, reviews, subscriptions, expenses };
}
