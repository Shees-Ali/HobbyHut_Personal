# Security incident report: malicious commits in the project repository

| | |
|---|---|
| **Discovered** | 2026-11-02 |
| **Status** | Contained. Code cleaned; repository re-created with fresh history; credentials rotated or pending (see checklist). |
| **Affected** | The previous repositories (client repo and personal mirror) and the machines of developers who opened them |
| **Related** | [cleanup-changelog.md](cleanup-changelog.md) |

## Summary

An attacker with write access to the project's GitHub repository force-pushed forged commits between April and October 2026. The commits carried the names, messages and author timestamps of real developer commits, but added malware: an obfuscated Node.js loader that runs when the project folder is opened in VS Code or when `npm start` / `npm run build` is run. The loader looks up its server address on the Ethereum blockchain, downloads further JavaScript from that server and runs it in a hidden background process.

The intrusion was noticed because the injected code in `src/main.ts` broke the Angular build. That code had been removed twice by developers and re-added each time by new forged commits.

## How it got in

- GitHub's repository Activity page shows the force-pushes were made by the account **`freelancework00700`**. Its email matches a former contributor to the project whose write access had not been removed. It is unknown whether the account was hijacked or misused.
- The forged commits were near-copies of real commits (same message, same author timestamp, same code changes) with malware added. They were identifiable by:
  - committer time zones that don't match the developer's (`+0200`, `+0100`, `-0600`, `+0000` instead of `+0500`)
  - commit hashes that differ from the developer's own local reflog
  - whole older branches rewritten with a single committer timestamp (`2026-09-13 05:30 +0200`)
  - large line-ending-only diffs (~200 files) hiding a handful of real edits

## What was planted

| File(s) | Purpose |
|---|---|
| `.vscode/tasks.json` | Hidden task (`label: eslint-check`, `runOn: folderOpen`) that runs `node <payload>` whenever the folder is opened in a trusted VS Code workspace |
| `.vscode/settings.json` | `task.allowAutomaticTasks: true`; hides the terminal and debug panel |
| `.gitignore` | The `/.vscode` rule was removed so the above could be committed; a `config.bat` rule was added |
| `ios/.../AppIcon.appiconset/public/fonts/` | Payloads disguised as fonts: `fa-solid-900.eot` (39 KB JS variant), `fa-brand-400.woff`, `fa-brand-400.orc`, `fa-solid-400.woff2`, plus real FontAwesome files and a README as cover |
| `init`, `functions/init`, `functionsold/init` | The same payload hidden after hundreds of spaces at the end of a harmless-looking script |
| `package.json` (root, `functions/`, `functionsold/`) | `start` / `build` changed to `node init && …` (earlier: `node api.js && …`) |
| `src/main.ts`, `.env` | A `fetch` + `eval` loader whose URL is base64-encoded in `.env` as `AUTH_API_KEY`; added `dotenv` and `node-fetch` dependencies |
| `api.js` (×3) | Earlier stage of the attack; later deleted by the attacker |

## What the payload does

The payload was decoded statically (it was never executed). It has three layers of obfuscation: single-byte XOR on hex strings, a keyed character shuffle, and a dictionary compressor. All copies decode to the same 15 KB Node.js script, which:

1. Queries public Ethereum RPC endpoints for the latest transaction sent by wallet `0x1eEf0849EDa15d87f64e51C73C8442Cf3c8bCEF3`. The first 8 bytes of that transaction's `to` address encode two IPv4 addresses. The attacker sends a 0-ETH transaction about every 1,000 blocks to keep this current.
2. Downloads XOR-encrypted JavaScript from `http://<ip>:443/0x/cls` and `/0x/ls`.
3. Runs it via `eval` and in a detached, hidden `node -i` process that survives VS Code being closed.

The downloaded stage was not retrieved: the server was unreachable by the time it was tried. Its exact capabilities are unknown; malware delivered this way typically steals browser credentials and cookies, crypto wallets, SSH keys and `.env` files.

## Indicators of compromise

```
GitHub account:  freelancework00700 (force-pushes to all branches)
Ethereum wallet: 0x1eEf0849EDa15d87f64e51C73C8442Cf3c8bCEF3
C2 IP:           95.135.181.151  (10/92 VirusTotal detections; /24 leased 2026-07-17 via IPXO)
Stage URLs:      http://95.135.181.151:443/0x/cls  /0x/ls   (header "Sec-V: A9")
Defender name:   Trojan:Script/MalTask.A  (on .vscode/tasks.json)

SHA-256
e20dc2838008cbcc0205d5a992cb3eb11a705d90fcd95582618c91c224b72549  fa-brand-400.orc
357405970184a139a95a0ff43d2661eadb305a26b9a2271cffc4a33e6ed6932d  init
2aeaebc46145b30d0daaa97ee9dc2d1237274b748535056a7614a1c6e551d4e8  .vscode/tasks.json
9cfb77416a547ade1146d2cf81c413088829ec515b9e0d8e1ed8c34602deafbe  fa-solid-900.eot (JS variant)
839747f862919a4472de820fb591085c4093935b38e1038085f7431f9f2c83f4  fa-brand-400.woff (JS variant)
204f8bdc619e3cca8bd584708f476e59d245eb3ef474c5bba34e8e42f7176c04  fa-solid-400.woff2 (JS variant)
```

## Timeline (2026)

| Date | Event |
|---|---|
| Apr 22 | First forged commit adds the `main.ts` / `.env` loader; the build starts failing |
| May 4 | Developer removes the loader |
| May 10 | Forged commit re-adds it |
| Sep 13 | Older branches rewritten and force-pushed |
| Sep 17 | Forged commit adds `.vscode/tasks.json`, `settings.json` and the first font-disguised payload |
| Oct 14 | Developer removes the loader again; a forged twin of that commit swaps the payload to `fa-brand-400.woff`. **From here the folder-open trigger points at a working payload.** |
| Oct 26–30 | Force-push to `master`: `.orc` payload, `init` hooked into npm scripts in three packages, loader back in `main.ts` |
| Nov 2 | Developer pulls, the build fails, investigation starts. Defender quarantines `tasks.json` at 22:20 |
| Nov 2–3 | Payload decoded, repository cleaned, server reported to its abuse contact, repository re-created with fresh history |

## Exposure assessment (one developer machine)

- **No running malware, persistence or outbound connections to the C2** were found.
- **Defender blocked** the folder-open attempt on Nov 2.
- **Browser password stores** (Chrome, Edge, Brave) were not read around any project open that VS Code's logs cover.
- **Oct 14–28 can't be assessed:** VS Code's logs had rotated, so credential rotation is treated as required.
- **Anyone else who opened the old repository in VS Code after Sep 17**, or ran its npm scripts after Oct 26, should check their machine and rotate their credentials.

## Remediation checklist

- [x] Malicious files removed and npm scripts restored ([changelog](cleanup-changelog.md))
- [x] Repository re-created with a single clean commit (old history contains the malware and secrets)
- [x] Firebase Admin service account `firebase-adminsdk-drm7d@hobby-hut-dev.iam.gserviceaccount.com` deleted; Cloud Functions switched to default credentials
- [x] C2 reported to the IP block's abuse contact
- [ ] Revoke and replace the Apple push key `AuthKey_UD9W2F2TAC.p8` and upload the new key to Firebase Cloud Messaging
- [ ] Regenerate the LinkedIn OAuth client secret (it is also embedded in client code; move the token exchange server-side)
- [ ] Remove `freelancework00700` and any unused collaborators from all repositories
- [ ] Enable branch protection on the new repository (no force-pushes, required reviews)
- [ ] Revoke developers' GitHub tokens and SSH keys, and sign out other sessions
- [ ] Set `"task.allowAutomaticTasks": "off"` in every developer's **user** VS Code settings
- [ ] Retire the old repositories (the client decides for the client-owned one)

## Prevention

- Remove contributor access as soon as an engagement ends.
- Protect default branches: no force-pushes, pull requests required, signed commits preferred.
- Keep secrets out of git. `.gitignore` now covers `.env`, `*.p8` and `service-account*.json`.
- Review `.vscode/`, `package.json` scripts and anything new in asset folders during code review.
- If a "fixed" bug keeps coming back, check who is reintroducing it.
