# Aurict Hive — Public Client Boundary and Delivery Plan

Status: design plan; not a shipped capability.

## 1. Decision

Aurict Hive is a paid organization collaboration service used from both the
terminal CLI and Hoprel desktop. The public Aurict repository contains the
client-side contracts and runtime integration needed to connect to Hive. The
multi-user coordinator, organization state, entitlement decisions, distributed
leases, integration queue, and audit backend remain in the private
`aurict-hive` service.

This boundary is intentional:

- Existing local multi-agent functionality remains available to every Aurict
  user.
- Cross-user and cross-device Hive functionality is never enabled by a local
  config flag alone.
- A modified public client may reproduce the UI, but it cannot use the hosted
  Hive service without a valid organization membership, paid entitlement,
  registered device, and server-issued capability.
- All authoritative authorization is performed by the private service. UI
  hiding and client checks are defense-in-depth only.

## 2. Product promise

Hive lets separate Aurict installations coordinate work on the same canonical
repository without making users manually coordinate agents.

The product may promise:

- users keep their own local Aurict agent;
- entitled agents can discover other agents in the same organization project;
- overlapping work is detected before integration;
- a task can be handed from one agent to another with durable state;
- writes are serialized by repository scope and target revision;
- Aurict manages agent-created patch refresh and integration where policy
  allows it.

The product must not promise that Git conflicts are impossible. Direct human
pushes, external automation, and contradictory requirements can still create a
real conflict. In those cases Hive must stop and surface a decision rather than
silently choosing a winner.

## 3. Open and closed source boundary

### Public in this repository

The public side owns:

- versioned Hive wire types and event names;
- repository identity and revision fingerprint inputs;
- an authenticated HTTPS/WebSocket client;
- a fail-closed capability state machine;
- local agent presence projection;
- a runtime bridge for structured, redacted agent events;
- a mutation authorization hook used only while a Hive room is active;
- lease renewal/expiry handling in the local runtime;
- local isolated-worktree lifecycle adapters;
- Desktop sidecar IPC types and renderer view models;
- terminal commands, status views, and room activity views;
- user approval surfaces for repository writes and integration requests;
- protocol conformance tests using a fake server;
- public documentation of data sent to Hive.

The public side does not own:

- organization or subscription databases;
- entitlement issuance or verification policy;
- agent matching across users;
- task arbitration or handoff decisions;
- distributed lease ownership;
- integration queue ordering;
- audit retention or compliance exports;
- billing, seat limits, SSO, SCIM, or organization policy;
- hosted WebSocket fan-out;
- proprietary server deployment artifacts.

### Private in `/home/f0x017/Desktop/aurict-hive`

The private service owns:

- organization, membership, role, seat, and subscription state;
- device-bound capability issuance;
- project/repository enrollment and policy;
- durable rooms, intents, tasks, messages, and presence;
- task ownership transfer and handoff checkpoints;
- distributed scope leases with fencing tokens;
- single-writer integration queues per target ref;
- patch/commit registration and stale-base decisions;
- real-time revocation and abuse controls;
- immutable security/audit events and retention jobs;
- hosted and licensed self-managed deployment;
- operational dashboards, metrics, backups, and SLA controls.

The private service must be a separate network program. It must not import,
link, copy, or embed `@aurict/core`, `@aurict/sdk`, Desktop internals, or CLI
internals. It independently validates its own request DTOs and communicates
with public Aurict only through a documented, versioned network protocol.

## 4. Access model: normal users must not be able to use Hive

“Not available to normal users” is enforced as a server property, not a
renderer property.

### Required conditions

Every active Hive connection must satisfy all of the following:

1. The user has authenticated through the existing Aurict account flow.
2. The account is an active member of the requested organization.
3. The organization has an active Hive entitlement and an available seat.
4. The user has a project role permitting the requested operation.
5. The client device is registered and not revoked.
6. The capability token is short-lived, audience-bound, organization-bound,
   project-bound, and device-bound.
7. The server rechecks current entitlement for every state-changing request.
8. Repository mutation and integration requests also carry a current task
   claim, lease fencing token, base revision, and idempotency key.

Failure of any condition denies the action. There is no permissive fallback.

### Capability examples

- `hive.room.read`
- `hive.room.join`
- `hive.intent.publish`
- `hive.agent.message`
- `hive.task.claim`
- `hive.task.handoff`
- `hive.lease.acquire`
- `hive.patch.register`
- `hive.integration.request`
- `hive.policy.admin`
- `hive.audit.read`

Capabilities are granular. Receiving `hive.room.read` must not imply write,
lease, integration, or admin access.

### Client state machine

The shared public state machine uses explicit states:

```text
disabled
  -> discovering
  -> unavailable | unauthenticated | unentitled
  -> entitled
  -> joining
  -> active
  -> degraded
  -> revoked
```

Rules:

- `unentitled` is the normal-user steady state and produces no Hive navigation,
  commands, tools, prompts, or background connection.
- Capability discovery may run after an explicit account sign-in or account
  state change. It sends no repository/session data and must not open a room or
  presence connection for an unentitled account.
- A network error is not treated as `unentitled`; it is visible as
  `unavailable` or `degraded`.
- Cached capability data may improve display latency but never authorizes a
  write after token expiry.
- Revocation immediately stops lease renewal and all new shared mutations.
- A room cannot silently fall back to uncoordinated local writes. The user must
  explicitly leave the room before continuing in solo mode.
- Environment variables may override a development endpoint, but cannot grant
  capabilities.

## 5. Shared protocol surface

The public contract should be small and versioned independently of local agent
internals. Initial protocol id: `aurict.hive/v1`.

### Stable identifiers

- `organizationId`
- `projectId`
- `repositoryId`
- `roomId`
- `participantId`
- `agentInstanceId`
- `intentId`
- `taskId`
- `leaseId`
- `handoffId`
- `patchId`
- `integrationId`
- `eventId`

Identifiers are opaque. A local filesystem path is never a repository identity.

### Canonical repository identity

Repository matching uses:

- normalized Git provider and remote repository id;
- target ref;
- base commit SHA;
- optional subdirectory scope;
- an organization-controlled project mapping.

If a repository has no recognized remote, the client may join a read-only room
but cannot acquire a shared write lease.

### Event classes

Public event names:

- `room.joined`
- `room.left`
- `participant.presence`
- `agent.started`
- `agent.stopped`
- `intent.proposed`
- `intent.overlap_detected`
- `task.created`
- `task.claimed`
- `task.blocked`
- `task.completed`
- `handoff.requested`
- `handoff.accepted`
- `handoff.rejected`
- `lease.acquired`
- `lease.renewed`
- `lease.expiring`
- `lease.released`
- `lease.revoked`
- `patch.registered`
- `patch.stale`
- `verification.completed`
- `integration.queued`
- `integration.completed`
- `integration.failed`
- `decision.required`
- `capability.revoked`

Events carry bounded structured metadata. They never carry model chain of
thought. Prompt text, file content, tool output, and full diffs are excluded by
default.

### Command requirements

Every mutating command includes:

- protocol version;
- organization/project/room ids;
- actor user and device context derived by the server;
- client-generated idempotency key;
- expected room sequence or resource version;
- task id where applicable;
- lease id and fencing token for scoped mutations;
- base commit/revision for patch or integration operations.

## 6. Public source layout

Implementation should be split into small modules. Proposed layout:

```text
packages/core/src/hive/
  contracts.ts
  events.ts
  errors.ts
  capabilities.ts
  capability-state.ts
  repository-identity.ts
  client.ts
  websocket.ts
  room-session.ts
  runtime-bridge.ts
  mutation-authorization.ts
  lease-session.ts
  worktree-adapter.ts
  redaction.ts

packages/cli/src/hive/
  controller.ts
  command.ts
  status-view.tsx
  room-view.tsx
  activity-model.ts

apps/desktop/src/renderer/hive/
  HiveEntry.tsx
  HiveRoom.tsx
  HiveActivity.tsx
  useHiveStatus.ts
  useHiveRoom.ts
```

No new code file should approach the repository’s approximately 500-line code
limit. Protocol DTOs should be separated from transport and presentation.

## 7. Core runtime integration

### Runtime boundary

`AgentRuntime` remains the only provider/tool loop. Hive is an optional runtime
collaboration adapter, not a second agent runtime.

Add an optional `CollaborationRuntime` interface with methods equivalent to:

- obtain current capability snapshot;
- publish bounded structured events;
- claim or release a task;
- request, renew, and release a scope lease;
- authorize a mutation;
- register a completed patch;
- receive coordinator commands;
- disconnect and revoke local authority.

When no entitled adapter is present, existing behavior must be byte-for-byte
equivalent where practical.

### Mutation enforcement

Existing local file locks remain a local safety layer but are not Hive
authority.

While a Hive room is active:

- agents write only in task-specific isolated Git worktrees;
- all mutation-capable tools are covered, including `write`, `edit`,
  `apply_patch`, notebook edits, structural edits, language-server edits, and
  shell-created changes;
- shell execution occurs inside the isolated worktree;
- the post-command changed-file set is compared with the leased scope;
- every mutation uses the latest fencing token;
- a stale or revoked lease fails before patch registration;
- primary checkout mutation is denied;
- verification evidence is bound to the exact resulting revision;
- integration is a separate server-authorized step.

The public client must never decide that two conflicting scopes are safe merely
because an LLM says so. Exact path/symbol rules and server ownership are
authoritative; semantic analysis is advisory.

### Handoff

A handoff transfers task ownership, not an agent’s hidden reasoning.

The public client exports a bounded checkpoint containing:

- objective and constraints;
- decisions already made;
- relevant repository paths and symbols;
- base revision and current patch reference;
- completed and pending verification;
- failed approaches;
- user-visible messages and evidence references.

The old owner becomes read-only before the new owner receives a fencing token.
There must never be two valid write owners during handoff.

## 8. Terminal CLI delivery

### Normal user behavior

- No Hive command is added to help, suggestions, system prompts, or tool routing
  while the capability state is `unentitled`.
- No Hive WebSocket is opened.
- No background presence is sent.
- No repository metadata is uploaded.
- Existing local `/agents`, `/coordinator`, and `orchestrate` behavior remains
  unchanged and must not be labeled as paid Hive functionality.

### Entitled user behavior

After normal Aurict sign-in and successful capability discovery, expose:

```text
/hive status
/hive projects
/hive join <project>
/hive room
/hive agents
/hive tasks
/hive leave
```

Headless mode may later accept explicit organization/project/room ids, but must
never auto-join a room based only on an environment variable.

The TUI should show:

- organization/project/room;
- current canonical repository/ref;
- active participants and agents;
- owned task and lease scope;
- pending handoff or human decision;
- connection/lease health;
- integration status.

Loss of authority must be a blocking runtime event, not a transient footer
notice.

## 9. Hoprel desktop delivery

The Bun sidecar owns Hive authentication, transport, capability state, room
connection, and mutation guard. The Electron renderer is not trusted to
authorize actions.

### IPC additions

Add narrow sidecar commands and events:

- `hive:status`
- `hive:list-projects`
- `hive:join`
- `hive:leave`
- `hive:list-room`
- `hive:handoff`
- `hive:decision`
- `hive:event`
- `hive:capability-changed`

All renderer payloads are validated again in the sidecar. The renderer never
receives account tokens, capability tokens, device keys, or raw audit records.

### Normal user behavior

- Hive navigation is not registered.
- Hive routes/components are not mounted.
- No empty “upgrade” shell appears during the first implementation phases.
- The account area may show a generic organization invitation only after the
  backend has returned an actual pending invitation.

### Entitled user behavior

Add a project-room surface containing:

- people and their active agents;
- task ownership and handoff state;
- repository scope leases;
- agent messages and structured activity;
- conflicts requiring a human decision;
- patch verification and integration state.

Desktop and CLI consume the same core controller and protocol contracts. They
must not implement separate coordination semantics.

## 10. Authentication and token handling

Reuse the existing browser/device login for account identity. Hive does not
receive provider API keys.

Recommended exchange:

1. The client obtains the existing short-lived Aurict access token.
2. It calls Hive capability discovery over TLS.
3. Hive validates issuer, audience, expiry, and signature using the existing
   backend’s JWKS endpoint.
4. Hive checks organization membership, subscription, seat, role, project,
   repository enrollment, and device status.
5. Hive returns a short-lived, Hive-audience capability token bound to the
   device key fingerprint and allowed project capabilities.
6. State-changing requests include device proof plus the capability token.
7. WebSocket reauthentication occurs before token expiry.

Do not store access or capability tokens in project files, SQLite session
parts, logs, crash reports, shell environment dumps, or renderer state. Use the
existing secure token/device storage boundary.

Completing real cryptographic device-signature verification is a launch
prerequisite; device registration metadata alone is not sufficient.

## 11. Privacy and data minimization

Default client behavior:

- project files remain local;
- provider keys remain local/BYOK;
- raw prompts are not uploaded;
- chain of thought is never uploaded;
- tool outputs and terminal output are not uploaded;
- only canonical repository identity, revision hashes, scope metadata, task
  state, bounded messages, verification summaries, and patch/commit references
  are sent;
- full patches require explicit organization policy and a visible user action
  or an approved managed-integration mode.

Before release, update:

- privacy policy;
- terms;
- security and compliance documentation;
- account export/deletion scope;
- organization retention controls;
- telemetry and audit disclosure.

## 12. Public implementation phases

### P0 — Boundary and legal review

- Approve the network-only public/private boundary.
- Obtain counsel review of AGPL interaction and distribution.
- Define product names and licensing terms.
- Freeze `aurict.hive/v1` naming rules.

Exit: written boundary decision; no implementation starts before it.

### P1 — Contracts and fake server

- Add versioned DTOs, errors, event sequencing, and capability state.
- Build an in-process fake Hive server for public tests only.
- Add malformed payload, replay, stale sequence, and unknown-event tests.

Exit: protocol conformance tests pass without any private code.

### P2 — Fail-closed client

- Add TLS client, WebSocket reconnect, token expiry, and revocation handling.
- Ensure `unentitled` creates no background activity.
- Add redaction and bounded-payload tests.

Exit: capability bypass tests prove that local config/environment changes do
not authorize any server action.

### P3 — Read-only rooms

- Add repository identity, room join, presence, task/event projection.
- Ship behind server entitlement with no write path.
- Add CLI and Desktop read-only views.

Exit: two entitled installations can observe the same room; normal users see
no new surface.

### P4 — Task claims and messaging

- Add intent submission, task claim, bounded messages, and handoff checkpoints.
- Keep agents read-only with respect to Hive integration.

Exit: task ownership is durable across reconnects and cannot have two owners.

### P5 — Isolated mutation and leases

- Add isolated worktree adapter and mutation authorization.
- Cover every mutation path, including shell side effects.
- Add lease renewal, fencing, expiry, and revocation tests.

Exit: a stale client cannot register or integrate a change.

### P6 — Managed integration

- Add patch/commit registration, verification binding, and integration status.
- Add explicit approval flow and policy projection.
- Exercise target-ref changes during verification and integration.

Exit: entitled Desktop and CLI clients complete the same end-to-end workflow
against staging.

### P7 — Hardening and launch

- Threat model, penetration test, load test, disaster recovery exercise.
- Privacy/legal updates and retention controls.
- Staged organization allowlist, kill switch, and support runbooks.

Exit: all launch gates in section 14 pass.

## 13. Public test matrix

Required automated coverage:

- normal user has no Hive command, navigation, tool, prompt, room connection,
  presence event, or repository-data request; capability discovery is the only
  permitted Hive call after explicit sign-in;
- modifying local config cannot produce `entitled`;
- expired capability blocks writes;
- revoked membership disconnects an active room;
- wrong organization/project/repository ids are rejected;
- WebSocket replay and out-of-order events are ignored and reported;
- reconnect resumes from last acknowledged sequence without duplicating tasks;
- lease expiry blocks mutation and patch registration;
- stale fencing token cannot transfer or integrate work;
- shell-created out-of-scope files fail scope validation;
- handoff leaves exactly one writer;
- dirty primary checkout remains untouched;
- Desktop renderer cannot inject an authorized sidecar command;
- CLI and Desktop project identical room state from the same event log;
- token, prompt, diff, and file-content redaction tests pass;
- solo local multi-agent regression suite remains unchanged.

## 14. Launch gates

Hive cannot be marketed as available until:

- AGPL boundary receives legal approval;
- private service has independent source/dependency provenance;
- server-side entitlement bypass testing passes;
- device proof is cryptographically verified;
- every mutation path is guarded in active rooms;
- integration queue is single-writer per target ref;
- revocation works within the documented maximum delay;
- no normal-user background room/presence connection is observed;
- data classification and retention are documented;
- account/org export and deletion responsibilities are defined;
- staged rollout and global kill switch are exercised;
- audit events identify user, device, agent, task, scope, revision, and outcome;
- Desktop, interactive CLI, and headless CLI staging paths are exercised;
- recovery from coordinator, database, and client disconnects is tested.

## 15. Licensing note

Aurict is currently AGPL-3.0-only. GNU’s AGPL section 13 covers modified
network-interactive versions, and GNU’s license FAQ explains that whether two
components are separate works depends on both communication mechanism and
communication semantics. This plan therefore uses a separate service, separate
repository, separate deployment, no shared runtime/library code, and a
documented network protocol.

This is an engineering boundary, not a legal conclusion. Counsel must approve
the final source, build, distribution, SDK, and hosted-service arrangement
before proprietary implementation is shipped.

Primary references:

- https://www.gnu.org/licenses/agpl-3.0.en.html
- https://www.gnu.org/licenses/gpl-faq.en.html
