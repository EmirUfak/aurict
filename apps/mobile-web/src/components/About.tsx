"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import Corners from "./ui/Corners";

export default function About() {
  const { t } = useLanguage();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 0.8, 0.2, 1] as const } },
  };

  const features = [
    { tag: "01", title: t("about.features.innovation.title") || "Innovation", description: t("about.features.innovation.description") || "We push the boundaries of what is possible, creating tools that define the future." },
    { tag: "02", title: t("about.features.fun.title") || "Precision", description: t("about.features.fun.description") || "Every detail matters. We craft experiences with meticulous attention to design." },
    { tag: "03", title: t("about.features.growth.title") || "Performance", description: t("about.features.growth.description") || "Lightning fast and incredibly responsive. Engineered for maximum efficiency." },
  ];

  const stats = [
    { number: "3+", label: t("about.stats.apps") || "Apps" },
    { number: "1M+", label: t("about.stats.downloads") || "Downloads" },
    { number: "50+", label: t("about.stats.countries") || "Countries" },
    { number: "24/7", label: t("about.stats.innovation") || "Innovation" },
  ];

  return (
    <section id="about" className="relative py-28 px-6 overflow-hidden z-10">
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="text-center mb-20">
          <motion.div variants={itemVariants} className="eyebrow mb-4">{t("about.title") || "About Aurict Mobile"}</motion.div>
          <motion.p variants={itemVariants} className="font-serif text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {t("about.mission") || "We are a team of dedicated creators, striving to build the most elegant and powerful applications in the world."}
          </motion.p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="aur-grid grid-cols-1 md:grid-cols-3 mb-8">
          {features.map((feature) => (
            <motion.div key={feature.tag} variants={itemVariants} className="aur-card p-8 flex flex-col">
              <Corners />
              <span className="font-mono text-xs mb-4" style={{ color: "var(--text-muted)" }}>{feature.tag}</span>
              <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: "var(--text)" }}>{feature.title}</h3>
              <p className="leading-relaxed text-sm" style={{ color: "var(--text-dim)" }}>{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="aur-grid grid-cols-2 md:grid-cols-4">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="aur-card text-center p-8">
              <div className="font-serif text-3xl md:text-4xl font-semibold mb-2" style={{ color: "var(--text)" }}>{stat.number}</div>
              <div className="eyebrow">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
