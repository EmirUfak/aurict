"use client"

import { useState } from "react"
import { IcarusIntro } from "@/components/IcarusIntro"

export function IntroPreviewClient() {
  const [runId, setRunId] = useState(0)
  const [playing, setPlaying] = useState(true)

  function replay() {
    setRunId((id) => id + 1)
    setPlaying(true)
  }

  return (
    <main className="intro-preview-shell">
      {playing && <IcarusIntro key={runId} force onDone={() => setPlaying(false)} />}

      <section className="intro-preview-panel">
        <p className="marketing-eyebrow">Manual animation preview</p>
        <h1>Opening sequence test surface</h1>
        <p>
          This route is not linked from the product navigation. Use it to replay the first-entry Aurict intro without touching browser storage.
        </p>
        <button className="aur-button aur-button-primary" type="button" onClick={replay}>
          replay intro
        </button>
      </section>
    </main>
  )
}
