import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { API_BASE } from "./const.js";
import { questionHidden, c } from "./ui.js";
import { DRY } from "./flags.js";

export async function resolveKey(): Promise<string> {
  const env = process.env.BLUEJAY_API_KEY;
  if (env) return env;
  if (DRY) return "bj_dryrun_placeholder";
  if (!process.stdin.isTTY) {
    throw new Error(
      "No BLUEJAY_API_KEY set and no terminal to prompt.\n" +
        "  Re-run with:  BLUEJAY_API_KEY=your_key npx github:bluejay-ai-dev/bluejay-cli",
    );
  }
  process.stdout.write(`  Get a key at ${c.b}https://app.getbluejay.ai/settings/api-keys${c.x}\n`);
  const key = (await questionHidden("  Paste your Bluejay API key: ")).trim();
  if (!key) throw new Error("No key entered.");
  process.env.BLUEJAY_API_KEY = key;
  return key;
}

// returns a human note; throws on hard rejection
export async function verifyKey(key: string): Promise<string> {
  if (DRY) return "skipped (dry-run)";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/all-agents`, { headers: { "X-API-Key": key } });
  } catch {
    return "offline — continuing";
  }
  switch (res.status) {
    case 200:
    case 201:
    case 204:
      return "verified";
    case 401:
      throw new Error("Key rejected (401). Check the key and retry.");
    case 403:
      throw new Error("Key valid but has no organization (403). Finish setup in the dashboard.");
    default:
      return `status ${res.status} — continuing`;
  }
}

export function persistKey(key: string): string {
  const shell = path.basename(process.env.SHELL || "sh");
  const rc =
    shell === "zsh"
      ? path.join(os.homedir(), ".zshrc")
      : shell === "bash"
        ? path.join(os.homedir(), ".bashrc")
        : path.join(os.homedir(), ".profile");
  if (DRY) return `would add to ${tilde(rc)}`;
  if (fs.existsSync(rc) && fs.readFileSync(rc, "utf8").includes("BLUEJAY_API_KEY")) {
    return `already in ${tilde(rc)}`;
  }
  const esc = key.replace(/'/g, "'\\''");
  fs.appendFileSync(rc, `\n# Bluejay\nexport BLUEJAY_API_KEY='${esc}'\n`);
  return `added to ${tilde(rc)}`;
}

const tilde = (p: string) => p.replace(os.homedir(), "~");
