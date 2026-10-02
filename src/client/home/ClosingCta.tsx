import { Check, Clock } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogoMark } from "../../components/Brand";
import { Photo } from "../../components/Bits";
import { Cta } from "../../components/Button";
import { Reveal } from "../../components/Reveal";
import { isCalm } from "../../motion";

/** Dark closing section; the preview card rises and un-tilts into place as you scroll (Makro CTA). */
export function ClosingCta() {
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);
  // The preview's rise, zoom and tilt are scroll-coupled motion: left out in calm mode.
  const calm = isCalm();
  const { scrollYProgress } = useScroll({ target: previewRef, offset: ["start end", "start 0.35"] });
  const y = useTransform(scrollYProgress, [0, 1], [120, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);

  return (
    <section className="closing" data-nav-theme="dark" aria-labelledby="closing-title">
      <Reveal as="span" look="focus" className="closing-mark">
        <LogoMark size={44} />
      </Reveal>
      <Reveal as="h2" look="focus" delay={0.05} id="closing-title" className="closing-title">
        Ready to hand over the laundry?
      </Reveal>
      <Reveal as="p" look="focus" delay={0.1} className="closing-sub">
        Book a pickup or drop it at the counter while you shop. We'll handle the washing, the drying, the ironing and the folding.
      </Reveal>
      <Reveal look="focus" delay={0.15}>
        <Cta tone="aqua" onClick={() => navigate("/order/new")}>
          Book now
        </Cta>
      </Reveal>

      <div className="closing-stage">
        <motion.div ref={previewRef} className="closing-preview" style={calm ? undefined : { y, scale, rotateX, transformPerspective: 1400 }}>
          <Photo tone="mist" src="/photos/folded-stack.webp" alt="Freshly washed and folded laundry ready to go home from Aromatic Laundry" position="center 45%" sizes="(min-width: 1024px) 960px, 100vw" height="100%" radius={0} />
          <div className="closing-overlay">
            <div className="closing-chip">
              <span className="badge is-aqua" style={{ paddingRight: 12 }}>
                <span className="badge-well">
                  <Check size={13} />
                </span>
                Ready to collect
              </span>
              <span className="t-cap">Medium basket · AL-1209</span>
            </div>
            <div className="closing-chip is-right">
              <span className="inline t-cap" style={{ gap: 6 }}>
                <Clock size={13} /> Delivery today, 17:00 – 19:00
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
