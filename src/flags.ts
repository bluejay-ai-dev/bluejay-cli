// --dry-run / --dry / -n / BLUEJAY_DRY_RUN=1 : detect for real, mutate nothing.
export const DRY =
  process.argv.includes("--dry-run") ||
  process.argv.includes("--dry") ||
  process.argv.includes("-n") ||
  process.env.BLUEJAY_DRY_RUN === "1";
