import { useId } from "react";

/**
 * The Aromatic Laundry mark: the front-loading washer from the shop's own logo, drawn as one filled
 * shape. The body is solid; the round door and the two dials are cut out of it, and a wave of water
 * sits inside the door, so the mark reads at favicon size and on any background. The same geometry
 * lives in public/favicon.svg and scripts/make_icons.py.
 */
export const MARK = {
  viewBox: "0 0 100 100",
  /** The body: a rounded square. */
  body: { x: 17, y: 10, width: 66, height: 80, rx: 13 },
  /** The two dials on the control strip, cut out as circles. */
  dials: [
    [30, 23, 3.6],
    [41, 23, 3.6],
  ] as const,
  /** The status light on the right of the strip, cut out as a capsule. */
  light: { x1: 60, x2: 71, y: 23, width: 5.5 },
  /** The door, cut out as a circle. */
  door: { cx: 50, cy: 58, r: 22 },
  /** The water in the door: a wave across the lower half, inset from the rim. */
  wave: "M33.3 60.5 C39 54.5 44.5 66 50 60 C55.5 54 61 65.5 66.7 60.5 A17 17 0 0 1 33.3 60.5 Z",
};

export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  const mask = `al-${useId().replace(/:/g, "")}`;
  const { body, door, light } = MARK;
  return (
    <svg
      viewBox={MARK.viewBox}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="currentColor"
    >
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <circle cx={door.cx} cy={door.cy} r={door.r} fill="#000" />
          {MARK.dials.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#000" />
          ))}
          <line x1={light.x1} y1={light.y} x2={light.x2} y2={light.y} stroke="#000" strokeWidth={light.width} strokeLinecap="round" />
        </mask>
      </defs>
      <rect x={body.x} y={body.y} width={body.width} height={body.height} rx={body.rx} mask={`url(#${mask})`} />
      <path d={MARK.wave} />
    </svg>
  );
}

export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.26 }}>
      <LogoMark size={size * 0.64} />
    </span>
  );
}
