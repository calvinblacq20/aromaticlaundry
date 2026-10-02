import { Check, Clock, Droplet, Gift, Heart, MapPin, MessageCircle, Pause, Phone, Play, Share2, Shirt, Sparkles, Truck, Wallet, WashingMachine } from "lucide-react";
import { TikTokIcon } from "../components/SocialIcons";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppIcon } from "../components/Brand";
import { Photo, SectionHead, Skeleton, Stars, useSkeleton } from "../components/Bits";
import { Button, Cta } from "../components/Button";
import { MapCard } from "../components/MapCard";
import { Marquee } from "../components/Marquee";
import { Reveal } from "../components/Reveal";
import { CountUp, ScrollRevealText, useScrollTo } from "../components/Scroll";
import { ClosingCta } from "./home/ClosingCta";
import { nextSlide, preloadPhoto, useAutoplay } from "./home/autoplay";
import { useHeroCurve } from "./home/heroCurve";
import { HowItWorks } from "./home/HowItWorks";
import { WhyBento } from "./home/WhyBento";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { CATEGORY_PHOTOS, HOURS, SHOP, SHOP_FEATURES, SHOP_PHOTOS } from "../data/business";
import { CATEGORIES, PLANS, SERVICES } from "../data/catalog";
import { accountOf, useAppData } from "../data/store";
import type { CategoryId } from "../data/types";
import { telLink, whatsappLink } from "../lib/contact";
import { fmtDate, money, weekdayLong } from "../lib/format";
import { serviceLine, servicePrice } from "../lib/items";
import { openStatus } from "../lib/schedule";
import { enter, isCalm, motionMode, spring } from "../motion";

const SECTIONS = [
  { id: "gallery", label: "Gallery" },
  { id: "about", label: "About" },
  { id: "prices", label: "Prices" },
  { id: "plans", label: "Plans" },
  { id: "reviews", label: "Reviews" },
  { id: "info", label: "Info" },
] as const;

const FEATURE_ICONS = { sparkles: Sparkles, clock: Clock, truck: Truck, shirt: Shirt, droplet: Droplet, wallet: Wallet } as const;
const HERO = SHOP_PHOTOS;
const heroShot = (n: number) => HERO[n % HERO.length] ?? HERO[0];
/** Rendered widths of the gallery's big photo and its two side photos. */
const GALLERY_SIZES = ["(min-width: 1024px) 800px, 66vw", "(min-width: 1024px) 400px, 33vw", "(min-width: 1024px) 400px, 33vw"] as const;
const GALLERY_FADE_S = 0.9;
const STATEMENT =
  "Aromatic Laundry is Diane's laundry inside West Hills Mall. Drop a basket at the counter while you shop, or let our rider collect it from your door. We wash, dry, iron and fold, and it comes back smelling the way the name promises.";
const HIGHLIGHTS = [
  { icon: Sparkles, title: "The Aromatic finish", note: "Clothes that smell as clean as they look" },
  { icon: Clock, title: "Ready in 24 hours", note: "Or 3 hours with express" },
  { icon: Truck, title: "We pick up and deliver", note: "Weija, Kasoa and across Accra" },
];
const CATEGORY_TONES = ["sky", "mist", "charcoal", "lilac", "sand"] as const;

export function Home() {
  const loading = useSkeleton(700);
  return loading ? <HomeSkeleton /> : <ShopPage />;
}

function HomeSkeleton() {
  return (
    <main className="screen" aria-busy="true" aria-label="Loading the shop">
      <Skeleton w="calc(100% + var(--gutter) * 2)" h={440} r={0} className="mobile-only" style={{ marginInline: "calc(var(--gutter) * -1)" }} />
      <Skeleton h={520} r={12} className="desktop-only" style={{ marginTop: 4 }} />
      <div className="stack gap-12 intro">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <Skeleton w="62%" h={30} />
          <Skeleton w="30%" h={14} />
          <Skeleton w="48%" h={14} />
          <Skeleton h={40} r={7} />
          <Skeleton w="24%" h={20} style={{ marginTop: 16 }} />
          <Skeleton h={14} />
          <Skeleton w="80%" h={14} />
          <div className="stack gap-12" style={{ marginTop: 16 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={96} r={8} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function ShopPage() {
  const data = useAppData();
  const account = accountOf(data);
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();
  const status = openStatus(now, HOURS);
  const [slide, setSlide] = useState(0);
  const [saved, setSaved] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [category, setCategory] = useState<CategoryId | "featured">("featured");
  const [active, setActive] = useState<string>("gallery");
  const [showHeader, setShowHeader] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const services = useMemo(
    () => (category === "featured" ? SERVICES.filter((s) => s.featured) : SERVICES.filter((s) => s.category === category)),
    [category],
  );
  // Quoted services have no list price, so they don't set the floor.
  const cheapest = Math.min(...SERVICES.filter((s) => s.kind === "fixed").map((s) => s.price));
  const basketFrom = Math.min(...SERVICES.filter((s) => s.category === "baskets").map((s) => s.price));

  useEffect(() => {
    const onScroll = () => setShowHeader(window.scrollY > (heroRef.current?.offsetHeight ?? 300) - 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-130px 0px -55% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const share = async () => {
    const shareData = { title: SHOP.name, text: `${SHOP.name}: ${SHOP.tagline} · ${SHOP.area}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        notify("Link copied", "Paste it anywhere to share the shop.");
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  const scrollTo = useScrollTo();
  const goTo = (id: string) => scrollTo(document.getElementById(id), { offset: window.innerWidth >= 810 ? -140 : -112 });
  // Calm mode (reduced motion, incl. iOS Low Power Mode) leaves out the parallax and zoom below.
  const calm = isCalm();
  // Hero photos drift and settle as the page starts to scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.08]);
  // ...and their bottom edge starts as a U that straightens out. The phone intro sheet overlaps the photo by 24px.
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryCurve = useHeroCurve(galleryRef);
  const heroCurve = useHeroCurve(heroRef, { overlap: 24 });
  // The photos also move on by themselves: the gallery crossfades to the next set, the phone carousel slides.
  const trackRef = useRef<HTMLDivElement>(null);
  // `prev` is the set being covered while the next one fades in over it.
  const [gallery, setGallery] = useState<{ step: number; prev: number | null }>({ step: 0, prev: null });
  useAutoplay(galleryRef, async () => {
    const next = gallery.step + 1;
    await Promise.all(GALLERY_SIZES.map((sizes, i) => preloadPhoto(heroShot(next + i).src, sizes)));
    setGallery({ step: next, prev: gallery.step });
  });
  useAutoplay(heroRef, async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = nextSlide(track.scrollLeft, track.clientWidth, HERO.length);
    await preloadPhoto(heroShot(next).src, "100vw");
    track.scrollTo({ left: next * track.clientWidth, behavior: motionMode() === "full" ? "smooth" : "auto" });
  });

  const actionButtons = (
    <>
      <button className="icon-btn" onClick={share} aria-label="Share the shop">
        <Share2 size={18} strokeWidth={1.8} />
      </button>
      <motion.button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => setSaved(!saved)} aria-pressed={saved} aria-label="Save the shop" whileTap={{ scale: 0.85 }} transition={spring.press}>
        <Heart size={18} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
      </motion.button>
    </>
  );

  return (
    <main className="screen shop">
      {/* Phone: sticky header that appears once the hero scrolls away */}
      <div className="overlay-header mobile-only">
        <AnimatePresence>
          {showHeader && (
            <motion.div className="overlay-header-inner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.micro}>
              <div className="between" style={{ padding: "10px 16px 4px" }}>
                <div className="inline" style={{ gap: 10 }}>
                  <AppIcon size={30} />
                  <span className="t-title">{SHOP.name}</span>
                </div>
                <div className="inline" style={{ gap: 8 }}>
                  {actionButtons}
                </div>
              </div>
              <nav className="section-tabs" aria-label="Shop sections">
                {SECTIONS.map((s) => (
                  <button key={s.id} className={`section-tab ${active === s.id ? "is-active" : ""}`} onClick={() => goTo(s.id)}>
                    {s.label}
                    {active === s.id && <motion.span layoutId="section-underline" className="section-underline" transition={spring.press} />}
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wider screens: photo gallery grid */}
      <motion.div ref={galleryRef} className="desk-gallery desktop-only" style={{ clipPath: galleryCurve.clipPath, WebkitClipPath: galleryCurve.WebkitClipPath }}>
        {GALLERY_SIZES.map((sizes, i) => (
          <div key={i} className="gallery-cell">
            <motion.div className="gallery-inner" initial={calm ? { opacity: 0 } : { scale: 1.18, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.settle, delay: 0.08 * i }} style={calm ? undefined : { y: heroY }}>
              {/* The incoming photo fades in on top; the old one stays underneath until the last cell has finished. */}
              {(gallery.prev === null ? [gallery.step] : [gallery.prev, gallery.step]).map((step) => {
                const shot = heroShot(step + i);
                const incoming = gallery.prev !== null && step === gallery.step;
                return (
                  <motion.div
                    key={shot.src}
                    className="gallery-layer"
                    aria-hidden={step !== gallery.step || undefined}
                    initial={gallery.prev === null ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: GALLERY_FADE_S, delay: 0.12 * i, ease: [0.44, 0, 0.56, 1] }}
                    onAnimationComplete={incoming && i === GALLERY_SIZES.length - 1 ? () => setGallery((g) => ({ ...g, prev: null })) : undefined}
                  >
                    <Photo tone="mist" src={shot.src} alt={shot.alt} position={shot.position} eager={i === 0} sizes={sizes} height="100%" radius={0} markSize={i === 0 ? 150 : 70} />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        ))}
        <motion.span className="desk-gallery-count" style={{ y: galleryCurve.badgeY }}>
          {HERO.length} photos
        </motion.span>
      </motion.div>

      {/* Phone: hero carousel */}
      <motion.div ref={heroRef} className="hero mobile-only" style={{ clipPath: heroCurve.clipPath, WebkitClipPath: heroCurve.WebkitClipPath }}>
        <motion.div
          ref={trackRef}
          className="hero-track"
          style={calm ? undefined : { y: heroY, scale: heroScale }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {HERO.map((shot, i) => (
            <Photo key={shot.src} tone="mist" src={shot.src} alt={shot.alt} position={shot.position} eager={i === 0} sizes="100vw" height={440} radius={0} markSize={120} className="hero-slide" />
          ))}
        </motion.div>
        <div className="hero-actions">{actionButtons}</div>
        <motion.span className="hero-count t-cap" style={{ y: heroCurve.badgeY }}>
          {slide + 1}/{HERO.length}
        </motion.span>
      </motion.div>

      {/* Intro sheet */}
      <motion.section className="intro" {...enter(24)}>
        <div className="between" style={{ alignItems: "flex-start" }}>
          <div className="stack gap-4">
            <h1 className="t-h2">{SHOP.name}</h1>
            <p className="muted">{SHOP.category}</p>
          </div>
          <div className="inline" style={{ gap: 8 }}>
            <span className="pill-tag" title="Figures in this preview are samples">
              Demo
            </span>
            <span className="inline desktop-only" style={{ gap: 8 }}>
              {actionButtons}
            </span>
          </div>
        </div>
        <button className="inline t-body tap-grow" onClick={() => goTo("reviews")} style={{ gap: 6 }}>
          <Stars value={SHOP.rating} />
          <strong style={{ fontWeight: 500 }}>{SHOP.rating}</strong>
          <span className="subtle">({SHOP.reviewCount})</span>
        </button>
        <p className="inline" style={{ color: status.open ? "var(--open)" : "var(--warning-ink)" }}>
          <Clock size={15} />
          <span>{status.label}</span>
        </p>
        <button className="address-chip" onClick={() => goTo("info")}>
          <MapPin size={16} />
          <span className="truncate">{SHOP.area}</span>
        </button>
      </motion.section>

      <div className="shop-layout">
        <div className="shop-main">
          <nav className="section-tabs desk-section-tabs desktop-only" aria-label="Shop sections">
            {SECTIONS.map((s) => (
              <button key={s.id} className={`section-tab ${active === s.id ? "is-active" : ""}`} onClick={() => goTo(s.id)}>
                {s.label}
                {active === s.id && <motion.span layoutId="desk-section-underline" className="section-underline" transition={spring.press} />}
              </button>
            ))}
          </nav>

          {/* Gallery by what we wash */}
          <section id="gallery" className="section anchor">
            <SectionHead
              title="Gallery"
              action={
                <span className="inline" style={{ gap: 4 }}>
                  <button className="icon-btn is-plain lookbook-toggle" onClick={() => setGalleryPaused(!galleryPaused)} aria-pressed={galleryPaused} aria-label={galleryPaused ? "Play the gallery" : "Pause the gallery"}>
                    {galleryPaused ? <Play size={15} strokeWidth={1.8} /> : <Pause size={15} strokeWidth={1.8} />}
                  </button>
                  <Link className="link t-cap" to="/explore">
                    See all
                  </Link>
                </span>
              }
            />
            {/* Photos drift left to right round a curved band; drag to look around, or pause. */}
            <Marquee label="Gallery" className="looks" direction="right" paused={galleryPaused} curved>
              {CATEGORIES.map((c, i) => (
                <Link key={c.id} to={`/explore?category=${c.id}`} className="look-card" aria-label={c.label} draggable={false}>
                  <Photo tone={CATEGORY_TONES[i % CATEGORY_TONES.length] ?? "sky"} src={CATEGORY_PHOTOS[c.id]} alt={`${c.label} at ${SHOP.name}`} sizes="(min-width: 810px) 240px, 150px" ratio="3 / 4" radius="var(--r-img)" markSize={56}>
                    <span className="look-label">{c.short}</span>
                  </Photo>
                </Link>
              ))}
            </Marquee>
          </section>

          {/* About */}
          <section id="about" className="section anchor about">
            <Reveal as="span" look="focus" className="chip-soft">
              <WashingMachine size={13} /> About the shop
            </Reveal>
            <ScrollRevealText className="statement" text={STATEMENT} />
            <div className="highlights">
              {HIGHLIGHTS.map((h, i) => (
                <Reveal key={h.title} className="highlight" y={20} delay={0.1 * i}>
                  <span className="highlight-icon">
                    <h.icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="stack">
                    <span className="t-title" style={{ fontSize: 15 }}>
                      {h.title}
                    </span>
                    <span className="subtle t-cap">{h.note}</span>
                  </span>
                </Reveal>
              ))}
            </div>
            {aboutOpen && (
              <motion.p className="t-lead" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.small} style={{ color: "var(--ink-75)" }}>
                {SHOP.about}
              </motion.p>
            )}
            <button className="link t-body" onClick={() => setAboutOpen(!aboutOpen)} style={{ alignSelf: "flex-start" }}>
              {aboutOpen ? "Show less" : "More about the shop"}
            </button>
          </section>

          {/* Prices */}
          <section id="prices" className="section anchor">
            <SectionHead title="Prices" />
            <div className="chips">
              {[{ id: "featured" as const, short: "Popular" }, ...CATEGORIES].map((c) => (
                <button key={c.id} className={`chip ${category === c.id ? "is-active" : ""}`} onClick={() => setCategory(c.id)}>
                  {c.short}
                </button>
              ))}
            </div>
            <motion.div layout className="card styles-list" style={{ borderRadius: "var(--r-16)" }} transition={spring.small}>
              <AnimatePresence mode="popLayout" initial={false}>
                {services.slice(0, 6).map((service, i) => (
                  <motion.div key={service.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...spring.small, delay: i * 0.04 }}>
                    <div className="style-row">
                      <Photo tone={service.tone} src={service.photo} alt={service.name} sizes="76px" height={76} radius="var(--r-img)" markSize={26} className="style-thumb" />
                      <div className="grow stack gap-4">
                        <p className="t-title">{service.name}</p>
                        <p className="subtle t-cap">{serviceLine(service)}</p>
                        <p className="tabular" style={{ fontWeight: 500 }}>
                          {servicePrice(service)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/order/new?service=${service.id}`)} aria-label={`Book ${service.name}`}>
                        Book
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <Link to="/explore" className="btn btn-outline btn-block">
              See the full price list ({SERVICES.length})
            </Link>
          </section>

          {/* Plans */}
          <section id="plans" className="section anchor">
            <SectionHead
              title="Monthly plans"
              action={
                <Link className="link t-cap" to="/plans">
                  How plans work
                </Link>
              }
            />
            <p className="muted">Your laundry, taken off your list for the month. Basket washes paid up front, pickup and delivery on us.</p>
            <div className="plan-grid">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.id} className={`plan-card ${plan.featured ? "is-featured" : ""}`} y={24} delay={0.08 * i}>
                  <div className="stack gap-4">
                    <div className="between">
                      <p className="t-title">{plan.name}</p>
                      {plan.featured && <span className="badge is-aqua">Most popular</span>}
                    </div>
                    <p className="subtle t-cap">{plan.blurb}</p>
                  </div>
                  <p className="plan-price">
                    <span className="tabular">{money(plan.price)}</span>
                    <span className="subtle t-cap"> / month</span>
                  </p>
                  <ul className="plan-perks">
                    {plan.perks.map((perk) => (
                      <li key={perk}>
                        <Check size={15} strokeWidth={2} />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.featured ? (
                    <Cta className="btn-block" onClick={() => navigate(`/plans?join=${plan.id}`)}>
                      Join {plan.name}
                    </Cta>
                  ) : (
                    <Button variant="outline" className="btn-block" onClick={() => navigate(`/plans?join=${plan.id}`)}>
                      Join {plan.name}
                    </Button>
                  )}
                </Reveal>
              ))}
            </div>
          </section>
        </div>

        {/* Desktop: sticky side card, like the reference venue page on the web */}
        <aside className="shop-aside desk" aria-label="Book with the shop">
          <div className="card aside-card stack gap-12">
            <div className="inline" style={{ gap: 12 }}>
              <AppIcon size={48} />
              <div className="stack">
                <p className="t-title">{SHOP.name}</p>
                <span className="inline t-cap" style={{ gap: 6 }}>
                  <strong style={{ fontWeight: 500 }}>{SHOP.rating}</strong>
                  <Stars value={SHOP.rating} size={12} />
                  <span className="subtle">({SHOP.reviewCount})</span>
                </span>
              </div>
            </div>
            <p className="inline t-body" style={{ color: status.open ? "var(--open)" : "var(--warning-ink)" }}>
              <Clock size={15} /> {status.label}
            </p>
            <div className="divider" style={{ margin: 0 }} />
            <p className="info-line">
              <MapPin size={16} />
              <span>{SHOP.area}</span>
            </p>
            <p className="info-line">
              <Truck size={16} />
              <span>Rider pickup and delivery around Weija, Kasoa and Accra</span>
            </p>
            <p className="info-line">
              <Shirt size={16} />
              <span>
                {SERVICES.length} services from {money(cheapest)}
              </span>
            </p>
            <Cta className="btn-block" onClick={() => navigate("/order/new")}>
              Book now
            </Cta>
            <a className="btn btn-outline btn-block" href={SHOP.whatsappBusiness} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Chat on WhatsApp
            </a>
          </div>
          <div className="card card-pad stack gap-8">
            <Photo tone="charcoal" src="/photos/suit-care.webp" alt="A suit pressed and hung at Aromatic Laundry" position="center 35%" sizes="320px" height={150} radius="var(--r-img)" />
            <p className="t-title">Suits, kente and special garments</p>
            <p className="muted">Cleaned and pressed one by one, returned on a hanger in a cover. Kente is hand-washed cold and pressed through a cloth so the colours keep their life.</p>
            <Link className="link t-body" to="/order/new?service=suit" style={{ alignSelf: "flex-start" }}>
              Book suit care
            </Link>
          </div>
        </aside>
      </div>

      <HowItWorks />

      <WhyBento />

      {/* Reviews */}
      <section id="reviews" className="section anchor">
        <SectionHead
          title="Reviews"
          action={
            <button className="link t-cap" onClick={() => setReviewsOpen(true)}>
              See all
            </button>
          }
        />
        <div className="card card-pad stack gap-8">
          <div className="inline" style={{ gap: 12 }}>
            <CountUp className="t-num" to={SHOP.rating} decimals={1} />
            <div className="stack">
              <Stars value={SHOP.rating} size={16} />
              <span className="subtle t-cap">
                <CountUp to={SHOP.reviewCount} /> reviews
              </span>
            </div>
          </div>
          <p className="muted">Clients mention the scent that stays for days, how quickly the call comes to collect, and stains they had given up on.</p>
          <p className="inline subtle t-cap">
            <Sparkles size={13} /> Summary of client reviews
          </p>
        </div>
        <div className="stack gap-12 review-list">
          {data.reviews
            .filter((r) => r.status === "published")
            .slice(0, 2)
            .map((r) => (
              <ReviewItem key={r.id} name={r.name} rating={r.rating} text={r.text} at={r.at} serviceId={r.serviceId} />
            ))}
        </div>
      </section>

      {/* Info */}
      <div className="desk-3col">
        <section id="info" className="section anchor">
          <SectionHead title="Opening times" />
          <div className="card card-pad stack gap-8">
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
              const span = HOURS[dow];
              const today = dow === now.getDay();
              const sample = new Date(2026, 0, 4 + dow);
              return (
                <div key={dow} className="between" style={{ fontWeight: today ? 500 : 400 }}>
                  <span className="inline" style={{ gap: 10 }}>
                    <span className="hours-dot" style={{ background: span ? "var(--open)" : "var(--ink-25)" }} />
                    {weekdayLong(sample)}
                  </span>
                  <span className="tabular" style={{ color: span ? undefined : "var(--ink-50)" }}>
                    {span ? `${span[0]} – ${span[1]}` : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <SectionHead title="Good to know" />
          <div className="card list-card">
            {SHOP_FEATURES.map((f) => {
              const Icon = FEATURE_ICONS[f.icon];
              return (
                <div key={f.label} className="row">
                  <span className="row-icon">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <span>{f.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <SectionHead title="Getting there" />
          <MapCard />
        </section>
      </div>

      <div className="desk-2col">
        <section className="section">
          <SectionHead title="Contact" />
          <div className="card list-card">
            <a className="row" href={SHOP.whatsappBusiness} target="_blank" rel="noreferrer">
              <span className="row-icon is-aqua">
                <MessageCircle size={18} strokeWidth={1.7} />
              </span>
              <span className="grow">Chat on WhatsApp</span>
            </a>
            <a className="row" href={telLink(SHOP.phone)}>
              <span className="row-icon">
                <Phone size={18} strokeWidth={1.7} />
              </span>
              <span className="grow">Call {SHOP.phone}</span>
            </a>
            <a className="row" href={SHOP.tiktok} target="_blank" rel="noreferrer">
              <span className="row-icon">
                <TikTokIcon size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>@aromatic.laundry1 on TikTok</span>
                <span className="subtle t-cap">Stain rescues, before and afters, and the counter</span>
              </span>
            </a>
          </div>
        </section>

        <section className="section">
          <SectionHead title="Loyalty" />
          <div className="card list-card">
            {account ? (
              <div className="row">
                <span className="row-icon is-aqua">
                  <Sparkles size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>{account.points} points</span>
                  <span className="subtle t-cap">Worth {money(account.points / 10)} off your next order</span>
                </span>
              </div>
            ) : (
              <Link className="row" to="/profile">
                <span className="row-icon is-aqua">
                  <Sparkles size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>Earn points on every wash</span>
                  <span className="subtle t-cap">Optional: save an account with your WhatsApp number to collect them</span>
                </span>
              </Link>
            )}
            <a className="row" href={whatsappLink("", `I get my laundry done at ${SHOP.name} in West Hills Mall. They pick up and deliver too: ${window.location.origin}`)} target="_blank" rel="noreferrer">
              <span className="row-icon">
                <Gift size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>Refer a friend</span>
                <span className="subtle t-cap">You both get 100 points on their first order</span>
              </span>
            </a>
          </div>
        </section>
      </div>

      <ClosingCta />

      <div className="floating-bar lt-desk">
        <div className="sticky-bar-meta">
          <strong>Wash, dry, fold & iron</strong>
          <span className="subtle t-cap">from {money(basketFrom)} a basket</span>
        </div>
        <Cta onClick={() => navigate("/order/new")}>Book now</Cta>
      </div>

      <Sheet open={reviewsOpen} onClose={() => setReviewsOpen(false)} title={`${SHOP.reviewCount} reviews`}>
        <div className="stack gap-12">
          {data.reviews
            .filter((r) => r.status === "published")
            .map((r) => (
              <ReviewItem key={r.id} name={r.name} rating={r.rating} text={r.text} at={r.at} serviceId={r.serviceId} flat />
            ))}
          <p className="t-cap subtle" style={{ textAlign: "center" }}>
            Sample reviews for this preview, in the words clients use on the shop's TikTok.
          </p>
        </div>
      </Sheet>
    </main>
  );
}

function ReviewItem({ name, rating, text, at, serviceId, flat }: { name: string; rating: number; text: string; at: string; serviceId: string; flat?: boolean }) {
  const service = SERVICES.find((s) => s.id === serviceId);
  const body = (
    <>
      <div className="inline" style={{ gap: 10 }}>
        <span className="avatar is-soft" style={{ width: 36, height: 36, fontSize: 13 }} aria-hidden="true">
          {name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
        <div className="stack">
          <span style={{ fontWeight: 500 }}>{name}</span>
          <Stars value={rating} size={12} />
        </div>
      </div>
      <p>{text}</p>
      <p className="subtle t-cap">
        {fmtDate(new Date(at))} · {service?.name}
      </p>
      {flat && <div className="divider" style={{ margin: 0 }} />}
    </>
  );
  return flat ? (
    <article className="stack gap-8">{body}</article>
  ) : (
    <Reveal as="article" className="card card-pad stack gap-8" y={16}>
      {body}
    </Reveal>
  );
}
