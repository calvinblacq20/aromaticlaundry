# Photo sources

Aromatic Laundry has only published video, so every photo of the shop and its work is a still from its own TikTok videos on [@aromatic.laundry1](https://www.tiktok.com/@aromatic.laundry1). Services the shop hasn't filmed yet use freely licensed photos from Unsplash and Wikimedia Commons (below). The videos were downloaded on 1 Oct 2026 (`brand/tiktok-videos.txt`, `brand/source-video/`). `scripts/extract_frames.py` keeps the sharpest frame of each shot. `scripts/pick_photos.py` crops the chosen ones clear of captions and stickers, and records the video and the second each came from.

| In the app | Video | Posted | Second | What it shows | Used for |
|---|---|---|---|---|---|
| `shop-front` | [7646467377156148501](https://www.tiktok.com/@aromatic.laundry1/video/7646467377156148501) | 1 Jun 2026 | 14.0 | The shopfront inside the mall | Sign-in |
| `shop-counter` | [7646781272475405589](https://www.tiktok.com/@aromatic.laundry1/video/7646781272475405589) | 2 Jun 2026 | 21.7 | The counter | How it works, login |
| `machines` | [7646710010172476693](https://www.tiktok.com/@aromatic.laundry1/video/7646710010172476693) | 2 Jun 2026 | 12.6 | Washers and dryers | How it works |
| `stain-treatment` | [7647645416665664788](https://www.tiktok.com/@aromatic.laundry1/video/7647645416665664788) | 4 Jun 2026 | 18.8 | Palm-oil stain treated by hand (the pinned 19K-view video) | Stain rescue |
| `shirts-pressed` | [7648261643452894485](https://www.tiktok.com/@aromatic.laundry1/video/7648261643452894485) | 6 Jun 2026 | 6.5 | A week of shirts pressed on hangers | Ironing |
| `suit-care` | [7648356816027438356](https://www.tiktok.com/@aromatic.laundry1/video/7648356816027438356) | 6 Jun 2026 | 16.8 | A suit being pressed | Suits |
| `folded-stack` | [7648693722221169940](https://www.tiktok.com/@aromatic.laundry1/video/7648693722221169940) | 7 Jun 2026 | 24.5 | Folded, sealed laundry | Medium basket, baskets category |
| `team` | [7648693722221169940](https://www.tiktok.com/@aromatic.laundry1/video/7648693722221169940) | 7 Jun 2026 | 17.1 | An attendant in the shop's uniform | Not shown at the moment |
| `bedding` | [7660529234435280148](https://www.tiktok.com/@aromatic.laundry1/video/7660529234435280148) | 9 Jul 2026 | 8.8 | Bedding, stained to spotless | Duvet, bedding category |
| `gown` | [7675311564437703957](https://www.tiktok.com/@aromatic.laundry1/video/7675311564437703957) | 18 Aug 2026 | 4.8 | A gown on a hanger | Wedding gown |
| `arrivals` | [7679422683053821204](https://www.tiktok.com/@aromatic.laundry1/video/7679422683053821204) | 29 Aug 2026 | 6.9 | A client handing in a bag at the counter | How it works: counted and tagged |
| `basket-small` | [7680521068347493652](https://www.tiktok.com/@aromatic.laundry1/video/7680521068347493652) | 1 Sep 2026 | 2.8 | Fresh folded laundry in a basket | Small basket |
| `handover` | [7685908851903794452](https://www.tiktok.com/@aromatic.laundry1/video/7685908851903794452) | 15 Sep 2026 | 7.2 | A packed bag handed back to a client | How it works: collect or delivery |
| `basket-big` | [7686587666485234965](https://www.tiktok.com/@aromatic.laundry1/video/7686587666485234965) | 17 Sep 2026 | 2.6 | A full basket | Big basket |

The shop's colours come from its price list, `brand/tiktok-photos/price-list.jpg`, a photo post. The price list itself isn't shown as a photo because it's text, and the prices are in the app.

## From Wikimedia Commons

| In the app | File | Author | Licence | Used for |
|---|---|---|---|---|
| `kente` | [Traditional Kente of Volta region.jpg](https://commons.wikimedia.org/wiki/File:Traditional_Kente_of_Volta_region.jpg) | Warmglow | CC0 | Kente cloth |
| `west-hills-mall` | [West Hills Mall 2.jpg](https://commons.wikimedia.org/wiki/File:West_Hills_Mall_2.jpg) | Fquasie | CC BY-SA 4.0 | The map card on Home |

The mall photo is cropped and resized. CC BY-SA asks for credit and for the adapted image to stay under the same licence. The credit "Photo: Fquasie, CC BY-SA 4.0" sits on the photo itself (`src/components/MapCard.tsx`), and the cropped files in `public/photos/west-hills-mall*.webp` are shared under CC BY-SA 4.0.

`brand/internet/kente-tafi.jpg` ([Different Kente cloth, Tafi, Volta region.jpg](https://commons.wikimedia.org/wiki/File:Different_Kente_cloth,_Tafi,_Volta_region.jpg), Warmglow, CC0) was downloaded as an alternative and isn't used.

## From Unsplash

Eight services had no photo because the shop hasn't posted that kind of work. They use professional photos from Unsplash, downloaded at full size on 2 Oct 2026 into `brand/internet/unsplash-*.jpg`.

| In the app | Photo | Photographer | Source size | Used for |
|---|---|---|---|---|
| `trousers` | [kg3N8vqvMd8](https://unsplash.com/photos/kg3N8vqvMd8) | Clem Onojeghuo | 3333×5000 | Trousers or skirt |
| `dress` | [fBCptLC4GJY](https://unsplash.com/photos/fBCptLC4GJY) | Eduardo Espinoza | 4000×6000 | Dress, kaba or slit |
| `kaftan` | [gPT2JJdMnag](https://unsplash.com/photos/gPT2JJdMnag) | Shedrack Salami | 2350×3112 | Kaftan or native set |
| `blazer` | [LkR6zTayf-o](https://unsplash.com/photos/LkR6zTayf-o) | Vetrivel Viswanathar | 4480×6720 | Jacket or blazer; home hero (Sharp & Pressed) |
| `agbada` | [wYV0hKtOblc](https://unsplash.com/photos/wYV0hKtOblc) | Olumide Adekunle | 3648×5472 | Agbada or three-piece native |
| `bedsheets` | [dJkL-w-grqA](https://unsplash.com/photos/dJkL-w-grqA) | byMATTER MADE BETTER | 2624×3936 | Bedsheet set; home hero (Stain Rescue) |
| `curtains` | [VIk1nwibgNE](https://unsplash.com/photos/VIk1nwibgNE) | dimas anggara | 4160×6240 | Curtains; home hero (Door to Door) |
| `towels` | [qPNgpYUCW0c](https://unsplash.com/photos/qPNgpYUCW0c) | Mads Leif Hansen | 6240×4160 | Towels; home hero (Cleaner Clothes) |

All eight are under the [Unsplash License](https://unsplash.com/license): free for commercial use, no credit required (it's given here anyway). The licence doesn't cover the likeness of recognisable people, so the four photos of people are cropped to the garment, below the face: agbada, kaftan and dress from the neckline down, and the trousers from the waist down. That crop also leaves out a bank's sign behind the kaftan. The crops are in `scripts/pick_photos.py`.

These photos show the kind of garment, not the shop's own work. Swap each for a photo of Aromatic Laundry's own pressing once the shop has one, under the same name.

### The home hero

The home page's slideshow fills the whole hero with four of these photos, the ones with nobody in them: towels, bedsheets, curtains and blazer. `scripts/build_hero_photos.py` cuts each into a tall 3:4 crop for portrait screens (720, 1080 and 1440px wide) and a wide 3:2 crop for landscape ones (1280, 1920 and 2560px), straight from the full-size originals, into `public/photos/hero/`. The crop boxes are in the script. To change a hero photo, put the new original in `brand/internet/`, point the slide at it in the script and run `python scripts/build_hero_photos.py`; `src/client/home/EditorialHero.tsx` lists the slides.

## Not used

- **The "Opening soon, 50% off, workers needed" poster** on the shopfront (1 Jun video, second 3.8): it was out of date by opening day.
- **The basket-sorting shot** (26 Jun video, the price post): the "Pick up available" caption runs across the top and no crop clears it.
- **The owner-welcome frame**: a caption ran across it and no crop cleared it, so it was dropped.

## Resolution, honestly

Every photo is built in four sizes, the largest at 4K: a 3840px long side (3072×3840 for the 4:5 photos, 3840×2560 for the mall). The browser only fetches the 4K file when the photo fills a big high-density screen, such as the sign-in photo on a 4K or 5K monitor. Phones still get the 480px or 1080px file.

How each one reaches 4K depends on its source:

| Source | Photos | How it gets to 4K |
|---|---|---|
| Unsplash, 4K or larger after the crop | blazer, curtains, towels | Scaled down. Real 4K detail. |
| Unsplash and Commons, 70–99% of 4K after the crop | trousers, agbada, bedsheets, dress, kente | Enlarged 1.06–1.39× with Lanczos and lightly sharpened. Real detail, slightly softer at 100% zoom. |
| Unsplash and Commons, under 70% of 4K after the crop | kaftan (a sharp 1730px crop), west-hills-mall (a soft 2632px phone photo, which a plain resize left blurry) | Real-ESRGAN x4plus. |
| TikTok stills | the other 14 | Real-ESRGAN x4plus, 3–7× up |

The TikTok videos are 1080×1920 (the June posts), 720×1280 or 576×1024 (most later posts), and TikTok serves nothing larger: `brand/source-video/` already holds the best format each video offers. A still from a compressed phone video is softer than a photo, whatever its size. So the TikTok stills are AI-upscaled to 4K and blended back with a little of the original so fabric keeps its grain. On the 460px `team` still, enlarging to a quarter of 4K before running the model came out about 3.5× crisper at the edges than running it on the raw pixels, so that's what `scripts/upscale_photos.py` does. An upscale invents detail rather than recovering it, which is why the crops avoid faces and fine text. They look clean at phone and laptop sizes, but at 100% on a 4K screen they read as smooth and slightly painted.

**The real fix is the shop's own photos.** One WhatsApp message to Diane gets the originals from her phone. Drop them in `brand/photos-original/` under the names above and run `python scripts/build_photos.py`. Nothing else has to change.
