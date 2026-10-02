import { Baby, BadgeCheck, BedDouble, Briefcase, CalendarSync, Check, CloudRain, Droplet, Gem, GraduationCap, Heart, Layers, ShieldCheck, Shirt, Smartphone, Sparkles, TrendingUp } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Photo } from "../../components/Bits";
import { useMediaQuery } from "../../components/Chrome";
import { Reveal } from "../../components/Reveal";
import { SHOP } from "../../data/business";
import { motionMode, spring } from "../../motion";

const CHIPS = [
  { label: "Work shirts", icon: <Shirt size={13} />, x: "4%", y: 6, r: 22, fr: -3 },
  { label: "Suits", icon: <Briefcase size={13} />, x: "44%", y: 0, r: -18, fr: 2 },
  { label: "School uniforms", icon: <GraduationCap size={13} />, x: "0%", y: 44, r: 30, fr: 4 },
  { label: "Kente", icon: <Gem size={13} />, x: "52%", y: 46, r: -26, fr: -2 },
  { label: "Duvets", icon: <BedDouble size={13} />, x: "2%", y: 86, r: 16, fr: -4 },
  { label: "Baby things", icon: <Baby size={13} />, x: "40%", y: 90, r: -12, fr: 3 },
  { label: "Rainy weeks", icon: <CloudRain size={13} />, x: "18%", y: 128, r: 24, fr: 0 },
];

const INSIGHTS = [
  { value: `${SHOP.reviewCount}+`, label: "Happy clients" },
  { value: `${SHOP.rating}`, label: "Average rating" },
  { value: "24 hours", label: "Standard turnaround" },
  { value: "3 hours", label: "With express" },
];

/** Dark bento section with parallax columns, tumbling chips and a cycling stat (Makro "Tidy Build"). */
export function WhyBento() {
  const ref = useRef<HTMLElement>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const sideY = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const midY = useTransform(scrollYProgress, [0, 1], [150, -150]);
  const parallax = desktop && motionMode() === "full";

  return (
    <section ref={ref} className="bento" data-nav-theme="dark" aria-labelledby="bento-title">
      <div className="bento-head">
        <Reveal as="span" look="focus" className="chip-dark">
          <Sparkles size={13} /> Why clients choose us
        </Reveal>
        <Reveal as="h2" look="focus" delay={0.05} id="bento-title" className="bento-title">
          Laundry, off your list
        </Reveal>
        <Reveal as="p" look="focus" delay={0.1} className="bento-sub">
          Work shirts, school uniforms, suits and kente, from one counter inside West Hills Mall, with every basket counted, tracked and back when we said it would be.
        </Reveal>
      </div>

      <div className="bento-grid">
        <motion.div className="bento-col" style={parallax ? { y: sideY } : undefined}>
          <WashCard />
          <PlanCard />
        </motion.div>
        <motion.div className="bento-col" style={parallax ? { y: midY } : undefined}>
          <PaymentsCard />
          <TrackingCard />
        </motion.div>
        <motion.div className="bento-col" style={parallax ? { y: sideY } : undefined}>
          <InsightsCard />
          <CareCard />
        </motion.div>
      </div>
    </section>
  );
}

function CardHead({ tag, icon, title, body, light }: { tag: string; icon: ReactNode; title: string; body: string; light?: boolean }) {
  return (
    <div className={`bento-card-head ${light ? "is-light" : ""}`}>
      <span className="bento-tag">
        {icon}
        {tag}
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function WashCard() {
  const ref = useRef<HTMLDivElement>(null);
  // Chips tumble in and settle into a pile as the card scrolls up the screen (full mode only).
  const still = motionMode() !== "full";
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center 0.55"] });
  return (
    <div ref={ref} className="bento-card is-steel is-tall">
      <CardHead tag="What we wash" icon={<Layers size={13} />} title="Everything in the basket" body="Work shirts, school uniforms, suits, kente, duvets and the baby's things, each the way it needs." light />
      <div className="chip-pile" aria-hidden="true">
        {CHIPS.map((chip) => (
          <TumbleChip key={chip.label} chip={chip} progress={scrollYProgress} still={still} />
        ))}
      </div>
    </div>
  );
}

function TumbleChip({ chip, progress, still }: { chip: (typeof CHIPS)[number]; progress: MotionValue<number>; still: boolean }) {
  const rotate = useTransform(progress, [0, 1], [chip.r, chip.fr]);
  const y = useTransform(progress, [0, 1], [chip.y - 90, chip.y]);
  const opacity = useTransform(progress, [0, 0.35], [0, 1]);
  return (
    <motion.span className="tumble-chip" style={still ? { left: chip.x, top: chip.y, rotate: chip.fr } : { left: chip.x, top: 0, y, rotate, opacity }}>
      {chip.icon}
      {chip.label}
    </motion.span>
  );
}

function PlanCard() {
  return (
    <div className="bento-card is-steel">
      <CardHead tag="Plans" icon={<CalendarSync size={13} />} title="The month, sorted" body="A basket a week collected and brought back, paid once a month. Pickup and delivery on us." light />
      <div className="group-strip">
        <span className="group-ghost" />
        <div className="group-tile">
          <Photo tone="mist" src="/photos/folded-stack.webp" alt="" position="center 45%" sizes="120px" height={70} radius={10} />
          <strong>Solo plan</strong>
          <span className="t-cap subtle">2 of 4 baskets used</span>
        </div>
        <span className="group-ghost" />
      </div>
    </div>
  );
}

function PaymentsCard() {
  return (
    <div className="bento-card is-white is-tall">
      <CardHead tag="Pay" icon={<Smartphone size={13} />} title="MoMo payments" body="Pay by mobile money or card when you book, at the counter, or to the rider. Every payment is matched to your order." />
      <div className="momo-card">
        <div className="between">
          <span className="inline t-cap" style={{ gap: 6 }}>
            <span className="live-dot" /> MoMo received
          </span>
          <span className="t-cap subtle">1 min ago</span>
        </div>
        <div className="momo-amount">
          <span className="subtle">+</span>GH₵ 120<span className="subtle">.00</span>
        </div>
      </div>
      <div className="receipt-mini">
        <span className="t-mono t-cap">ALR-2026-0412</span>
        <span className="pill-aqua">
          <Check size={12} /> Official receipt
        </span>
      </div>
    </div>
  );
}

function TrackingCard() {
  const rows = [
    { name: "Big basket", ref: "AL-1218", status: "Washing", tone: "sky" },
    { name: "Suit, two-piece", ref: "AL-1215", status: "Ironing", tone: "lilac" },
    { name: "Medium basket", ref: "AL-1209", status: "Ready", tone: "aqua" },
  ];
  return (
    <div className="bento-card is-white">
      <CardHead tag="Track" icon={<TrendingUp size={13} />} title="Order tracking" body="See every stage, from the rider's pickup to your door." />
      <div className="track-list">
        {rows.map((r) => (
          <div key={r.ref} className="track-row">
            <div className="stack">
              <span className="t-cap subtle t-mono">{r.ref}</span>
              <span>{r.name}</span>
            </div>
            <span className={`badge is-${r.tone}`} style={{ paddingRight: 10 }}>
              <span className="badge-well" />
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsCard() {
  const [i, setI] = useState(0);
  // An ambient loop inside its own card, so it keeps cycling in calm mode (as a fade).
  const cycles = motionMode() !== "off";
  useEffect(() => {
    if (!cycles) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % INSIGHTS.length), 2600);
    return () => window.clearInterval(t);
  }, [cycles]);
  const current = INSIGHTS[i] ?? INSIGHTS[0];
  return (
    <div className="bento-card is-steel-rev is-tall">
      <CardHead tag="Trusted" icon={<BadgeCheck size={13} />} title="Clients come back" body="Laundry comes round every week, and so do our clients." />
      <div className="orbit" aria-hidden="true">
        <span className="orbit-dot" style={{ left: "12%", top: "30%" }}>
          <Heart size={14} />
        </span>
        <span className="orbit-dot" style={{ left: "44%", top: "8%" }}>
          <Shirt size={14} />
        </span>
        <span className="orbit-dot" style={{ left: "76%", top: "22%" }}>
          <Sparkles size={14} />
        </span>
      </div>
      <div className="insight" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current?.label} initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -18, filter: "blur(8px)" }} transition={spring.small}>
            <strong>{current?.value}</strong>
            <span>{current?.label}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function CareCard() {
  return (
    <div className="bento-card is-blush">
      <CardHead tag="Care" icon={<ShieldCheck size={13} />} title="Your care, remembered" body="Tell us once: folded or on hangers, how much starch, which scent, what goes separately. It prints on every ticket." />
      <div className="alert-card">
        <div className="inline" style={{ gap: 10 }}>
          <span className="alert-icon">
            <Droplet size={15} />
          </span>
          <div className="stack">
            <strong className="t-body">Unscented for the twins</strong>
            <span className="t-cap subtle">Big basket · AL-1218</span>
          </div>
        </div>
        <div className="alert-foot">
          <span>Checked before it goes in the wash</span>
          <span className="alert-check">
            <Check size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}
