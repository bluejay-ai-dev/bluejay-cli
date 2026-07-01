import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { have, run } from "../exec.js";
import { MCP_URL, SKILLS_DIR } from "../const.js";
import { mergeJson, wireCodexToml, codexNeedsRmcp } from "./mcp-merge.js";
import { DRY } from "../flags.js";

export type LaunchType = "cli" | "gui";

export interface WireResult {
  ok: boolean;
  note: string;
}

export interface Agent {
  id: string;
  label: string;
  launchType: LaunchType;
  detect(): boolean;
  wire(key: string): Promise<WireResult>;
  // cli: argv to spawn with the onboarding prompt; gui: how to open the app
  cliCmd?: (prompt: string) => [string, string[]];
  guiOpen?: () => [string, string[]];
}

const home = os.homedir();
const dir = (...p: string[]) => path.join(home, ...p);
const exists = (...p: string[]) => fs.existsSync(dir(...p));
const headers = (key: string) => ({ "X-API-Key": key });

// Portable onboarding prompt fed to non-Claude CLI agents.
export const ONBOARD_PROMPT =
  "Read ~/.bluejay/skills/onboard.skill.txt and follow it step by step to create and run my " +
  "first Bluejay simulation over the bluejay MCP server. Start now.";

// Declared in PRIORITY ORDER. The picker numbers installed agents densely (1..N).
export const AGENTS: Agent[] = [
  {
    id: "claude",
    label: "Claude Code",
    launchType: "cli",
    detect: () => have("claude"),
    async wire() {
      if (DRY) return { ok: true, note: "would install plugin + wire MCP" };
      const add = await run("claude", ["plugin", "marketplace", "add", "bluejay-ai-dev/bluejay-skills"]);
      if (add.code !== 0) return { ok: false, note: "run: claude plugin marketplace add bluejay-ai-dev/bluejay-skills" };
      const inst = await run("claude", ["plugin", "install", "bluejay@bluejay-skills"]);
      return inst.code === 0
        ? { ok: true, note: "plugin + MCP wired" }
        : { ok: false, note: "run: claude plugin install bluejay@bluejay-skills" };
    },
    cliCmd: () => ["claude", ["/bluejay:onboard"]],
  },
  {
    id: "codex",
    label: "Codex",
    launchType: "cli",
    detect: () => exists(".codex") || have("codex"),
    async wire(key) {
      const needRmcp = await codexNeedsRmcp();
      wireCodexToml(dir(".codex", "config.toml"), MCP_URL, key, needRmcp);
      writeAgentsMd();
      return { ok: true, note: "~/.codex/config.toml" };
    },
    cliCmd: (prompt) => ["codex", [prompt]],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    launchType: "cli",
    detect: () => exists(".gemini") || have("gemini"),
    async wire(key) {
      mergeJson(dir(".gemini", "settings.json"), { httpUrl: MCP_URL, headers: headers(key) });
      writeAgentsMd();
      return { ok: true, note: "~/.gemini/settings.json" };
    },
    cliCmd: (prompt) => ["gemini", ["-i", prompt]],
  },
  {
    id: "cursor",
    label: "Cursor",
    launchType: "gui",
    detect: () => exists(".cursor") || have("cursor"),
    async wire(key) {
      mergeJson(dir(".cursor", "mcp.json"), { url: MCP_URL, headers: headers(key) });
      writeAgentsMd();
      return { ok: true, note: "~/.cursor/mcp.json" };
    },
    guiOpen: () => (have("cursor") ? ["cursor", ["."]] : openApp("Cursor")),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    launchType: "gui",
    detect: () => exists(".codeium", "windsurf"),
    async wire(key) {
      mergeJson(dir(".codeium", "windsurf", "mcp_config.json"), { serverUrl: MCP_URL, headers: headers(key) });
      writeAgentsMd();
      return { ok: true, note: "~/.codeium/windsurf/mcp_config.json" };
    },
    guiOpen: () => (have("windsurf") ? ["windsurf", ["."]] : openApp("Windsurf")),
  },
  {
    id: "antigravity",
    label: "Antigravity",
    launchType: "gui",
    detect: () => exists(".gemini", "antigravity"),
    async wire(key) {
      mergeJson(dir(".gemini", "antigravity", "mcp_config.json"), { serverUrl: MCP_URL, headers: headers(key) });
      writeAgentsMd();
      return { ok: true, note: "~/.gemini/antigravity/mcp_config.json" };
    },
    guiOpen: () => openApp("Antigravity"),
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    launchType: "gui",
    detect: () => fs.existsSync(claudeDesktopCfg()),
    async wire(key) {
      mergeJson(claudeDesktopCfg(), { type: "http", url: MCP_URL, headers: headers(key) });
      return { ok: true, note: "restart Claude Desktop to load" };
    },
    guiOpen: () => openApp("Claude"),
  },
];

export function detectInstalled(): Agent[] {
  return AGENTS.filter((a) => {
    try {
      return a.detect();
    } catch {
      return false;
    }
  });
}

function claudeDesktopCfg(): string {
  if (process.platform === "darwin")
    return dir("Library", "Application Support", "Claude", "claude_desktop_config.json");
  if (process.platform === "linux") return dir(".config", "Claude", "claude_desktop_config.json");
  return dir("AppData", "Roaming", "Claude", "claude_desktop_config.json");
}

function openApp(name: string): [string, string[]] {
  if (process.platform === "darwin") return ["open", ["-a", name]];
  if (process.platform === "win32") return ["cmd", ["/c", "start", "", name]];
  return ["xdg-open", [name.toLowerCase()]];
}

// AGENTS.md points file-based agents (Codex et al.) at the skills. Idempotent.
function writeAgentsMd() {
  if (DRY) return;
  const target = path.join(process.cwd(), "AGENTS.md");
  const marker = "<!-- bluejay-skills -->";
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8").includes(marker)) return;
  const block =
    `\n${marker}\n## Bluejay\n` +
    `This project uses Bluejay (voice/chat agent testing & monitoring).\n` +
    `- MCP server \`bluejay\` is configured — use its tools to manage agents, simulations, digital humans, and metrics.\n` +
    `- Onboarding: read \`${SKILLS_DIR}/onboard.skill.txt\` to create your first simulation.\n` +
    `- Python SDK: \`from bluejay import Bluejay\` (auth via BLUEJAY_API_KEY) — requires writing code.\n` +
    `<!-- /bluejay-skills -->\n`;
  fs.appendFileSync(target, block);
}
