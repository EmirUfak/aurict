// Cached DOM references for the viewer. Single source of truth so modules
// never call getElementById on the fly.

export const dom = {
  viewport:    document.getElementById("viewport"),
  loader:      document.getElementById("loader"),
  loaderMsg:   document.getElementById("loader-msg"),
  hint:        document.getElementById("hint"),
  statsNodes:  document.getElementById("stat-nodes"),
  statsEdges:  document.getElementById("stat-edges"),
  statsFiles:  document.getElementById("stat-files"),
  searchInput: document.getElementById("search-input"),
  searchList:  document.getElementById("search-results"),
  sidebar:     document.getElementById("sidebar"),
  sidebarClose:document.getElementById("sidebar-close"),
  nodeName:    document.getElementById("node-name"),
  nodeKind:    document.getElementById("node-kind"),
  nodeFile:    document.getElementById("node-file"),
  nodeCalls:   document.getElementById("node-calls"),
  nodeCallers: document.getElementById("node-callers"),
  nodeRefs:    document.getElementById("node-refs"),
  callsCount:  document.getElementById("calls-count"),
  callersCount:document.getElementById("callers-count"),
}

export function setLoader(msg) {
  dom.loaderMsg.textContent = msg
}

export function hideLoader() {
  dom.loader.classList.add("hidden")
}

export function showHint(html) {
  dom.hint.style.display = "block"
  dom.hint.innerHTML = html
}

export function closeSidebar() {
  dom.sidebar.classList.remove("open")
}