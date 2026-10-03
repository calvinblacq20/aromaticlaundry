# Aromatic Laundry: Laundry App (Demo) PRD

## Goal
Give Aromatic Laundry what its TikTok comments keep asking for: one place to see the prices, book a basket, follow it and pay. And give the counter one place to run the day. One app with two sides, sharing the same data.

This is package B from `docs/proposal.md`: the client app plus the owner side. It is the same system as the Franz Qlodin, Ruffles and Baked and Royal Hair builds, retuned for a laundry. The order isn't made to order, it's counted in and handed back, and that changes the stages, the money and the promises.

## The business
From the shop's TikTok [@aromatic.laundry1](https://www.tiktok.com/@aromatic.laundry1) (all 40 posts, captions, comments and the price list) and web searches, 1 Oct 2026. Full notes in `docs/business-research.md`.

| | |
|---|---|
| Name | **Aromatic Laundry**: "Premium laundry & dry cleaning". Owner **Diane** (named in comments; spelling to confirm) |
| Where | Inside **West Hills Mall**, Dunkonah / Weija, on the Accra–Kasoa road. The only laundry in the mall's directory |
| Opened | Around **1 June 2026** (the shopfront poster: "Opening soon, Monday 1st June 2026") |
| Hours | "Mondays – Sundays, 7am to 9pm" |
| Phone and WhatsApp | 054 890 8101. A directory listing also shows 054 653 8268 (not confirmed) |
| Channels | TikTok only: 526 followers, 3,131 likes, about 47K views. No website, Instagram or Google Business Profile |
| Taglines | "Fresh. Clean. Aromatic." (used in the app) · "Cleaner clothes. Better living." · "Clean Clothes. Fresh Life." |
| What it stands for | The scent ("I spent hours smelling them"), speed, dryers so rain doesn't delay anything, suits and kente, stain rescue |

### Price list (the shop's own, `brand/tiktok-photos/price-list.jpg`)

| Wash, dry, fold & iron | Clothes | Price |
|---|---|---|
| Small basket | about 6–8 | GH₵ 50 |
| Medium basket | about 10–15 | GH₵ 80 |
| Big basket | about 20–35 | GH₵ 120 |
| Ironing only | per item | GH₵ 5–10 |

Standard turnaround **24 hours**. **Express: 3 hours for +GH₵ 50.** A monthly package at **GH₵ 400** "for busy professionals" was posted on 25 Sept 2026 without saying what it covers. Pickup and delivery are offered, but no fee is ever stated.

## Who
- **Clients:** busy professionals and families on the west side of Accra (Weija, Gbawe, Kasoa, Mallam), and mall shoppers who drop laundry off while they shop. They arrive from TikTok, on a phone.
- **Owner and counter staff:** Diane and the attendants at the counter, on a phone or the counter tablet.

## Stage
Clickable demo using sample data stored in the browser. Paystack payments, WhatsApp codes and logins are simulated: no money moves and no messages are sent.

## Design
The house system (Makro look, Fresha structure; see `docs/design-reference.md`, `docs/structure-reference.md`, `docs/admin-ui-guidelines.md`), with this shop's colours taken from its price list. Charcoal ink `#242426` is the text and the solid buttons, with white text on them. **Aqua** `#7ad7f0` from the water in the artwork is the one bright accent, always under dark ink (9.5:1). The ground is the system's cool grey, and every text grey clears 4.5:1 on it. The mark is the logo's emblem: a shirt on a hanger with a folded stack and the scent rising.

## Client side
| Screen | Job |
|---|---|
| Home | Photos of the shop, about, the price list, how it works (book, count, wash, home), plans, reviews, hours, map pin in the mall, WhatsApp and TikTok |
| Explore | Every service by category (baskets, ironing, suits & kente, bedding, stains), searchable, with saved favourites |
| Book | Services → care and speed (folded or hung, starch, scent, notes; standard or express) → pickup and return (drop off or rider pickup by area and window; collect or delivery window) → details → review and pay (now, later, or on the plan). No account needed |
| Track | Orders on this phone with a stage tracker, the garment count and notes from check-in, the fee breakdown and receipts; "Find my order" by order number + WhatsApp number + code |
| Plans | Solo and Family: join, see baskets left this month, renew, cancel at the end of the month or change your mind, plan receipts |
| Profile | Account (WhatsApp number + code, no password), saved care preferences, my plan, reset demo |

## Owner side (`#/admin`)
| Screen | Job |
|---|---|
| Today | The counter queue (bookings due in, soonest due first), what's on the floor by stage, due-by-hour chart, today's rider runs, laundry ready to hand over, renewals to chase, trends |
| Orders | List and board by stage group (booked, in the shop, ready, handed over), filters in the URL (stage, express / rider / plan, payment, due window, owed), one next step per order |
| Order | Stage stepper, check-in (count, notes, up to 4 photos, final price), money and receipts, care and handover, WhatsApp update with the message filled in |
| New order | A counter drop-off: new or returning client, services, care, speed, handback, garment count, plan baskets, payment. Starts checked in |
| Rider runs | Pickups and deliveries by day and window; confirm, decline, mark done |
| Clients | Spend, unpaid, source, on a plan; profile with orders, care preferences, plan, notes and payments |
| Plans | Members, baskets used, renewals due, record a renewal paid at the counter, plan receipts |
| Payments, Expenses, Reports | Every payment including plan months; spending by category (direct and overhead); money in and out, takings by service, rider zones, express share |
| Reviews | Approve, hide, reply |
| Services & prices | Every service's price, turnaround, express allowed and visibility; the two plans |
| Settings | Shop details, hours, express fee and hours, rider zones and fees, policies, reset demo |

## Data model
- **Customer:** name, WhatsApp number (the matching key), email, town, address and GhanaPost address, account flag, points, lead source (TikTok / WhatsApp / walk-in / referral / app), care preferences, owner's notes (owner only)
- **Service:** name, category, kind (fixed price or priced at the counter), price, unit, capacity ("about 10–15 clothes"), minimum quantity, turnaround hours, express allowed, visibility
- **Order:** number (AL-1041), customer, items, speed, care (finish, starch, scent, notes), intake (drop-off / pickup), handback (collect / delivery), rider zone, in time, ready time, status history, check-in, total with the rider fee, express fee, plan cover and discount kept separately, pay choice, plan subscription, payments
- **Check-in:** garment count, notes, photos, time
- **Payment:** amount, method, payer, reference, receipt number (ALR-2026-0042), kind (full / part / final)
- **Appointment:** rider pickup or delivery, window start, length, status, linked order
- **Plan / Subscription:** baskets a month, price, perks / client, period start, renewal day, status, ends-at-renewal flag, monthly payments
- **Zone:** name, areas, fee per trip
- **Expense:** day, amount, category (direct or overhead), method, note

Order stages: `booked → received → washing → finishing → ready → out → done` (or `cancelled`). `out` is only for deliveries.

## Edge cases
- **Disputes over what was handed in:** nothing moves past *booked* until the counter records a garment count. Notes cover stains and damage found before washing, and photos are optional. The client sees all of it.
- **"About 6–8 clothes":** the counter can change the total at check-in when a basket is bigger than booked, or to price a gown. The total can't drop below what's already paid.
- **Express after hours:** express counts only open hours, so 3 hours from 20:00 is 09:00 the next day. A standard wash that lands after closing moves to the next opening.
- **Express is per order**, not per basket, and only offered when every item can go through in 3 hours (no suits, kente, duvets).
- **Rider capacity:** three runs per two-hour window. Windows less than two hours away are closed, and a delivery window can't start before the ready time.
- **Plans:** the plan covers the dearest baskets first, and plan orders ride free. When the month's baskets are used up, the order can't be put on the plan. A cancelled plan still runs to the end of the paid month. A renewal moves the month on from where it ended, or from today if it lapsed more than a week ago.
- **Handing over while owing:** blocked unless the owner chooses to allow it.
- **Cancelling:** clients can cancel only before the laundry reaches the counter. Cancelling releases the rider windows.
- **Same number again:** one customer record; care preferences, account and points kept.
- **An order link opened on another phone:** hidden until the order number, WhatsApp number and code match.
- **Payments can't exceed what's owed**, and plan payments must match the plan price.

## Open questions for the owner
1. **The owner's name.** Comments say "Diane" and "Diana". Which is right?
2. **Which number is official:** 054 890 8101 or 054 653 8268?
3. **The shop's unit** inside West Hills Mall (floor, near which anchor), for the directions.
4. **Rider fees and coverage.** The four zones (Weija & Gbawe ₵15, Kasoa road ₵20, Mallam & McCarthy Hill ₵25, further into Accra ₵40 per trip) are samples.
5. **What the ₵400 plan covers.** The app's Solo plan is 4 basket washes a month with free pickup, and Family (₵750, 8 baskets) is a sample. Is there an item cap, a pickup limit, a household rule?
6. **Dry cleaning prices.** Suit ₵60, blazer ₵35, kente ₵80, agbada ₵50, duvet ₵70, bedsheet set ₵30, curtains ₵25 a panel, towels ₵20 for four and stain rescue ₵15 are samples. Gowns are priced at the counter.
7. **Ironing by item.** The list says ₵5–10. The app uses ₵5 shirts and trousers, ₵8 dresses, ₵10 native sets.
8. **Express fee per order or per basket?** The app charges ₵50 once per order.
9. **Turnarounds for special garments.** The app uses 48 hours for suits, agbada, duvets and curtains, 72 for kente, and 96 for gowns.

## Going live with Paystack
- The app starts the payment with the public key. The secret key lives only on the server.
- An order or plan month is marked paid only after the server verifies the transaction (Paystack verify API, or a webhook with a checked signature), and the verified amount and currency (GHS) match what's due.
- The Paystack reference (`AL1042-XXXXXX`) is unique per attempt, so a repeated webhook can't record a payment twice.
- Receipts are numbered on the server after verification.
- Plan renewals become Paystack subscriptions, with the renewal reminder as the fallback.

## Out of scope (demo)
Real authentication, live Paystack and WhatsApp (they need the server above), automatic reminders, detergent stock, machine scheduling, multi-staff roles and shifts, a rider's own app.

## Decision log
| Decision | Alternatives | Why |
|---|---|---|
| Copy the house system and retune it | Build from scratch | Calvin asked for the same structure as the previous builds, and it's proven |
| Check-in with a count before anything moves | Start washing on booking | A count at the counter stops "you lost my shirt", the most common laundry dispute |
| Ready time set at check-in | Set at booking | A rider pickup can arrive hours after booking, and the promise should start when the clothes are in |
| Express counts open hours only | Wall-clock hours | The shop closes at 9pm, so wall-clock hours would promise times nobody is there |
| Plan covers baskets, not items | An item cap | The price list is by basket, and that's what the counter already counts |
| Fees stored on the order | Work them out by subtraction | Plan cover, express and discounts combine, and subtraction got the breakdown wrong |
| Blue and aqua from the price list | Keep another build's palette | They're the shop's own colours |
| Keep charcoal and aqua across the app, navy and gold only in the home hero | The logo's navy and gold everywhere | Tried in October 2026; the owner preferred the original look. Text greys were darkened instead, so small text still passes 4.5:1 |
| Stills from the shop's TikTok videos | Stock photos | Video is all they've published; it's their real shop, staff and work |
