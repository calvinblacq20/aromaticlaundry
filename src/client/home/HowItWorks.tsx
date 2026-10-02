import { CalendarCheck, Check, ClipboardCheck, Truck, WashingMachine } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Photo } from "../../components/Bits";
import { Reveal } from "../../components/Reveal";
import { motionMode } from "../../motion";

interface Step {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  body: string;
  check: string;
  photo: string;
  alt: string;
  position: string;
  float: { label: string; value: string; note: string };
}

const STEPS: Step[] = [
  {
    eyebrow: "Step 1 · Book",
    icon: <CalendarCheck size={14} />,
    title: "Pick your baskets and how it gets to us.",
    body: "Choose from the price list: a small, medium or big basket, shirts to press, a suit or your kente. Then drop it at the counter inside West Hills Mall, or book our rider to collect from your door.",
    check: "Prices shown before you book",
    photo: "/photos/shop-counter.webp",
    alt: "The Aromatic Laundry counter inside West Hills Mall",
    position: "center 40%",
    float: { label: "Pickup", value: "Tomorrow", note: "Gbawe · 09:00 – 11:00" },
  },
  {
    eyebrow: "Step 2 · Count",
    icon: <ClipboardCheck size={14} />,
    title: "Counted and tagged at the counter.",
    body: "We open the bag with you, or as soon as the rider is back: every garment counted, stains and loose buttons noted, your care choices on the ticket. You get the tally on WhatsApp.",
    check: "Garment count on your ticket",
    photo: "/photos/stain-treatment.webp",
    alt: "A stain being pre-treated by hand before the wash",
    position: "center 50%",
    float: { label: "Checked in", value: "26 pieces", note: "Collar ring pre-treated" },
  },
  {
    eyebrow: "Step 3 · Wash",
    icon: <WashingMachine size={14} />,
    title: "Washed, dried, ironed and folded.",
    body: "Your scent in the final rinse, the dryers so the rain never holds us up, then pressed and folded or hung the way you asked. Ready in 24 hours, or 3 hours with express. You follow every stage in the app.",
    check: "Updates on WhatsApp at each stage",
    photo: "/photos/machines.webp",
    alt: "Washers and dryers running at the shop",
    position: "center 45%",
    float: { label: "Progress", value: "Ironing", note: "Ready today at 17:00" },
  },
  {
    eyebrow: "Step 4 · Home",
    icon: <Truck size={14} />,
    title: "Collect it, or we bring it back.",
    body: "Pick it up at the counter any day until 9pm, or choose a delivery window and the rider calls when he's near. Pay online, at the counter or to the rider, with an official receipt every time.",
    check: "Official receipt for every payment",
    photo: "/photos/folded-stack.webp",
    alt: "Freshly folded laundry stacked and ready to go home",
    position: "center 45%",
    float: { label: "Receipt", value: "GH₵ 120", note: "Paid · MoMo" },
  },
];

/** Pinned feature cards that stack as you scroll, each sliding up over the last. */
export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-head">
        <Reveal as="h2" look="focus" id="how-title" className="t-h2">
          How it works
        </Reveal>
        <Reveal as="p" look="focus" delay={0.08} className="muted">
          From the bag by your door to clothes back in your wardrobe, smelling like they should.
        </Reveal>
      </div>
      <div className="stack-list">
        {STEPS.map((step, i) => (
          <StackCard key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}

function StackCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLElement>(null);
  // Calm keeps the text brightening (opacity) and drops the photo zoom and the floating card's drift.
  const mode = motionMode();
  // Progress as this card rises from the bottom of the screen to its pinned position.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.2"] });
  const textOpacity = useTransform(scrollYProgress, [0.35, 1], [0.32, 1]);
  const floatY = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const floatRotate = useTransform(scrollYProgress, [0, 1], [index % 2 ? -6 : 6, 0]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.12, 1]);

  // The CSS pins tall cards lower (see .stack-card), which needs the card's rendered height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => el.style.setProperty("--card-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={ref} className={`stack-card ${index % 2 ? "is-flipped" : ""}`} style={{ zIndex: index + 1 }}>
      <motion.div className="stack-text" style={mode === "off" ? undefined : { opacity: textOpacity }}>
        <span className="chip-soft">
          {step.icon}
          {step.eyebrow}
        </span>
        <h3 className="stack-title">{step.title}</h3>
        <p className="muted">{step.body}</p>
        <p className="stack-check">
          <Check size={15} /> {step.check}
        </p>
      </motion.div>
      <div className="stack-media">
        <motion.div className="stack-photo" style={mode === "full" ? { scale: photoScale } : undefined}>
          <Photo tone="mist" src={step.photo} alt={step.alt} position={step.position} sizes="(min-width: 1024px) 600px, 100vw" height="100%" radius={0} />
        </motion.div>
        <motion.div className="float-card" style={mode === "full" ? { y: floatY, rotate: floatRotate } : undefined}>
          <span className="subtle t-cap">{step.float.label}</span>
          <strong>{step.float.value}</strong>
          <span className="t-cap muted">{step.float.note}</span>
        </motion.div>
      </div>
    </article>
  );
}
