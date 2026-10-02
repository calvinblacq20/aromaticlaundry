import { ArrowLeft, ArrowRight } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { photoSrcSet } from "../../components/Bits";
import { AppIcon } from "../../components/Brand";
import { RULES, SHOP } from "../../data/business";
import { SERVICES } from "../../data/catalog";
import { money } from "../../lib/format";
import { motionMode } from "../../motion";
import { initHero } from "./editorialHero";

type Look = "light" | "ghost" | "solid";
type Action = { label: string; look: Look } & ({ to: string } | { prices: true });
type Slide = {
  label: string;
  /** Backdrop and text colour the hero blends to; navTheme tells the desktop nav which way to turn. */
  bg: string;
  ink: string;
  navTheme: "dark" | "light";
  photo: string;
  alt: string;
  position: string;
  kicker: string;
  lines: [string, string];
  copy: string;
  actions: Action[];
};

const basketFrom = Math.min(...SERVICES.filter((s) => s.category === "baskets").map((s) => s.price));

/** Navy and gold from the logo, then the brand blue and aqua (docs: src/styles/tokens.css). */
const SLIDES: Slide[] = [
  {
    label: "Cleaner clothes",
    bg: "#0b1d4a",
    ink: "#f4f7fb",
    navTheme: "dark",
    photo: "shop-front",
    alt: "The Aromatic Laundry shopfront inside West Hills Mall",
    position: "center 40%",
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
    bg: "#0a4fb4",
    ink: "#ffffff",
    navTheme: "dark",
    photo: "stain-treatment",
    alt: "A palm oil stain on a white shirt being treated by hand before the wash",
    position: "center 55%",
    kicker: "Treated by hand",
    lines: ["Stain", "Rescue"],
    copy: "Palm oil, wine, ink and food, worked out before the wash.",
    actions: [{ label: "Book stain care", look: "light", to: "/explore?category=care" }],
  },
  {
    label: "Pickup and delivery",
    bg: "#f5b301",
    ink: "#0b1d4a",
    navTheme: "light",
    photo: "handover",
    alt: "A bag of fresh laundry handed back to a client",
    position: "center 45%",
    kicker: "Rider pickup & delivery",
    lines: ["Door", "to Door"],
    copy: "Our rider collects and brings it back across Weija, Kasoa and Accra.",
    actions: [{ label: "Book a pickup", look: "solid", to: "/order/new" }],
  },
  {
    label: "Ironing and suits",
    bg: "#7ad7f0",
    ink: "#0b1d4a",
    navTheme: "light",
    photo: "shirts-pressed",
    alt: "Freshly pressed shirts on hangers, ready to collect",
    position: "center 40%",
    kicker: "Ironing, suits & kente",
    lines: ["Sharp", "& Pressed"],
    copy: `Ready in 24 hours, or ${RULES.expressHours} hours with express.`,
    actions: [{ label: "See prices", look: "solid", prices: true }],
  },
];

/**
 * The home page's opening slideshow, in the editorial style of the Queens Wigs & Bundles build:
 * the shop's name across the top, a portrait photo behind a big two-line title, and slides that
 * switch on their own (see ./editorialHero.ts). GSAP owns this markup once it mounts, so the
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
        <div key={slide.label} className="hero__slide" data-bg={slide.bg} data-ink={slide.ink} data-nav-theme={slide.navTheme} data-label={slide.label}>
          <div className="hero__frame">
            <img
              className="hero__img"
              src={`/photos/${slide.photo}.webp`}
              srcSet={photoSrcSet(`/photos/${slide.photo}.webp`)}
              sizes="(min-width: 810px) 470px, 62vw"
              width={1080}
              height={1350}
              alt={slide.alt}
              style={{ objectPosition: slide.position }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              decoding="async"
              draggable={false}
            />
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
