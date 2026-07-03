# Aurict Mobile App

The mobile app brings Aurict's BYOK model to a personal assistant surface. It should not be positioned as a toy chat app; it is a controlled companion for chat, research, document work, and PDF generation.

## Current capabilities

- BYOK provider sessions.
- Chat with streaming assistant answers.
- Research and document-oriented tool flows when intent requires them.
- PDF/document generation and reading workflows.
- Privacy, terms, and account deletion surfaces aligned with the web product.
- Assistant-answer reporting to a backend feedback route.
- Android release builds signed in CI with non-committed keystore and Firebase config.

## Intelligence model

The mobile runtime uses intent-based tool exposure. Normal conversation should not automatically expose heavy tools. Research, document, or PDF tools become available when the user's request needs them.

The system prompt should keep these rules visible:

- Be objective and honest.
- Do not invent facts.
- Research when the answer depends on current or external information.
- Separate evidence from inference.
- Keep the user in control of provider keys and sensitive actions.

## Feedback reporting

Users can report assistant answers. A report is a scoped feedback event intended for review and quality improvement. It is not a general project upload mechanism.

Recommended backend handling:

- Store the reported message, selected reason, optional user note, app version, platform, and authenticated user id when available.
- Redact secrets before display in any future review console.
- Add retention and deletion rules before public scale.

## Android release path

Release APKs are produced by the `mobile-release.yml` workflow. Signing files, key properties, and `google-services.json` are restored from GitHub Actions secrets and are not committed.

The release build uses R8/ProGuard and packaging exclusions to reduce artifact size and harden the APK. This is release hardening, not a substitute for a security audit.
