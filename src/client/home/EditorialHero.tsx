import { ArrowLeft, ArrowRight } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/Brand";
import { RULES, SHOP } from "../../data/business";
import { SERVICES } from "../../data/catalog";
import { money } from "../../lib/format";
import { motionMode } from "../../motion";
import { initHero } from "./heroSlideshow";

type Look = "light" | "ghost";
type Action = { label: string; look: Look } & ({ to: string } | { prices: true });
type Slide = {
  label: string;
  /** Base name of the crops in public/photos/hero (scripts/build_hero_photos.py). */
  photo: string;
  alt: string;
  kicker: string;
  lines: [string, string];
  copy: string;
  actions: Action[];
};

/** Behind every slide while the photos change over; the logo's navy, white text on top. */
const NAVY = "#0b1d4a";
const INK = "#ffffff";

const basketFrom = Math.min(...SERVICES.filter((s) => s.category === "baskets").map((s) => s.price));

/** Professional Unsplash photos, credited in docs/photo-sources.md. */
const SLIDES: Slide[] = [
  {
    label: "Cleaner clothes",
    photo: "towels",
    alt: "Freshly washed white towels, folded and stacked",
    kicker: "West Hills Mall, Weija",
    lines: ["Cleaner", "Clothes"],
    copy: `Wash, dry, iron and fold from ${money(basketFrom)} a basket.`,
    actions: [
      { label: "Book now", look: "light", to: "/order/new" },
      { label: "See prices", look: "ghost", prices: true },
    ],
  },
  {
    label: "Stain rescue",
    photo: "bedding",
    alt: "Crisp white pillows and bedding in a bright bedroom",
    kicker: "Treated by hand",
    lines: ["Stain", "Rescue"],
    copy: "Palm oil, wine, ink and food, worked out before the wash.",
    actions: [{ label: "Book stain care", look: "light", to: "/explore?category=care" }],
  },
  {
    label: "Pickup and delivery",
    photo: "curtains",
    alt: "A sunlit room with fresh linen curtains and a side table",
    kicker: "Rider pickup & delivery",
    lines: ["Door", "to Door"],
    copy: "Our rider collects and brings it back across Weija, Kasoa and Accra.",
    actions: [{ label: "Book a pickup", look: "light", to: "/order/new" }],
  },
  {
    label: "Ironing and suits",
    photo: "blazer",
    alt: "A pressed navy blazer on a hanger",
    kicker: "Ironing, suits & kente",
    lines: ["Sharp", "& Pressed"],
    copy: `Ready in 24 hours, or ${RULES.expressHours} hours with express.`,
    actions: [{ label: "See prices", look: "light", prices: true }],
  },
];

const srcSet = (photo: string, shape: "tall" | "wide", widths: number[]) => widths.map((w) => `/photos/hero/${photo}-${shape}-${w}.webp ${w}w`).join(", ");

/**
 * The home page's opening slideshow, in the editorial style of the Queens Wigs & Bundles build:
 * the shop's name across the top, a photo filling the hero behind a big two-line title, and slides
 * that switch on their own (see ./heroSlideshow.ts). GSAP owns this markup once it mounts, so the
 * component is memoised and takes only a stable callback; it never re-renders.
 */
export const EditorialHero = memo(function EditorialHero({ onSeePrices }: { onSeePrices: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => initHero(ref.current, { motion: motionMode() }), []);

  return (
    <section ref={ref} className="hero" aria-roledescription="carousel" aria-label={`${SHOP.name} highlights`}>
      <div className="hero__brand">
        <AppIcon size={32} />
        <span>{SHOP.name}</span>
      </div>

      {SLIDES.map((slide, i) => (
        <div key={slide.label} className="hero__slide" data-bg={NAVY} data-ink={INK} data-nav-theme="dark" data-label={slide.label}>
          {/* Wide crop on landscape screens, tall crop on portrait ones; both fill the hero. */}
          <div className="hero__frame">
            <picture className="hero__picture">
              <source media="(orientation: landscape)" srcSet={srcSet(slide.photo, "wide", [1280, 1920, 2560])} sizes="(min-width: 1248px) 1200px, 100vw" />
              <img
                className="hero__img"
                src={`/photos/hero/${slide.photo}-tall-1080.webp`}
                srcSet={srcSet(slide.photo, "tall", [720, 1080, 1440])}
                sizes="100vw"
                width={1080}
                height={1440}
                alt={slide.alt}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                decoding="async"
                draggable={false}
              />
            </picture>
          </div>
          <p className="hero__title" role="heading" aria-level={2}>
            <span className="hero__kicker">{slide.kicker}</span>
            <span className="hero__line">{slide.lines[0]}</span>
            <span className="hero__line">{slide.lines[1]}</span>
          </p>
          <div className="hero__copy">
            <p data-hero-fade>{slide.copy}</p>
            <div className="hero__ctas" data-hero-fade>
              {slide.actions.map((action) =>
                "to" in action ? (
                  <Link key={action.label} className={`hero-btn hero-btn--${action.look}`} to={action.to}>
                    {action.label}
                  </Link>
                ) : (
                  <button key={action.label} type="button" className={`hero-btn hero-btn--${action.look}`} onClick={onSeePrices}>
                    {action.label}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Turns as the page scrolls; the logo's own tagline runs round it. */}
      <div className="hero__badge" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs>
            <path id="hero-badge-circle" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" />
          </defs>
          <text>
            <textPath href="#hero-badge-circle">Cleaner clothes · Better living · Weija ·</textPath>
          </text>
          <path d="M56 46a4 4 0 1 1 4 4v5M60 55L41 69h38z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>

      <div className="hero__controls">
        <button className="hero__arrow" type="button" data-hero-prev aria-label="Previous slide">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <div className="hero__dots" />
        <button className="hero__arrow" type="button" data-hero-next aria-label="Next slide">
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </section>
  );
});
