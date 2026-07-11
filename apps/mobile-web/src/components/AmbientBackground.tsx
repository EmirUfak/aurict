"use client";

import { motion } from "framer-motion";

// Low-motion ambient glow behind every page — the understated wine-toned
// radial wash used across Aurict, in place of the old particle-field background.
export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% -10%, oklch(0.25 0.04 25 / 0.28), transparent 42%), linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%)",
        }}
      />
      <motion.div
        animate={{ opacity: [0.18, 0.28, 0.18] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]"
        style={{ background: "var(--accent)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
