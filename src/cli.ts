#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolveKey, verifyKey, persistKey } from "./auth.js";
import { installSdk } from "./sdk.js";
import { downloadSkills } from "./skills.js";
import { detectInstalled, ONBOARD_PROMPT, type Agent } from "./agents/registry.js";
import { APP_URL, DOCS_URL, SDK_PKG } from "./const.js";
import { banner, sec, ok, warn, err, dim, clear, box, Board, selectList, c, isTTY } from "./ui.js";
import { DRY } from "./flags.js";

// dry-run only: animate a task's bar filling over `ms` so the install looks real.
async function fill(board: Board, i: number, ms: number) {
  const steps = Math.max(12, Math.round(ms / 120));
  for (let s = 1; s <= steps; s++) {
    board.progress(i, s / steps);
    await sleep(ms / steps);
  }
}

// random duration in [lo, hi] so concurrent dry-run tasks finish at different times.
const dryMs = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo));

async function main() {
  banner();
  if (DRY) dim(`${c.y}DRY RUN${c.x}${c.d} — detecting for real, but nothing is installed, wired, or launched.`);

  const installed = detectInstalled();

  // ---- 1. authenticate (interactive prompt happens before the animated board) ----
  sec("1 · Authenticate");
  let key: string;
  try {
    key = await resolveKey();
  } catch (e) {
    err((e as Error).message);
    process.exit(1);
  }

  // ---- 2. install screen: animated ASCII bars ----
  const wireLabel = `Wire agents (${installed.length})`;
  const board = new Board(["Authenticate", "Python SDK", "Skills", wireLabel]);
  board.run();

  // Authenticate is a gate: verify the key before wiring anything with it.
  board.start(0, "verifying…");
  try {
    const note = await verifyKey(key);
    const p = persistKey(key);
    if (DRY) await fill(board, 0, 1200);
    board.finish(0, "done", `${note} · ${p}`);
  } catch (e) {
    board.finish(0, "fail", (e as Error).message);
    board.stop();
    process.exit(1);
  }

  // SDK, skills, and agent wiring are independent — install them concurrently,
  // just like a real package install. Dry-run staggers finishes across 5–10s.
  board.start(1, "installing…");
  board.start(2, "downloading…");
  board.start(3, installed.length ? "wiring…" : "none detected");
  const wired: string[] = [];
  let wireDone = 0;

  await Promise.all([
    (async () => {
      const sdk = await installSdk();
      if (DRY) await fill(board, 1, dryMs(7000, 9000));
      board.finish(1, sdk.ok ? "done" : "warn", sdk.note);
    })(),
    (async () => {
      const sk = await downloadSkills();
      if (DRY) await fill(board, 2, dryMs(5000, 7000));
      board.finish(2, sk.ok ? "done" : "warn", sk.note);
    })(),
    (async () => {
      await Promise.all(
        installed.map(async (a) => {
          try {
            const r = await a.wire(key);
            if (r.ok) wired.push(a.label);
          } catch {
            /* best effort per agent */
          }
          wireDone++;
          if (!DRY && installed.length) board.progress(3, wireDone / installed.length, a.label);
        }),
      );
      if (DRY) await fill(board, 3, dryMs(8500, 10000));
      const wiredWord = DRY ? "would wire" : "wired";
      board.finish(
        3,
        installed.length ? "done" : "warn",
        installed.length ? `${wired.length}/${installed.length} ${wiredWord}` : "install a coding tool",
      );
    })(),
  ]);

  board.stop();
  await sleep(900);
  clear();

  // ---- 3. onboard screen: pick an agent, spin up onboarding ----
  banner();
  sec("Let's run your first simulation");

  if (!installed.length) {
    warn("No supported coding tools detected. SDK + skills are installed.");
    dim(`Install Claude Code, Codex, Cursor, Windsurf, or Gemini and re-run: npx bluejay`);
    footer();
    process.exit(0);
  }

  const chosen = await pick(installed);
  footer();
  await launch(chosen);
}

// ---------- picker ----------
async function pick(agents: Agent[]): Promise<Agent> {
  if (agents.length === 1 || !isTTY) {
    dim(`Onboarding with ${agents[0].label}.`);
    return agents[0];
  }
  dim("Use ↑/↓ to choose, Enter to start:");
  process.stdout.write("\n");
  const labels = agents.map((a) => (a.launchType === "gui" ? `${a.label}  (app)` : a.label));
  const i = await selectList(labels);
  return agents[i];
}

// ---------- launch onboarding for the chosen agent ----------
async function launch(a: Agent) {
  process.stdout.write("\n");
  if (DRY) {
    const cmd =
      a.launchType === "cli" && a.cliCmd
        ? a.cliCmd(ONBOARD_PROMPT)
        : a.guiOpen
          ? a.guiOpen()
          : ["", []];
    ok(`Would onboard with ${a.label} (dry-run).`);
    dim(`Would run: ${(cmd[0] as string)} ${(cmd[1] as string[]).map((x) => (x.includes(" ") ? `"${x}"` : x)).join(" ")}`);
    if (a.launchType === "gui") copyPaste();
    process.exit(0);
  }
  if (a.launchType === "cli" && a.cliCmd) {
    const [cmd, args] = a.cliCmd(ONBOARD_PROMPT);
    ok(`Launching ${a.label}…`);
    dim(`When it opens, it walks you through your first simulation, then hands you the live run.`);
    process.stdout.write("\n");
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", () => {
      err(`Could not launch ${cmd}. Open ${a.label} and run the onboarding manually.`);
      copyPaste();
    });
    child.on("close", (code) => process.exit(code ?? 0));
    return;
  }
  // GUI agent: open the app + copy-paste prompt
  ok(`Opening ${a.label}…`);
  copyPaste();
  if (a.guiOpen) {
    const [cmd, args] = a.guiOpen();
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {});
  }
}

function copyPaste() {
  process.stdout.write("\n");
  dim("Paste this into your agent's chat to start onboarding:");
  box([ONBOARD_PROMPT]);
}

function footer() {
  process.stdout.write("\n");
  dim(`SDK (requires writing code):  pip install ${SDK_PKG}  →  from bluejay import Bluejay`);
  dim(`Dashboard: ${APP_URL}   Docs: ${DOCS_URL}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

main().catch((e) => {
  err((e as Error)?.message || String(e));
  process.exit(1);
});
