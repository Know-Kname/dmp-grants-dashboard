/**
 * Unified motion system for the DMP CMS.
 *
 * This is the ONLY file that may import from 'framer-motion'. Everything else
 * imports `m`, `AnimatePresence`, tokens, and variants from here. `LazyMotion`
 * runs in strict mode, so a stray `motion.div` elsewhere throws at runtime —
 * by design, to keep the animation feature bundle loaded exactly once.
 *
 * The house style is "dignified fluidity": the EASE_LUX curve from the Login /
 * Memorial editorial pages, short durations, and motion that always collapses
 * to nothing under prefers-reduced-motion (via MotionConfig reducedMotion="user"
 * for declarative animation, and useReducedMotion for imperative cases).
 */
import { useEffect, useRef, useState } from 'react';
import {
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
  animate,
} from 'framer-motion';

export { m, AnimatePresence, useReducedMotion };

/** Same curve as --ease-lux in index.css. */
export const EASE_LUX: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Durations in seconds (Framer convention). Mirrors --transition-* in index.css. */
export const DUR = { fast: 0.15, base: 0.25, slow: 0.4, reveal: 1 } as const;

/* ── Shared variants ─────────────────────────────────────────────── */

/** Editorial entrance used by Login/Memorial: long, luxurious rise. */
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: EASE_LUX } },
};

/** Editorial stagger container (pairs with fadeUp). */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

/** In-app entrance: quicker rise for CMS content blocks. */
export const fadeInUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_LUX } },
};

/** In-app stagger container (pairs with fadeInUp / listItem). */
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

/** List/table row entrance — subtle enough to run over many rows. */
export const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_LUX } },
};

/** Modal / popover entrance-exit. */
export const scalePop = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: DUR.base, ease: EASE_LUX } },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: DUR.fast, ease: 'easeIn' as const } },
};

/** Route-level page transition. */
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_LUX } },
  exit: { opacity: 0, y: -4, transition: { duration: DUR.fast, ease: 'easeIn' as const } },
};

/* ── Provider ────────────────────────────────────────────────────── */

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/* ── Hooks ───────────────────────────────────────────────────────── */

/**
 * Animated count-up toward `value`. Re-animates from the previous value on
 * change; jumps instantly under prefers-reduced-motion. Returns the raw
 * in-flight number — callers format (round, currency) as needed.
 */
export function useCountUp(value: number, duration = 0.9): number {
  const reduced = useReducedMotion();
  const previous = useRef(0);
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (reduced || from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: EASE_LUX,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return display;
}
