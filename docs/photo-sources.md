# Photo sources

Aromatic Laundry has only published video, so almost every photo in the app is a still from its own TikTok videos on [@aromatic.laundry1](https://www.tiktok.com/@aromatic.laundry1). The videos were downloaded on 1 Oct 2026 (`brand/tiktok-videos.txt`, `brand/source-video/`). `scripts/extract_frames.py` keeps the sharpest frame of each shot. `scripts/pick_photos.py` crops the chosen ones clear of captions and stickers, and records the video and the second each came from.

| In the app | Video | Posted | Second | What it shows | Used for |
|---|---|---|---|---|---|
| `shop-front` | [7646467377156148501](https://www.tiktok.com/@aromatic.laundry1/video/7646467377156148501) | 1 Jun 2026 | 14.0 | The shopfront inside the mall | Home gallery |
| `shop-counter` | [7646781272475405589](https://www.tiktok.com/@aromatic.laundry1/video/7646781272475405589) | 2 Jun 2026 | 21.7 | The counter | Home gallery, how it works, login |
| `machines` | [7646710010172476693](https://www.tiktok.com/@aromatic.laundry1/video/7646710010172476693) | 2 Jun 2026 | 12.6 | Washers and dryers | Home gallery, how it works |
| `stain-treatment` | [7647645416665664788](https://www.tiktok.com/@aromatic.laundry1/video/7647645416665664788) | 4 Jun 2026 | 18.8 | Palm-oil stain treated by hand (the pinned 19K-view video) | Stain rescue, home gallery |
| `shirts-pressed` | [7648261643452894485](https://www.tiktok.com/@aromatic.laundry1/video/7648261643452894485) | 6 Jun 2026 | 6.5 | A week of shirts pressed on hangers | Ironing |
| `suit-care` | [7648356816027438356](https://www.tiktok.com/@aromatic.laundry1/video/7648356816027438356) | 6 Jun 2026 | 16.8 | A suit being pressed | Suits |
| `folded-stack` | [7648693722221169940](https://www.tiktok.com/@aromatic.laundry1/video/7648693722221169940) | 7 Jun 2026 | 24.5 | Folded, sealed laundry | Medium basket, baskets category, home gallery |
| `team` | [7648693722221169940](https://www.tiktok.com/@aromatic.laundry1/video/7648693722221169940) | 7 Jun 2026 | 17.1 | An attendant in the shop's uniform | Home gallery |
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

## Not used

- **The "Opening soon, 50% off, workers needed" poster** on the shopfront (1 Jun video, second 3.8): it was out of date by opening day.
- **The basket-sorting shot** (26 Jun video, the price post): the "Pick up available" caption runs across the top and no crop clears it.
- **The owner-welcome frame**: a caption ran across it and no crop cleared it, so it was dropped.

## Resolution, honestly

The videos are 1080×1920 (the June posts), 720×1280 or 576×1024 (most later posts). A still from a compressed phone video is softer than a photo, whatever its size. Every TikTok still was upscaled with Real-ESRGAN x4plus (`scripts/upscale_photos.py`) and blended back with a little of the original so fabric keeps its grain. That invents detail rather than recovering it, which is why the crops avoid faces and fine text.

**The real fix is the shop's own photos.** One WhatsApp message to Diane gets the originals from her phone. Drop them in `brand/photos-original/` under the names above and run `python scripts/build_photos.py`. Nothing else has to change.
