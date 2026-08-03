import { runIpcServer } from "./ipc-server.js"
import { initializeConfiguredProviders } from "./provider-setup.js"

/** Start the desktop JSON-lines runtime without loading terminal UI modules. */
export async function runDesktopSidecar(workdir: string): Promise<void> {
  await initializeConfiguredProviders(workdir)
  await runIpcServer(workdir)
}
