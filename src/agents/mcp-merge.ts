import fs from "node:fs";
import path from "node:path";
import { run } from "../exec.js";
import { DRY } from "../flags.js";

// Deep-merge a `bluejay` server into a JSON MCP config, preserving existing servers.
// Backs up an unparseable file to <file>.bluejay.bak, matching install.sh.
export function mergeJson(configPath: string, server: Record<string, unknown>) {
  if (DRY) return;
  const p = expand(configPath);
  let data: any = {};
  if (fs.existsSync(p) && fs.statSync(p).size > 0) {
    try {
      data = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      const bak = `${p}.bluejay.bak`;
      fs.renameSync(p, bak);
      data = {};
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) data = {};
  if (typeof data.mcpServers !== "object" || data.mcpServers === null) data.mcpServers = {};
  data.mcpServers.bluejay = server;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// Codex CLI TOML: strip any existing [mcp_servers.bluejay] block, append a fresh one.
export function wireCodexToml(configPath: string, url: string, key: string, needRmcp: boolean) {
  if (DRY) return;
  const p = expand(configPath);
  const escKey = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const out: string[] = [];
  let skip = false;
  for (const ln of text.split("\n")) {
    const s = ln.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      skip = s === "[mcp_servers.bluejay]" || s.startsWith("[mcp_servers.bluejay.");
    }
    if (!skip) out.push(ln);
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  if (needRmcp && !out.join("\n").includes("experimental_use_rmcp_client")) {
    const i = out.indexOf("[features]");
    if (i >= 0) out.splice(i + 1, 0, "experimental_use_rmcp_client = true");
    else out.unshift("[features]", "experimental_use_rmcp_client = true", "");
  }
  out.push("", "[mcp_servers.bluejay]", `url = "${url}"`, `http_headers = { "X-API-Key" = "${escKey}" }`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, out.join("\n").replace(/^\n+/, "") + "\n");
}

// Codex < 0.45 needs the experimental rmcp client for streamable-HTTP.
export async function codexNeedsRmcp(): Promise<boolean> {
  if (DRY) return false;
  const r = await run("codex", ["--version"]);
  const m = r.stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major === 0 && minor < 45;
}

function expand(p: string): string {
  return p.startsWith("~") ? path.join(process.env.HOME || "", p.slice(1)) : p;
}
