"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface PageHeaderProps {
  backLabel?: string;
  brand?: string;
}

// Shared top bar for every non-landing page: brand mark + a back control.
export default function PageHeader({ backLabel = "Back", brand = "Aurict Mobile" }: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative z-10 py-8 px-6"
    >
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <Link href="/" className="eyebrow" style={{ color: "var(--text)" }}>
          {brand}
        </Link>
        <button onClick={() => window.history.back()} className="aur-btn-secondary text-xs py-2 px-4">
          {backLabel}
        </button>
      </div>
    </motion.header>
  );
}
