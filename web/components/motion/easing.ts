// Shared easing curve for the motion system. Editorial cubic bezier — gentle
// acceleration and deceleration with no overshoot or springiness.
//
// TWO MOTION REGISTERS, ON PURPOSE:
//  - EASING is the editorial track. Use it for body copy, section reveals, and
//    anything that needs to read as credible/settled. Do NOT swap it globally.
//  - SPRING is the additive playful track. Use it ONLY on the surfaces meant to
//    feel alive: background, chart state transitions, list reorder, and the bet
//    interactions. It overshoots slightly by design. It never replaces EASING.
export const EASING = [0.25, 0.1, 0.25, 1] as const;

// Framer Motion spring transition for playful surfaces. Tuned to settle with a
// small, confident overshoot (not a bounce). Pass directly as a `transition`.
export const SPRING = {
  type: "spring",
  stiffness: 120,
  damping: 18,
  mass: 1.1,
} as const;

// Snappier sibling for small, frequent gestures (drag release, hover settle)
// where the heavier SPRING would feel sluggish. Same family, less mass.
export const SPRING_SNAPPY = {
  type: "spring",
  stiffness: 220,
  damping: 22,
  mass: 0.9,
} as const;
