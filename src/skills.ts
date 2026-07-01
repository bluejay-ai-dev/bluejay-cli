import fs from "node:fs";
import path from "node:path";
import { have, run } from "./exec.js";
import { SKILLS_REPO, SKILLS_DIR, BAC_SKILL_RAW, ONBOARD_SKILL_FILE } from "./const.js";
import { DRY } from "./flags.js";

export async function downloadSkills(): Promise<{ ok: boolean; note: string }> {
  if (DRY) return { ok: true, note: `would clone skills to ${SKILLS_DIR.replace(process.env.HOME || "", "~")}` };
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  let note = "";
  if (have("git")) {
    if (fs.existsSync(path.join(SKILLS_DIR, ".git"))) {
      const r = await run("git", ["-C", SKILLS_DIR, "pull", "--quiet", "--ff-only"]);
      note = r.code === 0 ? "updated" : "update skipped";
    } else {
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
      const r = await run("git", ["clone", "--quiet", "--depth", "1", SKILLS_REPO, SKILLS_DIR]);
      note = r.code === 0 ? "cloned" : "clone failed";
    }
  } else {
    note = "no git — skipped";
  }
  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  // flatten the onboard skill to a portable path for non-Claude agents
  const src = path.join(SKILLS_DIR, "bluejay", "skills", "onboard", "SKILL.md");
  if (fs.existsSync(src)) fs.copyFileSync(src, ONBOARD_SKILL_FILE);

  // Bluejay-as-Code portable prompt
  try {
    const res = await fetch(BAC_SKILL_RAW);
    if (res.ok) fs.writeFileSync(path.join(SKILLS_DIR, "bluejay-as-code.skill.txt"), await res.text());
  } catch {
    /* best effort */
  }
  return { ok: note !== "clone failed" && note !== "no git — skipped", note };
}
