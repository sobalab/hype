"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";

import { SPRING } from "./easing";

type Props = Omit<ComponentProps<typeof motion.div>, "children"> & {
  children: ReactNode;
  /** When true, applies a subtle hover lift (y: -1). Default true. */
  hoverLift?: boolean;
};

// A list-row wrapper that participates in layout animations (reorder when
// sort changes, slide when filtered out) and lifts ever so slightly on hover.
// Pair with AnimatedListReorder on the parent to coordinate FLIP transitions.
export function AnimatedRow({
  children,
  hoverLift = true,
  className,
  ...rest
}: Props) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={className} {...(rest as ComponentProps<"div">)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      layout="position"
      className={className}
      transition={SPRING}
      whileHover={hoverLift ? { y: -1 } : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
