import { createAgentWorker } from "../packages/core/src/agent/pool.js"

const worker = createAgentWorker()

try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Compiled worker did not open within 5 seconds")), 5_000)
    worker.addEventListener("open", () => {
      clearTimeout(timer)
      resolve()
    })
    worker.addEventListener("error", event => {
      clearTimeout(timer)
      reject(new Error(event.message))
    })
  })
  console.log("Compiled agent worker bootstrap: ok")
} finally {
  worker.terminate()
}
