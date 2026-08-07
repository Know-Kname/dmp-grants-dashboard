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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LazyMotion,
  MotionConfig,
  domMax,
  m,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useScroll,
  useInView,
  animate,
} from 'framer-motion';

export {
  m,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useScroll,
  useInView,
};

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

/**
 * `domMax` rather than `domAnimation` (~10 kB more) because the shared layout
 * animations — the nav pill that travels between routes, the tab underline —
 * are `layout`/`layoutId` features, which `domAnimation` does not include.
 * Those transitions are the difference between chrome that moves and chrome
 * that cuts, so the weight is bought deliberately.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
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

/* ── Spring presets ──────────────────────────────────────────────── */

/**
 * Named springs, so "how bouncy is a button" is decided once.
 *
 * All are critically-ish damped. Overshoot is the single fastest way to make an
 * interface feel toylike, and this one sits in front of funeral directors.
 */
export const SPRING = {
  /** Pointer-tracked surfaces: tilt, magnetism. Follows without lag or wobble. */
  glide: { stiffness: 150, damping: 20, mass: 0.6 },
  /** Press/release. Fast enough to feel mechanical. */
  press: { stiffness: 420, damping: 32, mass: 0.7 },
  /** Layout travel — the nav pill moving between items. */
  travel: { stiffness: 380, damping: 38, mass: 0.9 },
} as const;

/* ── Pointer-driven 3D ───────────────────────────────────────────── */

export interface TiltOptions {
  /** Maximum rotation in degrees at the card's corners (default 7). */
  max?: number;
  /** Z-translation applied while hovered, in px (default 0). */
  lift?: number;
}

/**
 * Real 3D tilt from pointer position over an element.
 *
 * Returns motion values plus the handlers to spread onto the element. The
 * caller owns `perspective` — it belongs on the *parent* so sibling cards share
 * one vanishing point; setting it per-card makes each its own little world and
 * the grid stops reading as a plane.
 *
 * Collapses to no rotation under prefers-reduced-motion, and never engages for
 * coarse pointers, where there is no hover to track and the transform would
 * only fight the scroll.
 */
export function useTilt({ max = 7, lift = 0 }: TiltOptions = {}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rx = useSpring(useMotionValue(0), SPRING.glide);
  const ry = useSpring(useMotionValue(0), SPRING.glide);
  const tz = useSpring(useMotionValue(0), SPRING.glide);
  // Normalised pointer position, for glare/sheen overlays that follow the cursor.
  const px = useSpring(useMotionValue(50), SPRING.glide);
  const py = useSpring(useMotionValue(50), SPRING.glide);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType === 'touch') return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      // Y drives rotateX inverted: pointer high on the card tips its top away.
      rx.set((0.5 - ny) * max * 2);
      ry.set((nx - 0.5) * max * 2);
      px.set(nx * 100);
      py.set(ny * 100);
    },
    [reduced, max, rx, ry, px, py]
  );

  const onPointerEnter = useCallback(() => {
    if (!reduced) tz.set(lift);
  }, [reduced, lift, tz]);

  const onPointerLeave = useCallback(() => {
    rx.set(0);
    ry.set(0);
    tz.set(0);
    px.set(50);
    py.set(50);
  }, [rx, ry, tz, px, py]);

  return {
    ref,
    rotateX: rx,
    rotateY: ry,
    translateZ: tz,
    pointerX: px,
    pointerY: py,
    handlers: { onPointerMove, onPointerEnter, onPointerLeave },
  };
}

/**
 * Magnetic attraction toward the pointer.
 *
 * The element leans a few pixels toward the cursor as it approaches, which
 * makes a target feel like it wants to be clicked. Kept small on purpose —
 * past about 8px it stops reading as attraction and starts reading as drift,
 * and it becomes genuinely harder to hit the thing.
 */
export function useMagnetic(strength = 6) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(useMotionValue(0), SPRING.glide);
  const y = useSpring(useMotionValue(0), SPRING.glide);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (reduced || e.pointerType === 'touch') return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      x.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength);
      y.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength);
    },
    [reduced, strength, x, y]
  );

  const reset = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return { ref, x, y, handlers: { onPointerMove, onPointerLeave: reset, onBlur: reset } };
}
