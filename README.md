# bluejay

One command to wire Bluejay into your AI coding tools and run your first simulation.

```
npx bluejay
```

Or non-interactively:

```
BLUEJAY_API_KEY=bj_xxx npx bluejay
```

Dry run — see the full flow (detection, bars, picker) without installing, wiring, or launching anything:

```
npx bluejay --dry-run        # also: --dry, -n, or BLUEJAY_DRY_RUN=1
```

## What it does

1. **Authenticate** — reads `BLUEJAY_API_KEY` (or prompts), verifies it, persists it to your shell rc.
2. **Python SDK** — installs `bluejay-sdk` (uv or pip). Using the SDK requires writing code; MCP + skills don't.
3. **Skills** — clones the Bluejay skills into `~/.bluejay/skills`.
4. **Wire agents** — auto-adds the Bluejay MCP server + skills to every AI coding tool it detects
   (Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Antigravity, Claude Desktop).

Then it clears the screen and lets you pick one of your installed agents to run guided onboarding:
connect your agent → build a simulation with digital humans matching your use case → run it →
open the live run.

## Requirements

- Node ≥ 18
- A Bluejay account + API key — https://app.getbluejay.ai/settings/api-keys

## Develop

```
npm install
npm run dev      # run from source (node --experimental-strip-types)
npm run build    # bundle to dist/cli.js
node dist/cli.js
```
