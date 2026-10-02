# Aromatic Laundry: Laundry App (demo)

Booking and counter app for **Aromatic Laundry**, the laundry inside West Hills Mall, Weija (Accra–Kasoa road). It washes, dries, irons and folds by the basket, presses shirts and native wear by the piece, cleans suits, kente and gowns, does duvets and curtains, and treats stains before the wash. Open every day, 07:00–21:00.

Clients pick baskets and items from the shop's own price list, choose how they like it done (folded or on hangers, starch, scent), choose standard (24 hours) or express (3 hours), drop it at the counter or book the rider, pay with Mobile Money or card, follow every stage and keep official receipts. Monthly plans cover a set number of basket washes with free rider trips.

The owner runs the shop from `#/admin`:

- the counter: today's queue and check-in with a garment count, notes and photos
- orders, as a list and as a board by stage
- counter drop-offs
- rider runs
- clients with their care preferences
- plans and renewals
- payments, expenses and reports
- reviews, services and prices, and settings

- Business facts, scope and open questions: `docs/PRD.md`
- Research and the proposal it came from: `docs/business-research.md`, `docs/proposal.md`
- Photos and their licences: `docs/photo-sources.md`
- Look and structure, shared with the other builds on this system: `docs/design-reference.md`, `docs/structure-reference.md`, `docs/admin-ui-guidelines.md`

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173 (client) or http://localhost:5173/#/admin (owner).

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Screen sizes

| Width | Layout |
|---|---|
| Under 810px (phones) | App layout: bottom tab bar, bottom sheets, sticky bottom action bars |
| 810–1023px (tablets) | Floating top nav and footer, wider grids, dialogs instead of bottom sheets |
| 1024px and up (desktop) | Two-column pages with sticky side cards on the home page, order flow and order page |

## How an order moves

`booked → received → washing → finishing → ready → out → done` (or `cancelled`). `out` only applies when the rider brings it back; counter collections go straight from ready to done.

- **Check-in is the defence against "you lost my shirt".** Nothing moves past *booked* until the counter counts the garments, notes anything already wrong (stains, loose buttons), optionally adds up to four photos, and confirms the final price. The client gets the count on WhatsApp.
- **The clock starts at the counter, not at booking.** Ready time is worked out at check-in: 24 hours for standard (longer for suits, kente and gowns), or 3 *open* hours for express, so express handed in at 20:00 is ready at 09:00 the next morning.
- **The rider runs in two-hour windows**, three runs per window. A delivery window can't start before the laundry will be ready.
- **Handing over needs the balance paid**, unless the owner chooses to let it go home owing.

## Demo notes

- All data is sample data kept in the browser (`localStorage`). **Profile → Reset demo data** (client) or **Settings → Reset demo data** (admin) restores it.
- Basket, ironing and express prices are the shop's own, from its TikTok price list. Rider fees, plan allowances, suit, kente, bedding and stain prices are samples for the owner to confirm in **Services & prices** and **Settings**; `docs/PRD.md` lists exactly which.
- The shop's order book is simulated from its opening on 1 June 2026 from fixed seeds (`src/data/shop-seed.ts`), dated relative to today, so there's always something just checked in, something in the machines and something waiting on the shelf.
- The owner side has no login in the demo.
- You start without an account and can book without one. To see a plan, saved care preferences and order history, log in from **Profile** with the sample account `024 555 0142`, which is on the Solo plan.
- Paystack payments and WhatsApp login codes are simulated. The code shows up as a notification at the top of the screen, and no money moves.
- WhatsApp updates and renewal reminders open WhatsApp with the message filled in; nothing is sent automatically.
- Going live needs a server to verify Paystack payments; see "Going live with Paystack" in `docs/PRD.md`.

## Photos

The shop has only published video, so its photos are stills pulled from the videos on [@aromatic.laundry1](https://www.tiktok.com/@aromatic.laundry1). Two more come from Wikimedia Commons: a kente cloth (CC0) and the West Hills Mall frontage (CC BY-SA 4.0, credited on the map card). Eight services the shop hasn't filmed (trousers, dresses, kaftans, blazers, agbada, bedsheets, curtains, towels) use Unsplash photos, cropped to the garment. `docs/photo-sources.md` lists each one with its licence.

The pipeline, in order:

```bash
python -m yt_dlp -a brand/tiktok-videos.txt -o "brand/source-video/%(id)s.%(ext)s" --write-info-json
```

Downloads the videos listed in `brand/tiktok-videos.txt`.

```bash
python scripts/extract_frames.py
```

Splits each video into shots and keeps the sharpest frame of each in `brand/frames/`, with a contact sheet per video in `brand/sheets/` for choosing.

```bash
python scripts/pick_photos.py
```

Crops the chosen frames (listed in the script, with the timestamp of each) clear of captions and writes named originals to `brand/photos-original/`. It also crops the Commons and Unsplash photos from `brand/internet/`, at up to 4K.

```bash
python scripts/upscale_photos.py --model path/to/real_esrgan_x4plus.onnx --threads 5 [names...]
```

Upscales every original under 70% of 4K to a 4K master with Real-ESRGAN x4plus ([qualcomm/Real-ESRGAN-x4plus](https://huggingface.co/qualcomm/Real-ESRGAN-x4plus), BSD-3-Clause) on the CPU. Needs `pip install onnxruntime opencv-python numpy`. Output goes to `brand/photos-upscaled/`, which git ignores. A full run takes about an hour, so split the names across a few processes. Without it, the small stills get no 4K file.

```bash
python scripts/build_photos.py
```

Writes four WebP sizes per photo to `public/photos/` (480px, 1080px, 2160px, and 4K at a 3840px long side) and `src/data/photo-manifest.json`, so the browser picks the right size. `src/components/Bits.test.ts` checks that every photo the app uses is built, at 4K.

To add a photo for a service, put the JPG or PNG in `brand/photos-original/`, run the last script, and set `photo: "/photos/name.webp"` on the service in `src/data/catalog.ts`.

## Brand files

The colours come from the shop's logo: navy `#0b1f4f` (the AROMATIC wordmark) for buttons, dark bands and selected states, under white text; gold `#f5b301` (LAUNDRY and the folded stack) as the one bright accent, always under dark text; royal `#1340b8` for links and active text. Text is near-black `#0d1321` on a crisp cool ground `#f2f4f8`, and every grey used for text clears 4.5:1. In code the accent slot is still called `aqua` (it is in button variants, badge tones and saved catalog data); `src/styles/tokens.css` points it at gold.

The logo is the shop's own (`brand/logo/aromatic-laundry-logo.png`): a navy shirt on a hanger with a gold folded stack and scent rising, over the AROMATIC LAUNDRY wordmark and "Cleaner clothes. Better living". `python scripts/make_icons.py` cuts it into everything the site uses: the emblem (`public/brand/al-emblem.webp`, used by `LogoMark` and `AppIcon` in `src/components/Brand.tsx`), the lockup in the desktop footer (`al-logo.webp`), the favicons, the home-screen icons and the six layers of the launch screen. The launch screen lives in `index.html` so it paints before the app's script loads; `Splash` in `src/components/Overlays.tsx` takes it down. Swap in a vector of the logo when the shop has one.
