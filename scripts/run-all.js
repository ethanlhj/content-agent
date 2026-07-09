// run-all.js â€” one full cycle: pull fresh data â†’ dashboard refreshes (pull writes
// data.js) â†’ send the Telegram digest. This is what the weekly schedule runs.
// Usage: node scripts/run-all.js   (from the content-agent folder)
// Logs each run to run.log (gitignored) so you can audit what happened and when.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const logPath = path.join(root, "run.log");
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.appendFileSync(logPath, line + "\n");
};

try {
  log("cycle start");
  log("1/4 pulling data (Apify)...");
  execFileSync(process.execPath, [path.join(__dirname, "pull-data.js")], { cwd: root, stdio: "inherit" });
  log("1/4 pull done â€” data.json + data.js refreshed");

  try {
    log("2/4 scripting top reels...");
    execFileSync(process.execPath, [path.join(__dirname, "reel-to-script", "batch.js")], { cwd: root, stdio: "inherit" });
    log("2/4 scripts done");

    log("3/4 rebuilding script viewer...");
    execFileSync(process.execPath, [path.join(__dirname, "reel-to-script", "view.js")], { cwd: root, stdio: "inherit" });
    log("3/4 viewer built");
  } catch (e) {
    log("2-3/4 scripting FAILED (continuing): " + e.message);
  }

  log("4/4 sending Telegram digest...");
  execFileSync(process.execPath, [path.join(__dirname, "send-digest.js")], { cwd: root, stdio: "inherit" });
  log("4/4 digest sent");

  log("cycle complete âœ…");
} catch (e) {
  log("cycle FAILED: " + e.message);
  process.exit(1);
}

