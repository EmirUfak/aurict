import "reflect-metadata"

import { migrateLegacyCoreState } from "../../../packages/cli/src/util/state-migration.js"

migrateLegacyCoreState()

const { runDesktopSidecar } = await import("../../../packages/cli/src/desktop-sidecar.js")
await runDesktopSidecar(process.cwd())
