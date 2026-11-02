# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Follow the **Security rules** in AGENTS.md strictly. If a task seems to need any of the prohibited items (auto-run tasks, lifecycle scripts, dynamic code execution, committed secrets), stop and ask first.
- Never run `node`, `npm run`, or open files from a repository or branch you have not reviewed. Inspect suspicious files as text only.
- Verify changes with `npx ng build`. Don't use `npm run build` unless an iOS sync is wanted, because it triggers `cap sync ios`.
- Don't commit or push unless asked. Don't force-push.
- Preserve CRLF line endings when editing. If a shell tool rewrites line endings, restore them so diffs stay minimal.
