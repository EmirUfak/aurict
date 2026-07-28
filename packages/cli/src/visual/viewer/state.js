// Shared mutable state — read by every module to avoid import cycles.
// No DOM here (that lives in dom.js), no constants (constants.js).

export const state = {
  // Input graph data
  graph: null,
  nodeById: new Map(),
  dataByIdx: new Map(),
  index: null,        // adjacency: id -> { out: [], in: [], refs: [] }

  // three.js resources
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  pointsObj: null,
  pointsGeo: null,
  pointsMaterial: null,
  linesObj: null,
  linesGeo: null,
  raycaster: null,
  mouse: null,

  // d3-force-3d
  sim: null,
  simNodes: null,
  simLinks: null,

  // UI
  highlightedId: null,
  activeSearchHits: [],
  activeSearchIdx: -1,
}