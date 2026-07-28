// d3-force-3d simulation — nodes & links shape, tick driver, adjacency index.
// The sim runs in 3D; per-frame we copy positions into three.js buffers (scene.js).

import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY, forceZ } from "https://esm.sh/d3-force-3d@3.0.5"
import { state } from "./state.js"
import { LINK_DISTANCE, FIELD_STRENGTH, ALPHA_DECAY, SIM_TICKS_PER_FRAME } from "./constants.js"
import { writePositionsToGpu } from "./scene.js"

/** Build adjacency lists once the graph is loaded. */
export function buildIndex(graph) {
  for (const n of graph.nodes) state.nodeById.set(n.id, n)
  const index = new Map()
  const ensure = (id) => {
    let e = index.get(id)
    if (!e) { e = { out: [], in: [], refs: [] }; index.set(id, e) }
    return e
  }
  for (const n of graph.nodes) ensure(n.id)
  for (const e of graph.edges) {
    const src = ensure(e.source)
    const dst = ensure(e.target)
    if (e.kind === "calls") { src.out.push(e); dst.in.push(e) }
    else if (e.kind === "references" || e.kind === "imports") { src.refs.push(e); dst.refs.push(e) }
    else { src.out.push(e); dst.in.push(e) }  // instantiates / implements / extends
  }
  state.index = index
}

/** Initialise the force simulation with live node/link objects. */
export function initSim(graph) {
  const simNodes = graph.nodes.map((n) => ({
    id: n.id, kind: n.kind, name: n.name, file: n.file,
    inDeg: n.inDeg, outDeg: n.outDeg,
    x: (Math.random() - 0.5) * 60,
    y: (Math.random() - 0.5) * 60,
    z: (Math.random() - 0.5) * 60,
    vx: 0, vy: 0, vz: 0,
  }))
  const simLinks = graph.edges
    .map((e) => ({ source: e.source, target: e.target, kind: e.kind }))
    .filter((l) => state.dataByIdx.has(l.source) && state.dataByIdx.has(l.target))

  const sim = forceSimulation(simNodes, 3)
    .force("link", forceLink(simLinks).id((d) => d.id).distance(LINK_DISTANCE).strength(0.18))
    .force("charge", forceManyBody().strength(FIELD_STRENGTH))
    .force("center", forceCenter(0, 0, 0))
    .force("x", forceX().strength(0.02))
    .force("y", forceY().strength(0.02))
    .force("z", forceZ().strength(0.02))
    .alphaDecay(ALPHA_DECAY)

  state.sim = sim
  state.simNodes = simNodes
  state.simLinks = simLinks
}

/** Advance the sim a few ticks + push positions to GPU. Called from the RAF loop. */
export function tickSim() {
  if (!state.sim) return
  // Keep ticking while alpha is meaningfully above the rest threshold —
  // prevents a static graph from burning CPU forever.
  if (state.sim.alpha() <= state.sim.alphaMin() * 4) return
  for (let i = 0; i < SIM_TICKS_PER_FRAME; i++) state.sim.tick()
  writePositionsToGpu()
}