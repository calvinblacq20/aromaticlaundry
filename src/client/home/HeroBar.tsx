import { Link } from "react-router-dom";
import { AppIcon } from "../../components/Brand";
import { SHOP } from "../../data/business";

/** Sections of the home page the bar jumps to; "Services" opens the full price list instead. */
const SECTION_LINKS = [
  { label: "Prices", section: "prices" },
  { label: "Plans", section: "plans" },
  { label: "Reviews", section: "reviews" },
  { label: "Find us", section: "info" },
] as const;

/**
 * The bar across the top of the home hero, in the style of a store header: the shop's name on the
 * left and page links in the middle (wider screens). The WhatsApp, call, share and save buttons
 * float at the bottom right instead (ContactDock). On tablet and desktop this bar is the page's
 * header until the hero scrolls away and the floating nav takes over.
 */
export function HeroBar({ onSection }: { onSection: (id: string) => void }) {
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
    </header>
  );
}
