# Cleanup changelog: post-incident repository cleanup

Every change made to the codebase after the November 2026 incident. For background, see [incident-report-2026-11.md](incident-report-2026-11.md).

This repository starts from a single clean commit. The old history is intentionally not carried over, because it contains the malware and committed secrets.

## 1. Malware removal

| Change | Detail |
|---|---|
| Deleted `init`, `functions/init`, `functionsold/init` | Obfuscated payload hidden after whitespace padding |
| Deleted `ios/App/App/Assets.xcassets/AppIcon.appiconset/public/` | Folder planted by a forged commit: payloads disguised as fonts (`fa-brand-400.orc`, `fa-solid-400.woff2`) plus FontAwesome files and a README as cover |
| Deleted `.vscode/tasks.json` | Auto-run trigger (`runOn: folderOpen`) |
| Deleted `.vscode/settings.json` | Enabled automatic tasks and hid the terminal |
| Deleted `.env` | Held the base64-encoded payload URL (`AUTH_API_KEY`) |
| `src/main.ts` | Removed the `dotenv` / `node-fetch` / `eval` loader; restored the standard Angular bootstrap |
| `package.json` | `start`: `ng serve`, `build`: `ng build` (removed `node init &&`); removed the `dotenv` and `node-fetch` dependencies |
| `package-lock.json` | Removed the matching root dependency entries |
| `functions/package.json` | `start`: `npm run shell` (removed `node init &&`) |
| `.gitignore` | Re-added `/.vscode` (the attacker had removed it); added `.env` and `.env.*`; removed the injected `config.bat` rule |

`fa-solid-900.eot` in the same folder had briefly been replaced with a JavaScript payload and later restored to the genuine font; it went with the folder.

## 2. Unused files removed

Each was checked for references across the source, build configuration and native projects. The production build's JavaScript bundle hash was identical before and after these removals.

| Removed | Reason |
|---|---|
| `functions.zip` (20 MB) | Old backup of `functions/` including `node_modules` and a copy of the service-account private key |
| `functionsold/` | Superseded Cloud Functions; `firebase.json` deploys only `functions/` |
| `removed.txt`, `hobbiesdata.json` | Not referenced anywhere |
| `GoogleService-Info.plist` (root), `resources/ios/GoogleService-Info.plist`, `resources/GoogleService-Info123.plist` | Duplicates; Xcode uses `ios/App/GoogleService-Info.plist` (and the copy in `ios/App/App/`) |
| `src/assets/fonts/` (18 Nanami `.otf` files) | Never loaded: the `--ion-font-family-nanami-*` CSS variables they were meant for are not defined anywhere |
| 19 images and icons in `src/assets/` | Not referenced by any template, style or script (no dynamically built asset paths exist) |

Kept on purpose: `Makefile` (fastlane and TestFlight helpers), `e2e/`, `tslint.json` and `typings/` (referenced by `angular.json` / `package.json`), the root `config.xml`, `scripts/resources.js` and `resources/` (icon and splash generation).

## 3. Secrets

| Item | Action |
|---|---|
| `functions/service-account.json` (`firebase-adminsdk-drm7d@hobby-hut-dev.iam.gserviceaccount.com`, key `327f54cc…`) | Untracked and ignored. The service account was deleted in Google Cloud, so the leaked key no longer works. |
| `AuthKey_UD9W2F2TAC.p8` (Apple push key) | Untracked and ignored. **Still needs to be revoked and replaced.** |
| `.gitignore` | Added `*.p8` and `service-account*.json` |

## 4. Cloud Functions credentials

`functions/index.js` no longer loads a key file:

```js
// before
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// after
admin.initializeApp();
```

Inside Cloud Functions, `initializeApp()` with no arguments uses the runtime's built-in service identity, which is enough for `admin.messaging().send()`. There is no key file left to leak.

**Known issue, not yet fixed:** `sendNotification` is an unauthenticated HTTP endpoint. Anyone with its URL can send a notification to any device token. Add authentication (for example, verify a Firebase Auth ID token) before shipping.

## 5. Verification performed

- A pattern scan of every tracked file found no `eval(`, `new Function(`, `child_process`, `parseInt(0x`, `_0x…` identifiers, `global['…']` markers, the C2 IP, the wallet, `folderOpen` or `node init`.
- No whitespace-padded hidden code (no lines with 150+ consecutive spaces before content).
- No script content inside font, image or SVG files (checked magic bytes and contents).
- No npm lifecycle hooks other than `postbuild` (`npm run sync:ios`).
- `ng build` succeeds.

## 6. Developer setup notes

- Add `"task.allowAutomaticTasks": "off"` to your **user** VS Code settings.
- Never commit `.env`, `*.p8` or service-account JSON files. Share them through a password manager or secret store.
- Treat changes to `.vscode/`, `package.json` scripts, or new files in asset folders as security-relevant in code review.
