# CLAUDE.md

Rules for all sessions on reprise.

- Read SCOPE.md before any task. If a request is outside v0.1 scope, say so and stop.
- TypeScript strict. No `any`.
- The Anthropic API key never appears in frontend code. Claude API calls only happen in server functions under /api.
- Ask before adding any new dependency and explain why it's needed.
- When there's a judgment call, explain the options instead of silently picking one.
- Commit messages use Conventional Commits.
- Read-only git commands (status, diff, log) are fine. Never run git
  commands that change state (add, commit, mv, switch, push).
