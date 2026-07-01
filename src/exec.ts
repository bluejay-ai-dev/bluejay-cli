import { spawn, spawnSync } from "node:child_process";

export function have(cmd: string): boolean {
  // cmd comes from our fixed registry, not user input — safe to interpolate.
  const line = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  const r = spawnSync(line, { stdio: "ignore", shell: true });
  return r.status === 0;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function run(cmd: string, args: string[] = []): Promise<RunResult> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", () => resolve({ code: -1, stdout, stderr }));
    p.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// run tasks in order; return true on the first that exits 0
export async function firstOk(cmds: Array<[string, string[]]>): Promise<boolean> {
  for (const [cmd, args] of cmds) {
    const r = await run(cmd, args);
    if (r.code === 0) return true;
  }
  return false;
}
