import { have, firstOk } from "./exec.js";
import { SDK_PKG } from "./const.js";
import { DRY } from "./flags.js";

// returns a human note; never throws (SDK is best-effort)
export async function installSdk(): Promise<{ ok: boolean; note: string }> {
  if (DRY) return { ok: true, note: `would install ${SDK_PKG}` };
  if (have("uv")) {
    if (
      await firstOk([
        ["uv", ["pip", "install", "--system", "--upgrade", SDK_PKG]],
        ["uv", ["pip", "install", "--upgrade", SDK_PKG]],
      ])
    )
      return { ok: true, note: "installed (uv)" };
  }
  const py = have("python3") ? "python3" : have("python") ? "python" : "";
  if (py) {
    if (
      await firstOk([
        [py, ["-m", "pip", "install", "--upgrade", SDK_PKG]],
        [py, ["-m", "pip", "install", "--user", "--upgrade", SDK_PKG]],
        [py, ["-m", "pip", "install", "--break-system-packages", "--user", "--upgrade", SDK_PKG]],
      ])
    )
      return { ok: true, note: "installed (pip)" };
    return { ok: false, note: `pip failed — run: ${py} -m pip install ${SDK_PKG}` };
  }
  return { ok: false, note: `no Python — later: pip install ${SDK_PKG}` };
}
