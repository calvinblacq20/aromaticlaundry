# Structure reference: Fresha client app

> **Aromatic Laundry adaptation.** This reference came from the Franz Qlodin build by way of Ruffles and Baked and Royal Hair, and this app reuses its layout, components and motion unchanged. What differs: the palette (the system's ink `#242426` on cool grey `#EBEFF5`, with aqua `#7AD7F0` from the shop's price list as the one accent, called `aqua` in code where the tailor build said `lime`; see `src/styles/tokens.css`), the logo emblem (`src/components/Brand.tsx`), and the vocabulary:
>
> | Tailor build | Aromatic Laundry |
> |---|---|
> | Styles, catalogue | Services, the price list (baskets, ironing, suits & kente, bedding, stains) |
> | Measurements, measuring visit | Care preferences (folded or hung, starch, scent); garment count at check-in |
> | Fitting | Rider pickup and delivery windows (two hours, three runs each) |
> | Deposit (50%) | Pay now, pay when it's done, or on the monthly plan |
> | Cutting · Sewing · Fitting | Checked in · Washing · Ironing & folding |
> | Rush (+20%) | Express: 3 open hours, +GH₵ 50 per order |
> | Workshop | The floor (what's in the machines) |
> | Instagram | TikTok |

Source: `STRUCTURE REFERENCE/` (2 screen recordings, 147s and 13s, plus 2 screenshots) of the Fresha client app booking a hair salon in Kumasi.
Rule for this project: **take the structure and flow from Fresha, the look (fonts, patterns, motion) from Makro (`design-reference.md`) in Aromatic Laundry's colours, and the content from Aromatic Laundry.** Every Fresha logo is replaced with the Aromatic Laundry washer mark.

---

## 1. App shell
- **Floating bottom tab bar:** a white pill with a soft shadow and 4 tabs (Home · Search · Activity · Profile). The active tab gets a rounded grey highlight and a coloured icon; the Profile tab shows the user's initial in a circle.
- Large page titles ("Activity") with a round search button top-right. On scroll, the title collapses into a sticky header that keeps the filter chips.
- Every screen shows **skeleton loaders** (grey blocks in the shape of the layout) before content.

## 2. Screens seen, in order

### Activity tab
- Filter chips: **Appointments (7)** (active = black fill), Gift cards, Memberships
- Section headers **Upcoming / Past**
- Row: square venue thumbnail · bold venue name · `Tue, 15 Sept 2026 at 09:30` · `GHS 60 • 1 item` · outline **Rebook** pill
- Empty state: small illustration · "No gift cards" · one-line explanation · outline **Search venues** button

### Profile tab
- Big name + "Personal profile" + avatar circle
- **Wallet balance** card (bright gradient) with an outline "View wallet" button
- **Confirm your phone number** card ("We'll send a code to +233…", outline "Confirm number")
- Menu card: Profile · Favourites · Messages · My appointments · Forms · Settings (line icons)
- Card: Support · Language
- Card: Log out

### Venue page (Home)
1. Skeleton → **hero photo carousel** (`1/7` counter) with round back, share and favourite buttons
2. White sheet with rounded top overlapping the photo: name · category · ★ 4.8 (1,368) · open status ("Closed – opens Tuesday at 09:00") · address chip
3. About, with "Read more"
4. **Sticky section tabs** that follow the scroll position: Photos · About · Services · Team · Reviews · Portfolio · Other
5. Services: category chips (Featured, …) · service cards (name, duration, "from GH₵100", outline **Book**) · "See all 35 services"
6. Team: round avatars with rating badges, name, role
7. Reviews: count + "See all" · AI summary paragraph · review items (initials avatar, stars, text, "3 days ago · service · with Omar") · "See all 1,368 reviews"
8. Portfolio photo grid
9. Opening times (green dot per open day)
10. Additional info with icons (Instant confirmation, Parking available…)
11. Map + address + "Get directions"
12. Loyalty: points, rewards, membership tier, **Refer a friend**
13. Venues nearby carousel
- **Sticky bottom bar:** "35 services available" + black **Book now** pill

### Booking flow (full-screen modal, ← back and × close on every step)
| Step | Structure |
|---|---|
| 1 Select services | Big title · sticky category chips + list button · service cards with **＋**; the selected card gets a coloured border and check · a floating "1 selected service ↑" pill when the selection scrolls out of view · sticky bar **`GHS 60 / 1 item • 30 mins` + Continue →** |
| 2 Select professional | "For you" (last seen) · "All professionals": **Any professional – maximum availability** · professional cards (photo, rating, View profile, Select) |
| 3 Select date and time | Professional dropdown chip (opens a bottom sheet) · calendar button (opens a month-view bottom sheet) · **horizontal date strip** (selected filled, unavailable greyed) · "Pick a time" list of slot rows; changing the date shows a loader in the slots before the list appears |
| 4 Review and confirm | Venue card (photo, name, stars, address) · date + time range + duration · service lines · Total · Discounts and benefits [Add] · Cancellation policy · Important information · Comments or requests [Add] · sticky **Total + Confirm** |
| 5 Success | Confirm button → **3-dot loader** → **full-screen animated gradient with ✓ "Appointment confirmed"** (≈1.5s) → dissolves into the booking detail |

A push notification arrives right after, from the Fresha app with its logo: "Your appointment is booked for tomorrow… complete a short form".

### Booking detail
- Hero photo with the venue name; collapses on scroll into a white app bar "← Venue name"
- **Status badge:** Cancelled (red) / Action required (yellow)
- Big title **"Tomorrow at 09:30"** + duration
- **Action banner** (yellow card): "Complete the consultation form before your appointment · Complete now →"
- Actions card (tinted icon squares): Add to calendar · Get directions · Send message · Venue details. Past or cancelled bookings show Book again · Send message · Venue details.
- Overview card: service · "30 mins with **Baffour**" · Total
- **Forms** list: form name + "Complete before 15 Sept 2026" (orange) + chevron
- More details: Cancellation policy card with **Reschedule appointment** / **Cancel appointment** rows · Important info
- Getting there: map, written directions ("Opposite …, first floor") and "Get directions"
- Booking reference at the bottom
- Sub-flows:
  - **Add to calendar** is a bottom sheet (Google / Other calendar)
  - **Get directions** is a popover (Apple Maps / Google Maps)
  - **Send message** opens a chat screen (venue header plus a composer with attach and send)
  - **Cancel** is a bottom sheet: "Are you sure you want to cancel?" + booking card + "Not sure? Contact directly [Call]" + Go back / **Yes, cancel** (red) → gradient "Appointment cancelled" → detail with Cancelled badge → push notification

## 3. Interaction and motion patterns
- Skeleton → content crossfade on every load
- Flow steps push in from the right; the booking flow opens as a full-screen sheet sliding up; bottom sheets slide up over a dimmed backdrop, with the page behind scaling back slightly
- A collapsing hero header becomes a solid app bar; section tabs highlight the section in view
- Sticky bottom action bars on every flow step and detail page
- Selection: border + check pop; selected date fills
- Buttons show a 3-dot loader while an action is running
- Success and cancel screens: full-screen moving gradient + ✓ + big type, then dissolve

## 4. Mapped to Aromatic Laundry

| Fresha | Aromatic Laundry |
|---|---|
| Home = venue page | **Shop page**: shop-photo carousel, "Premium laundry & dry cleaning · West Hills Mall", rating, open status, address. Section tabs: Gallery · About · Prices · Plans · Reviews · Info |
| Search | **Explore**: search services and filter by category (baskets, ironing, suits & kente, bedding, stains) |
| Activity (Appointments / Gift cards / Memberships) | **Orders** tab: chips **Orders · Pickups · Receipts**; rows show the services, ready time, GH₵ and the stage badge |
| Memberships | **Plans**: Solo and Family, baskets left this month, renew, cancel at the end of the month |
| Profile (wallet, confirm phone, menu) | **Profile**: your details · **My plan** · **Laundry preferences** (finish, starch, scent) · saved services · messages (WhatsApp) · my orders · pickups and deliveries · TikTok · support · log out. Signed out: find my order, orders on this phone, monthly plans |
| Services with categories | **Price list** by category, with "About 10–15 clothes", the price, and "ready in 24 hours" |
| Select professional | **Care & speed**: folded or on hangers, starch, scent, notes; standard or express (+GH₵ 50, 3 hours) |
| Select date and time | **Pickup & return**: drop off at a half-hour slot, or a rider pickup by area and two-hour window; then collect, or a delivery window that opens once it's ready |
| Review and confirm | Service lines, fee breakdown (rider, express, plan cover), pay now / when it's done / on the plan, policies, comments |
| "Appointment confirmed" | **"Pickup booked" / "Drop-off booked"** (Makro colours) |
| Booking detail | **Order detail**: stage badge (Pickup booked · At the counter · Washing · Ironing & folding · Ready · On its way · Delivered) · "Ready tomorrow at 09:00" · action banner (pay now, add the rider window to the calendar, directions) · **stage tracker** · the garment count and notes from check-in · Overview (items, fees, paid, balance) · **Receipts** · care and handover · cancel before pickup · order reference |
| Rebook / Book again | Book again with the same services and care |
| Loyalty / Refer a friend | Loyalty points |
| Push notification with Fresha logo | In-app notification banner with the **Aromatic Laundry mark** |

The owner side reuses the same patterns (lists, chips, bottom sheets, sticky bars, status badges, skeletons), with Makro's dashboard for the Today screen. Its layout rules are in `admin-ui-guidelines.md`.
