import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { blurIn, motionMode } from "../motion";

const SPLASH_KEY = "al-splash-seen";
/** Long enough for the logo to assemble itself and hold on screen for about a second. */
const SPLASH_MS = 3200;
/** Without the build-up there is nothing to wait for, but the brand still gets a beat. */
const SPLASH_CALM_MS = 1200;
const SPLASH_EXIT_MS = 450;

/**
 * Launch screen. Its markup, styles and entrance live in index.html, so the logo is up from the
 * first paint while the app's script is still loading. This takes it down once the app has
 * mounted and the logo has had its moment, and marks it seen for the rest of the session.
 */
export function Splash() {
  useEffect(() => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    if (document.documentElement.dataset.splash === "off") {
      splash.remove();
      return;
    }
    const mode = motionMode();
    const hold = mode === "full" ? SPLASH_MS : SPLASH_CALM_MS;
    let holdTimer = 0;
    let exitTimer = 0;
    const leave = () => {
      splash.classList.add("is-leaving");
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* private mode: the splash simply shows again next time */
      }
      exitTimer = window.setTimeout(() => splash.remove(), mode === "off" ? 0 : SPLASH_EXIT_MS);
    };
    // The clock starts when the logo's images are in and its entrance begins (see index.html).
    const start = () => {
      const elapsed = performance.now() - Number(splash.dataset.readyAt ?? performance.now());
      holdTimer = window.setTimeout(leave, Math.max(0, hold - elapsed));
    };
    if (splash.dataset.readyAt) start();
    else splash.addEventListener("splashready", start, { once: true });
    return () => {
      splash.removeEventListener("splashready", start);
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);
  return null;
}

interface SuccessProps {
  open: boolean;
  title: string;
  tone?: "success" | "cancel";
  onDone: () => void;
}

/** Full-screen confirmation with a moving gradient, as in the reference flow. */
export function SuccessScreen({ open, title, tone = "success", onDone }: SuccessProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDone, 1900);
    return () => window.clearTimeout(timer);
  }, [open, onDone]);

  const blobs =
    tone === "success"
      ? [
          { c: "#7ad7f0", x: "-20%", y: "-10%", s: "70vmax" },
          { c: "#c0adff", x: "35%", y: "30%", s: "65vmax" },
          { c: "#b8deff", x: "-10%", y: "55%", s: "55vmax" },
        ]
      : [
          { c: "#e0c5b6", x: "-20%", y: "-10%", s: "70vmax" },
          { c: "#c0adff", x: "35%", y: "35%", s: "60vmax" },
          { c: "#a5b2cf", x: "-15%", y: "55%", s: "55vmax" },
        ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay success" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {blobs.map((b, i) => (
            <motion.span
              key={b.c}
              className="success-blob"
              // Softness is baked into the gradient: a live blur filter re-renders on every frame while the blob scales.
              style={{ background: `radial-gradient(closest-side, ${b.c} 0%, ${b.c} 35%, transparent 100%)`, width: b.s, height: b.s, left: b.x, top: b.y }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.85, 1.12, 0.95], opacity: 0.95, x: [0, i % 2 ? -40 : 40, 0], y: [0, i % 2 ? 30 : -30, 0] }}
              transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
            />
          ))}
          <div className="success-content">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <motion.path
                d="M14 33 L27 46 L51 19"
                stroke="#fff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, delay: 0.15, ease: [0.44, 0, 0.56, 1] }}
              />
            </svg>
            <motion.h1 {...blurIn(0.25)}>{title}</motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
