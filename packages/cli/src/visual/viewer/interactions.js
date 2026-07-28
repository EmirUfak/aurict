// User interactions: raycast picking, search, sidebar population, highlight.
// Wires DOM events on init; mutates state via the shared state module.

import * as THREE from "three"
import { state } from "./state.js"
import { dom, closeSidebar } from "./dom.js"
import { NODE_COLOR_BY_KIND, HIGHLIGHT_SCALE, NODE_SIZE_BASE, NODE_SIZE_DEGREE_FACTOR, NODE_SIZE_MAX } from "./constants.js"

export function wireInteractions() {
  state.renderer.domElement.addEventListener("click", onCanvasClick)
  document.addEventListener("keydown", onKeyDown)
  dom.sidebarClose.addEventListener("click", closeSidebar)
  dom.sidebar.addEventListener("click", onSidebarClick)

  // Search
  dom.searchInput.addEventListener("input", onSearchInput)
  dom.searchInput.addEventListener("keydown", onSearchKey)
  dom.searchList.addEventListener("click", onSearchSelect)
  dom.searchInput.addEventListener("blur", () => setTimeout(() => { dom.searchList.hidden = true }, 140))
  dom.searchInput.addEventListener("focus", () => { if (state.activeSearchHits.length) dom.searchList.hidden = false })
}

// ─── Picking ──────────────────────────────────────────────────────────────────

function onCanvasClick(ev) {
  const rect = state.renderer.domElement.getBoundingClientRect()
  state.mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
  state.mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
  state.raycaster.setFromCamera(state.mouse, state.camera)
  const hits = state.raycaster.intersectObjects([state.pointsObj])
  if (!hits.length) { closeSidebar(); return }
  hits.sort((a, b) => (a.distanceToRay ?? a.distance) - (b.distanceToRay ?? b.distance))
  const idx = hits[0].index
  if (idx === undefined) return
  const node = state.graph.nodes[idx]
  if (node) selectNode(node)
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function onKeyDown(ev) {
  if (ev.key === "Escape") {
    closeSidebar()
    setHighlighted(null)
    dom.searchInput.value = ""
    dom.searchList.hidden = true
    state.activeSearchHits = []
    state.activeSearchIdx = -1
    state.controls.enabled = true
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

function onSearchInput(ev) {
  const q = ev.target.value.trim().toLowerCase()
  if (!q) { state.activeSearchHits = []; dom.searchList.hidden = true; dom.searchList.innerHTML = ""; return }
  const hits = []
  for (const n of state.graph.nodes) {
    if (n.name.toLowerCase().includes(q)) { hits.push(n); if (hits.length >= 20) break }
  }
  state.activeSearchHits = hits
  state.activeSearchIdx = -1
  renderSearchList(hits, q)
}

function renderSearchList(hits, q) {
  if (!hits.length) { dom.searchList.hidden = true; return }
  dom.searchList.hidden = false
  const re = new RegExp(escapeRe(q), "ig")
  dom.searchList.innerHTML = hits
    .map((n, i) => {
      const ns = n.name.replace(re, (m) => "<b>" + m + "</b>")
      return '<li data-id="' + n.id + '" data-idx="' + i + '"><span>' + ns + '</span><span class="kind">' + n.kind + "</span></li>"
    })
    .join("")
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }

function onSearchKey(ev) {
  const hits = state.activeSearchHits
  if (!hits.length) return
  if (ev.key === "ArrowDown") {
    ev.preventDefault()
    state.activeSearchIdx = Math.min(hits.length - 1, state.activeSearchIdx + 1)
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault()
    state.activeSearchIdx = Math.max(-1, state.activeSearchIdx - 1)
  } else if (ev.key === "Enter") {
    ev.preventDefault()
    if (state.activeSearchIdx === -1) state.activeSearchIdx = 0
    const n = hits[state.activeSearchIdx]
    if (n) { selectNode(n); dom.searchList.hidden = true }
    return
  } else {
    return
  }
  Array.from(dom.searchList.children).forEach((li, i) => li.classList.toggle("active", i === state.activeSearchIdx))
  if (state.activeSearchIdx >= 0) {
    const n = hits[state.activeSearchIdx]
    if (n) frameNode(n)
  }
}

function onSearchSelect(ev) {
  const li = ev.target.closest("li")
  if (!li) return
  const id = li.getAttribute("data-id")
  const node = state.nodeById.get(id)
  if (node) { selectNode(node); dom.searchList.hidden = true }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function selectNode(node) {
  const idx = state.dataByIdx.get(node.id)
  setHighlighted(node.id)
  frameNode(node)

  dom.sidebar.classList.add("open")
  dom.nodeName.textContent = node.qualified || node.name
  dom.nodeKind.textContent = node.kind
  dom.nodeKind.style.background = "#" + (NODE_COLOR_BY_KIND[node.kind] ?? 0xaaaaaa).toString(16).padStart(6, "0")
  dom.nodeFile.textContent = node.file + ":" + node.start + "-" + node.end

  const adjs = state.index.get(node.id) ?? { out: [], in: [], refs: [] }
  const calls = adjs.out.filter((e) => e.kind === "calls" || e.kind === "instantiates" || e.kind === "implements" || e.kind === "extends")
  const callers = adjs.in
  const refs = adjs.refs

  dom.callsCount.textContent = calls.length
  dom.callersCount.textContent = callers.length
  dom.nodeCalls.innerHTML = calls.length
    ? calls.map((e) => '<li class="clickable" data-id="' + e.target + '"><span>' + displayName(e.target) + '</span><span class="arrow">→</span><span class="kind">' + e.kind + "</span></li>").join("")
    : "<li>—</li>"
  dom.nodeCallers.innerHTML = callers.length
    ? callers.map((e) => '<li class="clickable" data-id="' + e.source + '"><span>' + displayName(e.source) + '</span><span class="arrow">←</span><span class="kind">' + e.kind + "</span></li>").join("")
    : "<li>—</li>"
  dom.nodeRefs.innerHTML = refs.length
    ? refs.map((e) => {
        const other = e.source === node.id ? e.target : e.source
        return '<li class="clickable" data-id="' + other + '">' + displayName(other) + ' <span class="kind">' + e.kind + "</span></li>"
      }).join("")
    : "<li>—</li>"
}

function displayName(id) {
  const n = state.nodeById.get(id)
  return n ? n.name : "<i>" + id.slice(0, 12) + "…</i>"
}

function onSidebarClick(ev) {
  const li = ev.target.closest("li.clickable")
  if (!li) return
  const id = li.getAttribute("data-id")
  const node = state.nodeById.get(id)
  if (node) selectNode(node)
}

// ─── Highlight + camera framing ────────────────────────────────────────────────

function setHighlighted(id) {
  const colors = state.pointsGeo.attributes.color.array
  const sizes  = state.pointsGeo.attributes.size.array

  // Restore previous highlight
  if (state.highlightedId !== null) {
    const pIdx = state.dataByIdx.get(state.highlightedId)
    const prev = state.graph.nodes[pIdx]
    if (prev) {
      const c = new THREE.Color(NODE_COLOR_BY_KIND[prev.kind] ?? 0xaaaaaa)
      colors[pIdx * 3 + 0] = c.r
      colors[pIdx * 3 + 1] = c.g
      colors[pIdx * 3 + 2] = c.b
      const deg = (prev.inDeg ?? 0) + (prev.outDeg ?? 0)
      sizes[pIdx] = Math.min(NODE_SIZE_MAX, NODE_SIZE_BASE + deg * NODE_SIZE_DEGREE_FACTOR)
    }
  }
  state.highlightedId = id
  if (id !== null) {
    const pIdx = state.dataByIdx.get(id)
    if (pIdx !== undefined) {
      colors[pIdx * 3 + 0] = 1.0
      colors[pIdx * 3 + 1] = 1.0
      colors[pIdx * 3 + 2] = 1.0
      sizes[pIdx] *= HIGHLIGHT_SCALE
    }
  }
  state.pointsGeo.attributes.color.needsUpdate = true
  state.pointsGeo.attributes.size.needsUpdate = true
}

function frameNode(node) {
  const idx = state.dataByIdx.get(node.id)
  if (idx === undefined) return
  const simNode = state.simNodes[idx]
  if (!simNode) return
  // Ease the controls target toward the selected node — frames without hijack.
  const target = new THREE.Vector3(simNode.x, simNode.y, simNode.z)
  state.controls.target.lerp(target, 0.55)
}