"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { localizeFaqs } from "@/content/landing-translations"
import styles from "./LandingSections.module.css"

export function LandingFaq() {
  const [openFaq, setOpenFaq] = useState(0)
  const tr = useLocale() === "tr"
  const faqs = localizeFaqs(tr ? "tr" : "en")

  return (
    <section className={styles.faq} id="faq">
      <div className={styles.eyebrow}>{tr ? "sss" : "faq"}</div>
      <div className={styles.faqHeading}>
        <h2>{tr ? "Mühendislerin gerçekten sorduğu sorular." : "Questions engineers actually ask."}</h2>
        <p>{tr ? "Karar vermek için gereken kısa yanıtlar." : "The short answers you need to make a decision."}</p>
      </div>
      <div className={styles.faqList}>
        {faqs.map(([question, answer], index) => {
          const isOpen = openFaq === index
          return (
            <article className={isOpen ? styles.faqOpen : ""} key={question}>
              <h3>
                <button aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)} type="button">
                  <span>{question}</span><span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
              </h3>
              {isOpen && <p>{answer}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
