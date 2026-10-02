import { Heart, Phone, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/Brand";
import { WhatsAppIcon } from "../../components/SocialIcons";
import { SHOP } from "../../data/business";
import { telLink } from "../../lib/contact";
import { spring } from "../../motion";

/** Sections of the home page the bar jumps to; "Services" opens the full price list instead. */
const SECTION_LINKS = [
  { label: "Prices", section: "prices" },
  { label: "Plans", section: "plans" },
  { label: "Reviews", section: "reviews" },
  { label: "Find us", section: "info" },
] as const;

/**
 * The bar across the top of the home hero, in the style of a store header: the shop's name on the
 * left, page links in the middle (wider screens), and small round buttons on the right to chat on
 * WhatsApp, call, share and save. On tablet and desktop it is the page's header until the hero
 * scrolls away and the floating nav takes over.
 */
export function HeroBar({ saved, onSave, onShare, onSection }: { saved: boolean; onSave: () => void; onShare: () => void; onSection: (id: string) => void }) {
  return (
    <header className="hero-bar">
      <Link to="/" className="hero-bar__brand" aria-label={`${SHOP.name} home`}>
        <AppIcon size={30} />
        <span className="hero-bar__name">{SHOP.name}</span>
      </Link>

      <nav className="hero-bar__links" aria-label="On this page">
        <Link to="/explore">Services</Link>
        {SECTION_LINKS.map((link) => (
          <button key={link.section} type="button" onClick={() => onSection(link.section)}>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="hero-bar__actions">
        <a className="hero-bar__icon" href={SHOP.whatsappBusiness} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" title="WhatsApp">
          <WhatsAppIcon size={15} />
        </a>
        <a className="hero-bar__icon" href={telLink(SHOP.phone)} aria-label={`Call ${SHOP.phone}`} title={`Call ${SHOP.phone}`}>
          <Phone size={15} strokeWidth={1.8} />
        </a>
        <button className="hero-bar__icon" type="button" onClick={onShare} aria-label="Share the shop" title="Share">
          <Share2 size={15} strokeWidth={1.8} />
        </button>
        <motion.button
          className={`hero-bar__icon ${saved ? "is-on" : ""}`}
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label="Save the shop"
          title={saved ? "Saved" : "Save"}
          whileTap={{ scale: 0.85 }}
          transition={spring.press}
        >
          <Heart size={15} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
        </motion.button>
      </div>
    </header>
  );
}
