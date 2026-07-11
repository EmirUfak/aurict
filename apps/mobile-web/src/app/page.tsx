"use client";

import { motion } from "framer-motion";
import AmbientBackground from "@/components/AmbientBackground";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Apps from "@/components/Apps";
import Contact from "@/components/Contact";

export default function HomePage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <AmbientBackground />
      <Hero />
      <About />
      <Apps />
      <Contact />
    </motion.div>
  );
}
