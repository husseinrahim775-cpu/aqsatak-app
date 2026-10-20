"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
}

export default function AnimatedNumber({ value, suffix = "" }: AnimatedNumberProps) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString("en-US")
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <motion.span>{display}</motion.span>
      {suffix && <span className="text-xs font-sans font-bold text-muted-foreground">{suffix}</span>}
    </span>
  );
}