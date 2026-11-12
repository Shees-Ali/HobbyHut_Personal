# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Follow the **Security rules** in AGENTS.md strictly. If a task seems to need any of the prohibited items (auto-run tasks, lifecycle scripts, dynamic code execution, committed secrets), stop and ask first.
- Never run `node`, `npm run`, or open files from a repository or branch you have not reviewed. Inspect suspicious files as text only.
- Verify changes with `npx ng build`. Don't use `npm run build` unless an iOS sync is wanted, because it triggers `cap sync ios`.
- **Never commit or push yourself**, even if a change looks finished. The user commits. Don't force-push.
- **After every change: test it, report the results to the user, then stop and wait for their confirmation** before moving on to further changes.
- Preserve CRLF line endings when editing. If a shell tool rewrites line endings, restore them so diffs stay minimal.
