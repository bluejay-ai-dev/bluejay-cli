import { staticBanner } from "./splash.js";

const TTY = process.stdout.isTTY === true;
const e = (code: string) => (TTY ? code : "");

export const c = {
  b: e("\x1b[1m"),
  d: e("\x1b[2m"),
  g: e("\x1b[32m"),
  y: e("\x1b[33m"),
  r: e("\x1b[31m"),
  bl: e("\x1b[38;5;33m"),
  lb: e("\x1b[38;5;75m"),
  cy: e("\x1b[38;5;51m"),
  x: e("\x1b[0m"),
};

export const isTTY = TTY;
const w = (s: string) => process.stdout.write(s);

export function banner() {
  staticBanner();
}

export const sec = (s: string) => w(`\n${c.b}${s}${c.x}\n`);
export const ok = (s: string) => w(`  ${c.g}✓${c.x} ${s}\n`);
export const warn = (s: string) => w(`  ${c.y}!${c.x} ${s}\n`);
export const err = (s: string) => process.stderr.write(`  ${c.r}✗${c.x} ${s}\n`);
export const dim = (s: string) => w(`  ${c.d}${s}${c.x}\n`);

export function clear() {
  if (TTY) w("\x1b[2J\x1b[3J\x1b[H");
  else w("\n");
}

export function box(lines: string[]) {
  const width = Math.max(...lines.map((l) => l.length));
  const top = `  ${c.d}┌${"─".repeat(width + 2)}┐${c.x}\n`;
  const bot = `  ${c.d}└${"─".repeat(width + 2)}┘${c.x}\n`;
  w(top);
  for (const l of lines) w(`  ${c.d}│${c.x} ${l.padEnd(width)} ${c.d}│${c.x}\n`);
  w(bot);
}

// ---------- progress board ----------
type Status = "queued" | "running" | "done" | "warn" | "fail";
interface Task {
  label: string;
  status: Status;
  note: string;
  frac?: number; // determinate; undefined = indeterminate while running
  _printed?: boolean;
}

const BAR_W = 22;

export class Board {
  private tasks: Task[];
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private painted = false;

  constructor(labels: string[]) {
    this.tasks = labels.map((label) => ({ label, status: "queued" as Status, note: "queued" }));
  }

  start(i: number, note = "…") {
    this.tasks[i].status = "running";
    this.tasks[i].note = note;
    this.render();
  }
  progress(i: number, frac: number, note?: string) {
    this.tasks[i].frac = frac;
    if (note) this.tasks[i].note = note;
    this.render();
  }
  finish(i: number, status: "done" | "warn" | "fail", note: string) {
    this.tasks[i].status = status;
    this.tasks[i].note = note;
    if (status === "done") this.tasks[i].frac = 1;
    this.render();
  }

  run() {
    if (!TTY) return;
    w("\x1b[?25l");
    this.timer = setInterval(() => {
      this.tick++;
      this.render();
    }, 90);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.render();
    if (TTY) w("\x1b[?25h");
  }

  private labelW() {
    return Math.max(...this.tasks.map((t) => t.label.length));
  }

  private bar(t: Task): string {
    const { g, y, r, d, x, lb } = c;
    if (t.status === "queued") return `${d}${"░".repeat(BAR_W)}${x}`;
    if (t.status === "done") return `${g}${"█".repeat(BAR_W)}${x}`;
    if (t.status === "warn") return `${y}${"█".repeat(BAR_W)}${x}`;
    if (t.status === "fail") return `${r}${"█".repeat(BAR_W)}${x}`;
    if (typeof t.frac === "number") {
      const n = Math.round(t.frac * BAR_W);
      return `${lb}${"█".repeat(n)}${d}${"░".repeat(BAR_W - n)}${x}`;
    }
    const span = 5;
    const range = BAR_W - span;
    const pos = Math.abs((this.tick % (range * 2)) - range);
    let s = "";
    for (let k = 0; k < BAR_W; k++) s += k >= pos && k < pos + span ? "█" : "░";
    return `${lb}${s}${x}`;
  }

  private glyph(t: Task): string {
    const { g, y, r, lb, d, x } = c;
    switch (t.status) {
      case "done": return `${g}✓${x}`;
      case "warn": return `${y}!${x}`;
      case "fail": return `${r}✗${x}`;
      case "running": return `${lb}◐${x}`;
      default: return `${d}·${x}`;
    }
  }

  private render() {
    const lw = this.labelW();
    if (!TTY) {
      for (const t of this.tasks) {
        if ((t.status === "done" || t.status === "warn" || t.status === "fail") && !t._printed) {
          t._printed = true;
          const mark = t.status === "done" ? "✓" : t.status === "warn" ? "!" : "✗";
          w(`  ${mark} ${t.label.padEnd(lw)}  ${t.note}\n`);
        }
      }
      return;
    }
    if (this.painted) w(`\x1b[${this.tasks.length}A`);
    for (const t of this.tasks) {
      const line = `  ${this.glyph(t)} ${t.label.padEnd(lw)}  ${this.bar(t)}  ${c.d}${t.note}${c.x}`;
      w(`\x1b[2K${line}\n`);
    }
    this.painted = true;
  }
}

// ---------- prompts ----------
export function question(prompt: string): Promise<string> {
  w(prompt);
  return new Promise((resolve) => {
    const onData = (d: Buffer) => {
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("end", onEnd);
      resolve(d.toString("utf8").replace(/[\r\n]+$/, ""));
    };
    const onEnd = () => {
      process.stdin.removeListener("data", onData);
      resolve("");
    };
    process.stdin.resume();
    process.stdin.once("data", onData);
    process.stdin.once("end", onEnd);
  });
}

// Arrow-key (↑/↓ or k/j) list picker; Enter selects. Returns the chosen index.
// Falls back to 0 when not a TTY.
export function selectList(items: string[]): Promise<number> {
  const stdin = process.stdin;
  if (!TTY || !stdin.setRawMode) return Promise.resolve(0);
  let idx = 0;
  const render = (first: boolean) => {
    if (!first) w(`\x1b[${items.length}A`);
    items.forEach((it, i) => {
      const sel = i === idx;
      const pointer = sel ? `${c.cy}❯${c.x}` : " ";
      const text = sel ? `${c.b}${it}${c.x}` : `${c.d}${it}${c.x}`;
      w(`\x1b[2K  ${pointer} ${text}\n`);
    });
  };
  w("\x1b[?25l");
  render(true);
  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw;
    stdin.setRawMode!(true);
    stdin.resume();
    const done = (val: number) => {
      stdin.setRawMode!(wasRaw);
      stdin.pause();
      stdin.removeListener("data", onData);
      w("\x1b[?25h");
      resolve(val);
    };
    const onData = (data: Buffer) => {
      const s = data.toString("utf8");
      if (s === "\x03") process.exit(1); // ctrl-c
      if (s === "\r" || s === "\n") return done(idx);
      if (s === "\x1b[A" || s === "k") idx = (idx - 1 + items.length) % items.length;
      else if (s === "\x1b[B" || s === "j") idx = (idx + 1) % items.length;
      else return;
      render(false);
    };
    stdin.on("data", onData);
  });
}

export function questionHidden(prompt: string): Promise<string> {
  w(prompt);
  const stdin = process.stdin;
  if (!stdin.isTTY || !stdin.setRawMode) return question("");
  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    let buf = "";
    const onData = (data: Buffer) => {
      for (const ch of data.toString("utf8")) {
        const code = ch.charCodeAt(0);
        if (code === 10 || code === 13 || code === 4) {
          stdin.setRawMode!(wasRaw);
          stdin.pause();
          stdin.removeListener("data", onData);
          w("\n");
          return resolve(buf);
        }
        if (code === 3) process.exit(1);
        else if (code === 127 || code === 8) buf = buf.slice(0, -1);
        else if (code >= 32) buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}
