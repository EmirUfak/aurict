# Hoprel by Aurict

Hoprel is Aurict's Electron desktop workspace. The renderer is
isolated from Node and talks to a Bun sidecar through a narrow JSON-lines IPC
bridge.

## Develop

From the repository root:

```sh
bun run --cwd apps/desktop start
```

Use the workspace path in the titlebar to select the project Aurict should
read and edit. The selection is persisted in Electron's user-data directory;
the active workspace is also the sidecar's current working directory.

## Package

```sh
bun run --cwd apps/desktop package
```

The package command first compiles `packages/cli/src/index.ts` into a native
Bun sidecar and copies the design catalog into `apps/desktop/resources/`.
Electron Forge places both beside the packaged application. Generated resource
files are ignored by Git.

The repository uses Bun's isolated workspace installs. Its root `bunfig.toml`
publicly hoists `@tanstack/virtual-core` so Vite can bundle the renderer's
virtualized session list; keep that setting when updating dependencies.

Until `electron-installer-redhat` releases its RPM 4.20+ fix, Bun applies the
tracked upstream patch in `patches/electron-installer-redhat@3.4.0.patch`.

## Windows beta release

Pushing a `desktop-beta-v*` tag creates a self-signed Windows x64 installer
an unsigned Debian amd64 `.deb` package, and unsigned macOS ZIPs for Intel
and Apple Silicon, each with a SHA-256 checksum, in a GitHub prerelease. This
is a temporary public testing channel, not a trusted-public-signing
replacement: Windows may show a SmartScreen warning and macOS may show a
Gatekeeper warning. The ephemeral Windows beta certificate is generated only
inside the CI run and is never committed or reused. Do not ask users to add it
to their trusted root store.

`electron-winstaller` selects its host-architecture 7-Zip binary during its
install lifecycle script. As it is a transitive optional dependency, the
Windows workflow runs that upstream selector explicitly before invoking the
Squirrel maker and verifies the generated `vendor/7z.exe` file.

## Local data

Desktop-owned settings live in Electron's user-data directory. The sidecar
receives a separate writable `core/` state directory there for sessions,
provider configuration, and design preferences; packaged design catalogs are
read from a separate read-only asset directory. On first launch with the new
state directory, the sidecar copies the legacy core DB/config/preferences from
`~/.aurict` without deleting the original files.

## Design Studio

Design Studio creates local-first artifacts. An artifact has a brief, selected
design system and workflow, workspace association, output HTML, and immutable
HTML revisions. The sidecar writes the current output and revision files under
the app's Electron user-data directory, not into the workspace. Use **promote**
from an artifact to hand its visual intent to Aurict's normal approved coding
flow.

Preview HTML runs in a sandboxed iframe with a restrictive CSP. It cannot use
the Electron bridge, local filesystem, arbitrary network connections, forms,
or nested frames; Google Fonts is the sole allowed external resource.

## Finance calculation foundation

The Finance Desk runs deterministic decimal calculations for NPV, IRR, XIRR
(Actual/365 fixed), CAGR, DCF, amortization schedules, fixed-coupon bond
metrics, and full bond yield-shock repricing. The renderer sends a narrow
request to the Bun sidecar; it never implements financial math itself.

Every successful result is saved locally with its exact inputs, formula
version, precision, assumptions, warnings, and calculation timestamp. The
History tab keeps these calculation records separate from finance research
requests. A research response must finish with a structured audit record; its
source URLs, publication/access dates, data-as-of date, assumptions, and
uncertainties are retained locally. Missing or malformed audit records are
explicitly marked **needs review** rather than treated as complete. The agent can use the same local
`finance_calculate` tool when a finance research request needs deterministic
math; this is analytical output, not personalized financial advice.

Failed Design Studio artifacts retain their brief, selected system, error, and
immutable revisions. Open a failed artifact and use **retry generation** to
resume it without creating a duplicate artifact. The developer session rail
also shows persisted session status, provider/model, token totals, cost, last
update, and parent-session relationship when available.

## Verification

```sh
bun run --cwd apps/desktop lint
bun run typecheck
bun test apps/desktop/test
bun run --cwd apps/desktop package
bun test packages/core/test/design-artifacts.test.ts
```

## Desktop quality gate

Before a desktop release, verify the first-run, appearance, recovery, and
workspace flows in both light and dark modes. A release is blocked if a
sidecar request can remain pending without a visible timeout/retry path, a
stored profile cannot be recovered safely, or a keyboard-only user cannot
complete onboarding and change appearance settings.

The renderer uses application-owned confirmation, text-entry, and notification
surfaces for workspace mutations; browser `alert`, `confirm`, and `prompt`
must not be introduced. Dialogs must support Escape, a visible focus state,
and explicit labels. Verify file creation, rename, deletion, unsaved-tab
discard, session deletion, approval denial, and Design preview dismissal with
the keyboard before release. At the 960px minimum window width, also verify
that titlebar navigation remains usable, workspace details collapse without
overlap, Finance preserves its main work area, and the Artifact preview stays
readable.

For conversation quality, simulate a failed task and confirm the assistant
turn stops showing as active, the error exposes **retry last task**, and a
completed response can be copied. For Design Studio, exercise workflow
matching, reference-image selection, refresh, a failed artifact retry, and
Escape dismissal of its sandboxed preview. For Finance Desk, exercise a
research template, a calculation reset, copying an exact calculation record,
newest-history selection, and confirmation before deleting local research or
calculation records.

For the role and recovery pass, complete onboarding for every user type and
confirm that each type’s recommended layout, live theme, color mode, and font
preview update before saving. In Settings, change appearance, switch the
active workspace, exercise a provider/policy failure and retry path, then
return to the affected surface. Provider, model, policy, workspace, and
artifact-preview failures must remain visible to the user rather than only
being written to the developer console.

For a manual release pass, create each of the six user profiles and verify its
primary navigation surface: Home, Workspace, Product Hub, Design Studio,
Operations Desk, and Finance Desk. Repeat the pass in light and dark mode,
then interrupt the sidecar once and confirm that the visible retry path
recovers without leaving a request pending.
