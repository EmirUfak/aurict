# Security and Compliance

Aurict is security-conscious, but it should not be described as formally certified or independently audited unless that changes.

## Current safeguards

- Provider keys, local environment files, Firebase service files, Android keystores, and key properties are excluded from source control.
- CLI tool execution uses typed tools, permission gates, protected paths, output limits, timeouts, checkpoints, and audit-oriented behavior.
- Shell execution is classified before running.
- File tools enforce workspace containment and reject symlink escapes; shell file readers require explicit approval.
- Generic HTTP tools block local/private targets, revalidate redirects, bound response size, and require confirmation for mutating or authenticated requests.
- MCP child processes receive a minimal environment plus only explicitly configured variables, rather than inheriting all provider credentials.
- Runtime permissions, provider credentials, tool caches, snapshots, compaction breakers, and agent routing are scoped by session/workspace where applicable.
- Android release builds restore signing and Firebase config from CI secrets.
- Web and mobile surfaces include privacy, terms, and account deletion paths.
- Mobile report feedback is scoped to explicit user reports.

## Important limits

- The policy sandbox is not container isolation.
- The backend prototype is local/private and not committed.
- Aurict is not currently SOC 2, ISO 27001, HIPAA, GDPR-certified, or independently penetration-tested.
- Future analytics, telemetry, sync, or hosted console features must update privacy documentation before release.

## Data handling principles

| Data | Principle |
|---|---|
| Provider API keys | Keep local or user-controlled unless an explicit future hosted feature changes the model. |
| Project files | Treat as local working data unless the user explicitly sends feedback or uses a remote workflow. |
| Feedback reports | Store only scoped report context needed for review. Redact and delete where appropriate. |
| Account data | Support deletion and keep legal pages aligned with actual collection. |

## Recommended next controls

1. Publish a vulnerability disclosure policy.
2. Add a security contact.
3. Build a feedback review console with redaction, status, export, and deletion controls.
4. Define retention periods for feedback, account, and log data.
5. Threat-model browser login, remote approval, account deletion, and future console actions.
