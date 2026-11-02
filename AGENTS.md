# AGENTS.md

Guidance for AI coding agents and developers working in this repository.

## Project

HobbyHut: an Ionic + Angular mobile app (iOS via Capacitor) for finding people to play hobbies and sports with, including chat, hobby rooms, game requests and posts. The backend is Firebase (Auth, Firestore, Storage, Cloud Messaging) plus one Cloud Function.

| | Version |
|---|---|
| Angular | ~13.4 |
| Ionic Angular | ^6.7 |
| Capacitor (core, iOS) | ^6.0 |
| @angular/fire | ^7.6, mostly the `compat` APIs |
| firebase JS SDK | ^9.23 |
| TypeScript / RxJS | ^4.5 / ~6.6 |
| Node | Builds work on Node 22 (`.nvmrc` still says 12, which is outdated; Capacitor 6 needs Node 18+) |

Firebase project: `hobby-hut-dev` (`.firebaserc`, `src/environments/`). It's the only project; there is no separate production.

## Commands

```bash
npm install
npm start               # ng serve, dev server on http://localhost:4200
npx ng build            # web build into www/ (does NOT trigger iOS sync)
npm run build           # ng build, then postbuild runs `cap sync ios`
npm run open:ios        # open the Xcode project
cd functions && firebase deploy --only functions
```

- `npm test`: **broken**. `angular.json` points to `karma.conf.js`, which doesn't exist.
- `npm run lint`: **broken**. It uses the `tslint` builder, which no longer exists in this Angular version.
- `.github/workflows/`: legacy TestFlight pipeline; triggers on `master` and uses Node 12. Update it before relying on it.

Verify changes with `npx ng build` (should finish with no errors; the existing "environment.prod.ts is unused" warning is known).

## Layout

```
src/app/
  core/core.facade.ts   central service (~2,000 lines): Firestore/Auth calls and app state; injected almost everywhere
  core/core.model.ts    shared interfaces
  <page>/               lazy-loaded Ionic pages: home, home-main, hobby-room, chat, post-chat, messages,
                        profile, settings, sign-in, tabs (routing in app-routing.module.ts / tabs-routing.module.ts)
  shared/               reusable components, declared in shared.module.ts (timer, create-post, filters, ...)
  *.service.ts          auth, message, linkedin, alert, strings services
src/environments/       Firebase web config (public identifiers, not secrets)
functions/              Cloud Functions (Node 18 runtime): sendNotification (FCM via firebase-admin)
ios/App/                Capacitor iOS project (GoogleService-Info.plist lives here)
resources/, scripts/    icon/splash sources and the copy script
docs/security/          incident report and cleanup changelog: read before touching config, scripts or assets
```

## Conventions

- Prettier: single quotes, 100-column lines (`.prettierrc.json`).
- Keep Firestore access in `CoreFacade` or the existing services rather than calling Firebase directly from components.
- Pages are lazy-loaded modules; shared UI goes in `shared/` and is registered in `shared.module.ts`.
- Use the existing `@angular/fire/compat` APIs unless you are deliberately migrating a feature.
- The repo uses CRLF line endings. Don't reformat or re-save files wholesale; diffs should contain only real changes.

## Security rules (mandatory)

This repository was previously compromised through forged commits that planted malware. See [docs/security/incident-report-2026-11.md](docs/security/incident-report-2026-11.md). Treat the following as hard rules:

- **No auto-running code.** Never add `.vscode/tasks.json` (especially `runOn: folderOpen`), `.vscode/settings.json` that enables automatic tasks, git hooks, or npm lifecycle scripts (`preinstall`, `postinstall`, `prepare`, …) without explicit approval. `/.vscode` is git-ignored on purpose.
- **npm scripts stay plain.** `start` / `build` must not run extra scripts (`node init`, `node api.js`, …).
- **No executable code in assets.** Fonts, images and other files under `src/assets/`, `ios/` and `resources/` must be what their extension says. Never add files to `AppIcon.appiconset` other than icons.
- **No dynamic code execution.** No `eval`, `new Function`, `child_process` in app code, or fetching code at runtime.
- **No secrets in git.** `.env*`, `*.p8` and `service-account*.json` are ignored. Cloud Functions use default credentials (`admin.initializeApp()`); don't reintroduce key files.
- **Known weaknesses, don't spread them:** the LinkedIn OAuth client secret is embedded in `linkedin.service.ts` / `core.facade.ts` (to be moved server-side), and `sendNotification` is unauthenticated (to be fixed).
- **Review red flags:** large whitespace-only diffs, very long lines or lines padded with spaces, unexpected new dependencies, and edits to `.gitignore`.
