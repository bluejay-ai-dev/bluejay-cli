// the Bluejay terminal splash — ported from the Python reference (bluejay + bluejay-spin).
// a welcome box with the brand wheel spinning inside and a living slice of the
// Bluejay world along the bottom: candy hills, a breathing sun, drifting clouds.
// 256-colour only (the RGB path from the Python source is dropped here).
import { WHEEL_FRAMES, WHEEL_COLORS, WHEEL_ROWS, WHEEL_COLS } from "./wheelFrames.js";

const TTY = process.stdout.isTTY === true;

const BLUE = "\x1b[38;5;69m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const R = "\x1b[0m";
const MINI = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const TAG = "Test, monitor & improve voice AI agents";
const CAPTIONS = [
  "Taking flight", "Spinning up the agents", "Tuning the call",
  "Crunching tokens", "Listening closely", "Almost there",
];

const NF = WHEEL_FRAMES.length; // 48
const WHEEL_W = WHEEL_COLS; // baked frames are 14 cells wide

// braille dot bit layout: (dx, dy) -> bit
const DOTS: [number, number, number][] = [
  [0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [0, 3, 0x40],
  [1, 0, 0x08], [1, 1, 0x10], [1, 2, 0x20], [1, 3, 0x80],
];

// world palettes by time of day: xterm-256 indices for [sun, far, near, star, cloud].
type World = { sun: number; far: number; near: number; star: number; cloud: number };
const WORLDS: Record<string, World> = {
  night: { sun: 189, far: 60, near: 23, star: 189, cloud: 103 },
  dawn: { sun: 222, far: 97, near: 30, star: 224, cloud: 182 },
  day: { sun: 230, far: 68, near: 37, star: 231, cloud: 195 },
  dusk: { sun: 218, far: 61, near: 30, star: 224, cloud: 139 },
};

function worldFor(hour: number): World {
  if (hour >= 6 && hour < 11) return WORLDS.dawn;
  if (hour >= 11 && hour < 17) return WORLDS.day;
  if (hour >= 17 && hour < 21) return WORLDS.dusk;
  return WORLDS.night;
}

const fg256 = (i: number) => `\x1b[38;5;${i}m`;

function fit(s: string, n: number): string {
  if (n <= 0) return "";
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + "…";
}

// title: "Welcome to Bluejay!" — bold, with "Bluejay!" (index >= 11) in blue.
function welcomeChars(color: boolean, tw: number): [number, string] {
  const plain = fit("Welcome to Bluejay!", tw);
  if (!color) return [plain.length, plain];
  let out = "";
  for (let i = 0; i < plain.length; i++) {
    const ch = plain[i];
    if (i >= 11) out += BOLD + BLUE + ch + R;
    else out += BOLD + ch + R;
  }
  return [plain.length, out];
}

// one wheel frame as coloured (or plain) braille lines.
function wheel(fi: number, color: boolean): string[] {
  const frame = WHEEL_FRAMES[((fi % NF) + NF) % NF];
  return frame.map((line, r) => {
    if (!color) return line;
    let out = "";
    for (let cCol = 0; cCol < line.length; cCol++) {
      const ch = line[cCol];
      if (ch === " ") out += ch;
      else out += fg256(WHEEL_COLORS[r][cCol]) + ch + R;
    }
    return out;
  });
}

const STARS: [number, number][] = [
  [0.10, 0.15], [0.30, 0.45], [0.52, 0.10], [0.66, 0.35],
  [0.84, 0.20], [0.24, 0.65], [0.94, 0.50],
];

// the world as braille dot-art — same medium as the wheel. no background fills:
// dotted hills, a breathing dotted sun, brisk dotted clouds.
function sceneLines(el: number, cellsW: number, sh: number, color: boolean, world: World): string[] {
  const { sun, far, near, star, cloud } = world;
  const W = cellsW * 2;
  const H = sh * 4;
  const grid: (number | null)[][] = Array.from({ length: H }, () => new Array<number | null>(W).fill(null));

  const farTop = (x: number) => H * (0.5 - 0.22 * Math.sin(x / 18.0 + 1.7) - 0.1 * Math.sin(x / 7.4));
  const nearTop = (x: number) => H * (0.74 - 0.16 * Math.sin(x / 26.0 + 4.0) - 0.08 * Math.sin(x / 10.0 + 1.2));

  for (const [fx, fy] of STARS) { // twinkling star dots
    if (Math.sin(el / 1.7 + fx * 25) > 0.1) {
      const gy = Math.trunc(fy * H * 0.5);
      const gx = Math.trunc(fx * (W - 1));
      grid[gy][gx] = star;
    }
  }
  const scx = W * 0.28; // breathing sun disc
  const scy = farTop(Math.trunc(scx)) - 4.5;
  const r0 = 3.4 + 0.9 * Math.sin(el / 2.3);
  for (let y = Math.max(0, Math.trunc(scy - r0)); y < Math.min(H, Math.trunc(scy + r0) + 1); y++) {
    for (let x = Math.max(0, Math.trunc(scx - r0)); x < Math.min(W, Math.trunc(scx + r0) + 1); x++) {
      if ((x - scx) ** 2 + (y - scy) ** 2 <= r0 * r0) grid[y][x] = sun;
    }
  }
  for (let x = 0; x < W; x++) { // hills rise over the sun
    for (let y = Math.max(0, Math.trunc(farTop(x))); y < H; y++) grid[y][x] = far;
    for (let y = Math.max(0, Math.trunc(nearTop(x))); y < H; y++) grid[y][x] = near;
  }
  for (const [speed, cy, rx, ry] of [[5.0, 3.0, 7.0, 2.4], [3.4, 7.0, 9.0, 2.8]]) { // drifting clouds
    const cx = ((el * speed) % (W + 2 * rx + 8)) - rx - 4;
    for (let y = Math.max(0, Math.trunc(cy - ry)); y < Math.min(H, Math.trunc(cy + ry) + 1); y++) {
      for (let x = Math.max(0, Math.trunc(cx - rx)); x < Math.min(W, Math.trunc(cx + rx) + 1); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0) grid[y][x] = cloud;
      }
    }
  }
  const pri = [sun, cloud, star, near, far];
  const lines: string[] = [];
  for (let cy = 0; cy < sh; cy++) {
    let out = "";
    for (let cx = 0; cx < cellsW; cx++) {
      let bits = 0;
      const present: number[] = [];
      for (const [dx, dy, bit] of DOTS) {
        const v = grid[cy * 4 + dy][cx * 2 + dx];
        if (v !== null) {
          bits |= bit;
          present.push(v);
        }
      }
      if (!bits) out += " ";
      else if (!color) out += String.fromCharCode(0x2800 + bits);
      else {
        const fgv = pri.find((p) => present.includes(p))!;
        out += fg256(fgv) + String.fromCharCode(0x2800 + bits) + R;
      }
    }
    lines.push(out);
  }
  return lines;
}

function tierFor(cols: number, rows: number): number {
  if (cols >= 72 && rows >= 15) return 2;
  if (cols >= 46 && rows >= 11) return 1;
  if (cols >= 30 && rows >= 7) return 0;
  return -1;
}

const sceneH = (rows: number) => Math.max(4, Math.min(7, rows - 11));

// build the box (array of lines) for the given tier; returns [lines, boxWidth].
function box(fi: number, el: number, cols: number, rows: number, color: boolean, tier: number, world: World): [string[], number] {
  const g = color ? BLUE : "";
  const r = color ? R : "";
  const bw = Math.max(12, Math.min(cols, tier === 2 ? 80 : 64));
  const inner = bw - 4;
  const out: string[] = [g + "╭" + "─".repeat(bw - 2) + "╮" + r];
  const dim = color ? DIM : "";

  const row = (vis: number, line: string) =>
    g + "│ " + r + line + " ".repeat(Math.max(0, inner - vis)) + g + " │" + r;

  if (tier === 2 || tier === 1) {
    const wl = wheel(fi, color);
    const tw = inner - WHEEL_W - 3;
    const [wv, wt] = welcomeChars(color, tw);
    const texts: [number, string][] = [
      [0, ""], [wv, wt], [0, ""],
      [fit(TAG, tw).length, dim + fit(TAG, tw) + (color ? R : "")],
      [0, ""], [0, ""], [0, ""],
    ];
    for (let i = 0; i < WHEEL_ROWS; i++) {
      const [tv, tt] = texts[i];
      out.push(row(WHEEL_W + 3 + tv, wl[i] + "   " + tt));
    }
    if (tier === 2) {
      for (const ln of sceneLines(el, inner, sceneH(rows), color, world)) out.push(row(inner, ln));
    }
  } else {
    const tw = inner - 2;
    const m = color ? BLUE + MINI[fi % MINI.length] + R : MINI[fi % MINI.length];
    const [wv, wt] = welcomeChars(color, tw);
    const rows3: [number, string][] = [
      [2 + wv, m + " " + wt],
      [2 + fit(TAG, tw).length, "  " + dim + fit(TAG, tw) + (color ? R : "")],
    ];
    for (const [vis, line] of rows3) out.push(row(vis, line));
  }
  out.push(g + "╰" + "─".repeat(bw - 2) + "╯" + r);
  return [out, bw];
}

// the dim status line under the box, with mini-spinner + cycling caption.
function status(el: number, cols: number, color: boolean): string {
  const m = MINI[Math.trunc(el * 10) % MINI.length];
  const cap = fit(CAPTIONS[Math.trunc(el / 1.6) % CAPTIONS.length], Math.max(0, cols - 22));
  if (color) return " " + BLUE + m + R + " " + DIM + cap + "… (any key to skip)" + R;
  return ` ${m} ${cap}… (any key to skip)`;
}

// strip ANSI so callers/tests can measure visible width.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");

const currentSize = (): [number, number] => [process.stdout.columns || 80, process.stdout.rows || 24];

// ── public API ──────────────────────────────────────────────────────────────

// print ONE static frame of the welcome box (normal buffer, scrolls with output).
export function staticBanner(): void {
  const color = TTY;
  const [cols, rows] = currentSize();
  const world = worldFor(new Date().getHours());
  const tier = Math.max(0, tierFor(cols, rows));
  const [lines] = box(0, 0, cols, rows, color, tier, world);
  process.stdout.write("\n" + lines.join("\n") + "\n");
}

const ALT_ON = "\x1b[?1049h\x1b[?25l\x1b[2J";
const ALT_OFF = "\x1b[0m\x1b[?25h\x1b[?1049l";

// animated intro: alt-screen wheel spin + living world, skippable by any keypress.
export function playSplash(ms = 3000): Promise<void> {
  if (!TTY) return Promise.resolve();
  const o = process.stdout;
  const stdin = process.stdin;
  const color = true;
  const world = worldFor(new Date().getHours());
  const t0 = Date.now();

  o.write(ALT_ON);

  return new Promise<void>((resolve) => {
    let last: [number, number] | null = null;
    let tick = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;
    const canRaw = typeof stdin.setRawMode === "function";
    const wasRaw = stdin.isRaw;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (timer) clearInterval(timer);
      timer = null;
      stdin.removeListener("data", onKey);
      if (canRaw) stdin.setRawMode!(wasRaw ?? false);
      stdin.pause();
      o.write(ALT_OFF);
      resolve();
    };

    const onKey = (data: Buffer) => {
      if (data.length && data[0] === 3) { // ctrl-c
        if (canRaw) stdin.setRawMode!(wasRaw ?? false);
        o.write(ALT_OFF);
        process.exit(130);
      }
      cleanup();
    };

    const frame = () => {
      const el = (Date.now() - t0) / 1000;
      if (el * 1000 >= ms) return cleanup();
      const [cols, rows] = currentSize();
      const fi = Math.round(((el * 150.0) % 60.0) / (60.0 / NF)) % NF;
      const tier = tierFor(cols, rows);

      if (!last || last[0] !== cols || last[1] !== rows) {
        last = [cols, rows];
        let lines: string[];
        if (tier < 0) lines = [status(el, cols, color)];
        else lines = [...box(fi, el, cols, rows, color, tier, world)[0], "", status(el, cols, color)];
        lines = lines.slice(0, rows);
        o.write("\x1b[2J\x1b[H" + lines.map((l) => l + "\x1b[K").join("\n"));
      }

      if (tier >= 1) {
        wheel(fi, color).forEach((wline, i) => o.write(`\x1b[${2 + i};3H` + wline));
      } else if (tier === 0) {
        o.write("\x1b[2;3H" + BLUE + MINI[fi % MINI.length] + R);
      }
      if (tier === 2 && tick % 3 === 0) { // world at ~10fps
        const inner = box(fi, el, cols, rows, color, tier, world)[1] - 4;
        sceneLines(el, inner, sceneH(rows), color, world).forEach((ln, y) => o.write(`\x1b[${9 + y};3H` + ln));
      }
      const statusRow = tier >= 0 ? (tier === 2 ? 9 + sceneH(rows) : tier === 1 ? 9 : 5) + 2 : 1;
      if (statusRow <= rows) o.write(`\x1b[${statusRow};1H` + status(el, cols, color) + "\x1b[K");
      tick++;
    };

    if (canRaw) stdin.setRawMode!(true);
    stdin.resume();
    stdin.on("data", onKey);
    frame();
    timer = setInterval(frame, 1000 / 30);
  });
}

export { stripAnsi };
