"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import Corners from "./ui/Corners";

const mindGridLogo = "/mindgrid-logo.png";
const aurictLogo = "/aurict-logo.svg";

export default function Apps() {
  const { t } = useLanguage();

  const apps = [
    {
      id: 1,
      name: "Mind Grid: Brain Memory Game",
      category: t("apps.mindgrid.category"),
      description: t("apps.mindgrid.description"),
      logo: mindGridLogo,
      developedWithAurict: true,
      comingSoon: false,
      playStoreLink: "https://play.google.com/store/apps/details?id=com.mindgrid.mind_grid",
    },
    {
      id: 2,
      name: "Aurict Mobile",
      category: t("apps.aurictmobile.category"),
      description: t("apps.aurictmobile.description"),
      logo: aurictLogo,
      developedWithAurict: false,
      comingSoon: true,
      playStoreLink: "",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 0.8, 0.2, 1] as const } },
  };

  return (
    <section id="apps" className="relative py-28 px-6 overflow-hidden z-10">
      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 0.8, 0.2, 1] as const }}
          className="text-center mb-20"
        >
          <div className="eyebrow mb-4">{t("apps.title")}</div>
          <p className="font-serif text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {t("apps.subtitle")}
          </p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="aur-grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto">
          {apps.map((app) => (
            <motion.div key={app.id} variants={itemVariants} className="aur-card aur-card-lift p-8 flex flex-col transition-transform duration-300">
              <Corners />

              {app.developedWithAurict && (
                <div className="flex items-center gap-2 mb-6 self-center">
                  <span className="aur-status-dot" style={{ background: "var(--accent)" }} />
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                    {t("apps.developedWithAurict") || "Developed with Aurict"}
                  </span>
                </div>
              )}
              {app.comingSoon && (
                <div className="flex items-center gap-2 mb-6 self-center">
                  <span className="aur-status-dot aur-pulse" style={{ background: "var(--warning)" }} />
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--warning)" }}>
                    {t("apps.comingSoon.title") || "Coming Soon"}
                  </span>
                </div>
              )}

              <div className="mb-8 flex items-center justify-center h-28">
                {/* eslint-disable-next-line @next/next/no-img-element -- external app icon, no next/image optimization needed for a static asset in public/ */}
                <img src={app.logo} alt={app.name} className="max-h-full object-contain" />
              </div>

              <div className="text-center mt-auto">
                <h3 className="font-serif text-2xl font-semibold mb-2" style={{ color: "var(--text)" }}>{app.name}</h3>
                <div className="eyebrow mb-4">{app.category}</div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-dim)" }}>{app.description}</p>

                {app.comingSoon ? (
                  <span className="aur-btn-secondary inline-flex opacity-60 cursor-not-allowed">
                    {t("apps.comingSoon.button") || "Get Notified"}
                  </span>
                ) : (
                  <a href={app.playStoreLink} target="_blank" rel="noopener noreferrer" className="aur-btn-secondary inline-flex">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.18 23.76c.37.21.8.22 1.18.04l13.62-7.68-3.24-3.24-11.56 10.88zM.5 1.26C.19 1.64 0 2.17 0 2.86v18.28c0 .69.19 1.22.5 1.6l.09.08 10.24-10.24v-.24L.59 1.18.5 1.26zM20.65 10.4l-2.99-1.69-3.45 3.45 3.45 3.45 3-1.7c.86-.48.86-1.27 0-1.51zM4.36.2L17.98 7.88l-3.24 3.24L3.18.24C3.55.06 4 .07 4.36.2z" />
                    </svg>
                    {t("apps.googlePlay") || "Google Play"}
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
