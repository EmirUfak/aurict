"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import Corners from "./ui/Corners";

export default function Hero() {
  const { t } = useLanguage();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 100]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden z-10 pt-20 px-6">
      <motion.div style={{ y, opacity }} className="w-full max-w-4xl mx-auto text-center flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 0.8, 0.2, 1] as const }}>
          <div className="eyebrow mb-5">Aurict</div>
          <h1 className="font-serif text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight mb-6 leading-[1.03]" style={{ color: "var(--text)" }}>
            {t("hero.title") || "Aurict Mobile."}
          </h1>
          <div className="font-serif text-2xl md:text-4xl mb-10 tracking-tight" style={{ color: "var(--text-dim)" }}>
            {t("hero.subtitle") || "Designed for tomorrow."}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 0.8, 0.2, 1] as const }}
          className="max-w-xl font-serif text-lg md:text-xl leading-relaxed mb-12"
          style={{ color: "var(--text-dim)" }}
        >
          {t("hero.slogan") || "Experience the next generation of seamless technology integration."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 0.8, 0.2, 1] as const }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          <a href="#apps" className="aur-btn-primary">
            {t("hero.exploreApps") || "Explore Apps"}
          </a>
          <a href="#about" className="aur-btn-secondary group">
            {t("hero.learnMore") || "Learn more"}
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.7 }}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center"
      >
        <span className="eyebrow mb-2">{t("hero.scrollDown") || "Scroll"}</span>
        <div className="w-px h-12" style={{ background: "linear-gradient(to bottom, var(--border-bright), transparent)" }} />
      </motion.div>

      <div className="aur-card absolute top-24 left-6 hidden lg:block px-3 py-2">
        <Corners />
        <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>mobile.aurict.com</span>
      </div>
    </section>
  );
}
