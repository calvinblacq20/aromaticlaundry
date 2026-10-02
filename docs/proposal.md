# Aromatic Laundry — What We Can Offer

Based on the business research ([business-research.md](business-research.md)) and the structure already shipped for Franz Qlodin, Ruffles and Baked by H, and Royal Hair.

## The shared structure we reuse

All three builds have the same two halves:

| Client app (phone-first, web) | Owner side (`#/admin`) |
|---|---|
| Home (hero, How it works, Why bento, closing CTA) | Today (work due, money in) |
| Explore (catalogue / price list) | Orders: list and board by stage |
| Order or booking flow, with the price shown up front | New walk-in / WhatsApp order |
| My orders, order detail, live stage tracking | Order detail, stage actions, WhatsApp update (prefilled) |
| Official receipts | Clients, with a private notebook and preferences |
| Profile, WhatsApp-code login, guest checkout | Appointments / slots |
| Map card, branches, privacy, terms | Payments and receipts, reports, reviews approval |
| Paystack / MoMo (Franz, Ruffles) or pay at the shop (Royal Hair) | Prices editable live, settings, expenses (Ruffles) |

Behind it: the photo pipeline (TikTok → upscale → web sizes), PRD, ADRs, GO-LIVE-INFO, SHIP-CHECKLIST, CI, and a demo build seeded with five months of realistic data.

## How it maps to a laundry

| Template piece | Aromatic Laundry version |
|---|---|
| Catalogue | Price list: small ₵50 / medium ₵80 / big ₵120 basket, ironing ₵5–10, suits, kente, duvets, dry cleaning |
| Order flow | **Book a pickup** or **drop off at the mall**: pick basket(s) → standard 24h or express 3h (+₵50) → pickup slot and address → care notes → pay now or on delivery |
| Stage tracking (cakes go *Baking → Decorating*) | **Received → Washing → Drying → Ironing & folding → Ready → Out for delivery → Delivered/Collected**. Dry-clean items get their own stages |
| Appointments | **Pickup and delivery runs**: time slots, zones with fees (Weija, Kasoa, Mallam, Gbawe, McCarthy Hill…), a driver's route list for the day |
| Today | Loads due in the next 3 hours, express jobs flagged, overdue in red, pickups and deliveries today, cash and MoMo taken |
| Orders board | Columns per stage, so staff move tickets as machines finish |
| Walk-in order | Desk intake at the mall: client's phone, basket size, **garment count**, **intake photos of stains/damage**, ticket number |
| Client notebook (head sizes, allergies) | **Laundry preferences**: fold or hang, starch, fragrance choice (the "Aromatic" promise), delicate items, home address and gate notes |
| Receipts | Claim ticket plus official receipt; the ticket number is what you collect with |
| Reviews | Approve reviews; seed with the real TikTok testimonials |
| Reports | Baskets per day, revenue by service, express share, delivery zones, repeat customers, subscription usage |
| Expenses (Ruffles) | Detergent, fragrance, gas/electricity, fuel for deliveries → real margin per basket |
| WhatsApp updates | "Your laundry is ready", "Driver is on the way", "Pickup confirmed", all prefilled with nothing sent automatically (same as the others) |

## What's new for laundry (not in the earlier builds)

1. **Monthly plans.** This turns the vague GH₵400 offer into clear tiers, for example *Solo ₵400: about 50 items, 4 pickups* / *Family: more items*. It shows "items left this month", sends renewal reminders and handles MoMo/Paystack recurring payments. Their best-performing offer post (1,220 likes) needs exactly this.
2. **Intake proof.** Garment count and photos at drop-off protect against "you lost my shirt" and damage disputes.
3. **Due-time engine.** Express versus standard due times calculated from opening hours (7am–9pm, every day), so the 3-hour promise can be checked.
4. **Delivery zones and fees.** This fixes the "delivery fee unknown" gap.
5. **Loyalty and referrals.** For example "10th basket free" or "refer a friend, ₵20 off".

## What we can do before building anything

These cost little and help the pitch:

1. **Pitch with proof.** Royal Hair is **in the same mall (West Hills)**. Show its demo alongside Franz Qlodin and Ruffles: "this is what your shop would look like".
2. **A demo build first, the same playbook as the other three.** Prices are taken from her real price list, photos come from her TikTok, and five months of seeded orders are included. It's a localStorage demo with no backend, so it's cheap to produce and she can tap through it on her phone.
3. **Get the business facts straight** (these go into GO-LIVE-INFO):
   - What the ₵400 plan includes, and the subscriber count so far
   - Delivery fees and radius
   - Dry-clean prices, and whether that work is in-house or outsourced
   - Which phone number is official (054 890 8101 or 054 653 8268)
   - Capacity: machines, staff, and drivers or riders
   - Payment: pay on collection/delivery, online, or both
4. **Quick wins we can hand her now, no code needed:**
   - Set up a Google Business Profile with the mall pin, hours, photos and price list (she doesn't appear on Maps today)
   - Pick one tagline (she uses three)
   - A clearer price card covering delivery fees and plan tiers
   - A content plan built from what worked: stain before/afters, rain and season hooks, price-led offers, testimonials
5. **Package options to quote:**
   - **A: Website only.** Price list, plans, WhatsApp booking, map, reviews, SEO for "laundry Weija/Kasoa".
   - **B: Client app plus owner side** (like Franz/Ruffles). Booking, tracking, receipts, admin.
   - **C: B plus live backend.** Real data, staff logins, Paystack verification, subscriptions. This is the go-live step that the other three are also still waiting on.

## Decisions for her (these become ADRs)

- How customers pay: on delivery/collection, online, or both (Royal Hair is pay-at-shop; Franz/Ruffles use Paystack)
- The subscription rules: item cap, rollover, household sharing
- Who runs deliveries: own rider, or a partner (Bolt/Yango delivery)
- Whether there's one branch now and room for more later (Royal Hair already supports branches)
