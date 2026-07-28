// Viewer bootstrap: fetch graph → init three.js → init sim → wire UI → loop.
// Entry point referenced from index.html as <script type="module" src="/viewer/main.js">.

import { state } from "./state.js"
import { setLoader, hideLoader, showHint, dom } from "./dom.js"
import { initThree, renderFrame } from "./scene.js"
import { buildIndex, initSim, tickSim } from "./sim.js"
import { wireInteractions, selectNode } from "./interactions.js"

main().catch((err) => {
  console.error(err)
  showHint("Failed to load: " + (err instanceof Error ? err.message : String(err)))
})

async function main() {
  setLoader("Loading semantic graph…")
  const resp = await fetch("/api/graph")
  if (!resp.ok) throw new Error("server returned " + resp.status)
  const graph = await resp.json()
  state.graph = graph

  if (!graph.nodes.length) {
    showHint("No CodeGraph index found for this project. Run <code>codegraph init</code> and refresh, or wait for the index to be built.")
    hideLoader()
    return
  }

  buildIndex(graph)
  initThree()
  initSim(graph)
  populateStats(graph)
  wireInteractions()
  hideLoader()
  loop()
}

function loop() {
  requestAnimationFrame(loop)
  tickSim()
  renderFrame()
}

function populateStats(graph) {
  dom.statsNodes.textContent = String(graph.stats.nodes)
  dom.statsEdges.textContent = String(graph.stats.edges)
  dom.statsFiles.textContent = String(graph.stats.files)
}