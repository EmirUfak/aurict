#!/usr/bin/env bun
import { createHash } from "node:crypto"
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const installer = join(root, "apps/web/public/install.sh")
const temp = mkdtempSync(join(tmpdir(), "aurict-install-test-"))
const releaseDir = join(temp, "release")
const mockBinDir = join(temp, "bin")
const installDir = join(temp, "installed")
const homeDir = join(temp, "home")

function checksum(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

function runInstaller(): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(["bash", installer], {
    cwd: root,
    env: {
      ...process.env,
      AURICT_INSTALL_DIR: installDir,
      AURICT_INSTALL_VERSION: "9.9.9",
      AURICT_RELEASE_BASE_URL: "https://releases.example.test/aurict",
      AURICT_TEST_RELEASE_DIR: releaseDir,
      HOME: homeDir,
      PATH: `${mockBinDir}:${process.env.PATH ?? ""}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
}

try {
  mkdirSync(releaseDir, { recursive: true })
  mkdirSync(mockBinDir, { recursive: true })
  mkdirSync(homeDir, { recursive: true })

  const asset = "aurict-linux-x64"
  const sourceBinary = join(releaseDir, asset)
  writeFileSync(sourceBinary, "#!/usr/bin/env sh\nprintf 'aurict 9.9.9\\n'\n")
  chmodSync(sourceBinary, 0o755)
  writeFileSync(join(releaseDir, "checksums.txt"), `${checksum(sourceBinary)}  ${asset}\n`)

  const mockCurl = join(mockBinDir, "curl")
  writeFileSync(mockCurl, `#!/usr/bin/env bash
set -euo pipefail
output=""
for ((index = 1; index <= $#; index++)); do
  if [[ "\${!index}" == "--output" ]]; then
    next=$((index + 1))
    output="\${!next}"
  fi
done
url="\${!#}"
case "$url" in
  */checksums.txt) cp "$AURICT_TEST_RELEASE_DIR/checksums.txt" "$output" ;;
  */aurict-linux-x64) cp "$AURICT_TEST_RELEASE_DIR/aurict-linux-x64" "$output" ;;
  *) exit 2 ;;
esac
`)
  chmodSync(mockCurl, 0o755)

  const success = runInstaller()
  if (success.exitCode !== 0) {
    throw new Error(`installer failed:\n${success.stderr.toString()}`)
  }

  const installed = join(installDir, "aurict")
  const version = Bun.spawnSync([installed, "--version"], { stdout: "pipe", stderr: "pipe" })
  if (version.exitCode !== 0 || version.stdout.toString().trim() !== "aurict 9.9.9") {
    throw new Error("installer did not install an executable release binary.")
  }

  const originalChecksum = checksum(sourceBinary)
  const invalidChecksum = `${originalChecksum[0] === "0" ? "1" : "0"}${originalChecksum.slice(1)}`
  writeFileSync(join(releaseDir, "checksums.txt"), `${invalidChecksum}  ${asset}\n`)
  const rejected = runInstaller()
  if (rejected.exitCode === 0 || !rejected.stderr.toString().includes("checksum verification failed")) {
    throw new Error("installer accepted a binary with an invalid checksum.")
  }

  console.log("Installer test passed.")
} finally {
  rmSync(temp, { recursive: true, force: true })
}
