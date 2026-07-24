// three.js scene setup — points (nodes) + line segments (edges).
// All geometry is rebuilt from the graph on init; per-frame updates only
// touch position attributes (cheap BufferAttribute writes).

import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { state } from "./state.js"
import { dom } from "./dom.js"
import { NODE_COLOR_BY_KIND, EDGE_COLOR, NODE_SIZE_BASE, NODE_SIZE_DEGREE_FACTOR, NODE_SIZE_MAX } from "./constants.js"

export function initThree() {
  const w = window.innerWidth
  const h = window.innerHeight

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0c10)
  scene.fog = new THREE.FogExp2(0x0b0c10, 0.008)
  state.scene = scene

  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 4000)
  camera.position.set(60, 40, 80)
  state.camera = camera

  const renderer = new THREE.WebGLRenderer({
    canvas: dom.viewport,
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(w, h)
  state.renderer = renderer

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.7
  state.controls = controls

  // Lights aren't used by Points/LineSegments but help any future mesh
  // overlays (selection halo etc.).
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const key = new THREE.DirectionalLight(0xffffff, 0.6)
  key.position.set(40, 60, 40)
  scene.add(key)

  // Subtle grid so depth/scale reads in the void.
  const grid = new THREE.GridHelper(400, 40, 0x1a1d27, 0x14161e)
  grid.position.y = -40
  scene.add(grid)

  buildPoints(scene)
  buildLines(scene)

  // Raycaster for picking — threshold tuned to point size.
  state.raycaster = new THREE.Raycaster()
  state.raycaster.params.Points.threshold = 0.9
  state.mouse = new THREE.Vector2()

  window.addEventListener("resize", onResize, { passive: true })
}

function buildPoints(scene) {
  const graph = state.graph
  const n = graph.nodes.length
  const positions = new Float32Array(n * 3)
  const colors    = new Float32Array(n * 3)
  const sizes     = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const node = graph.nodes[i]
    state.dataByIdx.set(node.id, i)
    // Random initial position so the layout is unbiased before sim converges.
    positions[i * 3 + 0] = (Math.random() - 0.5) * 60
    positions[i * 3 + 1] = (Math.random() - 0.5) * 60
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60
    const c = new THREE.Color(NODE_COLOR_BY_KIND[node.kind] ?? 0xaaaaaa)
    colors[i * 3 + 0] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    const deg = (node.inDeg ?? 0) + (node.outDeg ?? 0)
    sizes[i] = Math.min(NODE_SIZE_MAX, NODE_SIZE_BASE + deg * NODE_SIZE_DEGREE_FACTOR)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3))
  geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.PointsMaterial({
    size: 4,
    sizeAttenuation: true,
    vertexColors: true,
    map: makeCircleTexture(),
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)
  state.pointsObj = points
  state.pointsGeo = geo
  state.pointsMaterial = mat
}

function buildLines(scene) {
  const graph = state.graph
  const m = graph.edges.length
  const positions = new Float32Array(m * 6)
  const colors    = new Float32Array(m * 6)

  for (let i = 0; i < m; i++) {
    const e = graph.edges[i]
    const sIdx = state.dataByIdx.get(e.source)
    const tIdx = state.dataByIdx.get(e.target)
    if (sIdx === undefined || tIdx === undefined) continue
    // Will be overwritten each frame as the sim moves the points.
    positions[i * 6 + 0] = 0
    positions[i * 6 + 1] = 0
    positions[i * 6 + 2] = 0
    positions[i * 6 + 3] = 0
    positions[i * 6 + 4] = 0
    positions[i * 6 + 5] = 0
    const c = new THREE.Color(EDGE_COLOR[e.kind] ?? 0x444444)
    for (let k = 0; k < 6; k += 3) {
      colors[i * 6 + k + 0] = c.r * 0.4
      colors[i * 6 + k + 1] = c.g * 0.4
      colors[i * 6 + k + 2] = c.b * 0.4
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false })
  const lines = new THREE.LineSegments(geo, mat)
  scene.add(lines)
  state.linesObj = lines
  state.linesGeo = geo
}

function makeCircleTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const ctx = c.getContext("2d")
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)")
  grad.addColorStop(0.65, "rgba(255,255,255,0.85)")
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight
  state.camera.aspect = w / h
  state.camera.updateProjectionMatrix()
  state.renderer.setSize(w, h)
}

// Per-frame: copy sim positions into the GPU buffers.
export function writePositionsToGpu() {
  const simNodes = state.simNodes
  if (!simNodes) return
  const positions = state.pointsGeo.attributes.position.array
  for (let i = 0; i < simNodes.length; i++) {
    const node = simNodes[i]
    positions[i * 3 + 0] = node.x
    positions[i * 3 + 1] = node.y
    positions[i * 3 + 2] = node.z
  }
  state.pointsGeo.attributes.position.needsUpdate = true

  const edgePos = state.linesGeo.attributes.position.array
  const dataByIdx = state.dataByIdx
  for (let i = 0; i < state.simLinks.length; i++) {
    const link = state.simLinks[i]
    const sIdx = dataByIdx.get(link.source.id)
    const tIdx = dataByIdx.get(link.target.id)
    if (sIdx === undefined || tIdx === undefined) continue
    const sn = simNodes[sIdx]
    const tn = simNodes[tIdx]
    edgePos[i * 6 + 0] = sn.x
    edgePos[i * 6 + 1] = sn.y
    edgePos[i * 6 + 2] = sn.z
    edgePos[i * 6 + 3] = tn.x
    edgePos[i * 6 + 4] = tn.y
    edgePos[i * 6 + 5] = tn.z
  }
  state.linesGeo.attributes.position.needsUpdate = true
}

// Render one frame + advance controls.
export function renderFrame() {
  state.controls.update()
  state.renderer.render(state.scene, state.camera)
}