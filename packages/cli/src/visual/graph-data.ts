/**
 * Local facade that re-exports the CodeGraph extractor from `@aurict/core`.
 *
 * The implementation lives in `packages/core/src/project-context/semantic-graph.ts`
 * so the agent's own context-pipeline (see `skill/injector.ts`) can reuse the
 * same data path without taking a CLI-side dependency. The `/visual` command
 * and HTTP server import from here to keep `packages/cli` self-contained.
 */

export {
  loadGraphData,
  loadGraphSummary,
  loadGraphForViewer,
  isGraphReady,
  CODEGRAPH_DB_PATH,
  type GraphJson,
  type GraphNode,
  type GraphEdge,
  type GraphSummary,
  type NodeKind,
  type EdgeKind,
} from "@aurict/core"