import os from "node:os";
import path from "node:path";

export const MCP_URL = "https://api.getbluejay.ai/mcp";
export const API_BASE = "https://api.getbluejay.ai/v1";
export const SKILLS_REPO = "https://github.com/bluejay-ai-dev/bluejay-skills.git";
export const BAC_SKILL_RAW =
  "https://raw.githubusercontent.com/bluejay-ai-dev/docs/main/key-concepts/bluejay-as-code/skill.txt";
export const SKILLS_DIR = path.join(os.homedir(), ".bluejay", "skills");
export const ONBOARD_SKILL_FILE = path.join(SKILLS_DIR, "onboard.skill.txt");
export const SDK_PKG = "bluejay-sdk";
export const APP_URL = "https://app.getbluejay.ai";
export const DOCS_URL = "https://docs.getbluejay.ai";

export const headersJson = (key: string) => ({ "X-API-Key": key });
