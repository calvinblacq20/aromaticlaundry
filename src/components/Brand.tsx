/**
 * The Aromatic Laundry emblem: the shirt on its hanger, the folded stack and the scent rising, cut
 * from the shop's logo (brand/logo/aromatic-laundry-logo.png) by scripts/make_icons.py. The same
 * script writes the favicon, the home-screen icons and the launch screen's layers in index.html.
 */
export const EMBLEM_SRC = "/brand/al-emblem.webp";

/** The emblem in full colour. Inside a `.photo` placeholder, CSS turns it into a faint silhouette. */
export function LogoMark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return <img src={EMBLEM_SRC} width={size} height={size} className={`logo-mark ${className}`} alt={title ?? ""} decoding="async" draggable={false} />;
}

/** The emblem on a white tile with a hairline edge, so it reads on the light page, dark bands and photos. */
export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.26 }}>
      <LogoMark size={Math.round(size * 0.82)} />
    </span>
  );
}
