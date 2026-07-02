# Aurict Mobile

Flutter frontend for Aurict's mobile AI workspace and desktop CLI remote control experience. Built for iOS and Android.

## Current Scope

- Premium mock UI for Chat, Remote, Documents, API Keys, and Settings.
- Web-aligned default Aurict theme with Source Serif 4 and IBM Plex Mono bundled in the app.
- 5 built-in visual themes: Aurict, Graphite Blue, Obsidian Mono, Warm Slate, Violet Arc.
- Glassmorphism app shell with side rail and floating Chat/Remote switcher.
- Onboarding flow for welcome, security posture, and first setup.
- Remote control states for desktop discovery, trust flow, live session timeline, tool approvals, diffs, and tests.
- Trusted device bottom sheet for session trust decisions.
- API key/model management UI with local-first security messaging.
- Secure API key bottom sheet mock for provider setup.
- Firebase-backed Google/GitHub account sign-in wired to Aurict backend `/auth/firebase`.
- Account tokens stored in device secure storage.

Remote control is still UI-only, but account sign-in is wired through Firebase Auth and Aurict backend token exchange.

## Firebase Auth

Project id: `aurict-backend`.

Required native config files:

- Android: `android/app/google-services.json`
- iOS: `ios/Runner/GoogleService-Info.plist`

Configured providers:

- Google
- GitHub

Auth flow:

1. Mobile signs in with Firebase Auth.
2. Mobile obtains a Firebase ID token.
3. Mobile posts the token to `POST /auth/firebase`.
4. Backend returns Aurict access/refresh tokens.
5. Tokens are stored with `flutter_secure_storage`.

Default backend URL is `https://api.aurict.com`. Override for staging/local runs:

```sh
flutter run --dart-define=AURICT_API_BASE_URL=https://staging-api.aurict.com
```

## Run

```sh
flutter run
```

Run on a specific platform/device:

```sh
flutter run -d ios
flutter run -d android
```

## Verify

```sh
flutter analyze
flutter test
flutter build apk --debug
```
