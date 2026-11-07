// run-all.js - one full cycle: pull fresh data -> script the top breakout reels ->
// rebuild the script viewer -> send the Telegram digest. This is what the daily schedule runs.
// Usage: node scripts/run-all.js   (from the content-agent folder)
// Logs each run to run.log (gitignored). Failures are also sent to Telegram so a broken
// pull never goes unnoticed again.

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

// run a step; stderr is captured so a failure can say WHY (not just "Command failed")
function run(script) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, ...script)], { cwd: root, stdio: ["inherit", "inherit", "pipe"] });
  } catch (e) {
    const err = (e.stderr || "").toString().trim();
    if (err) console.error(err);
    const reason = err.split("\n").filter(Boolean).pop() || e.message;
    throw new Error(reason.replace(/^ERROR:\s*/, ""));
  }
}

// tell Ethan on Telegram instead of failing silently
function alert(msg) {
  try { execFileSync(process.execPath, [path.join(__dirname, "send-digest.js"), "--alert", msg], { cwd: root, stdio: "inherit" }); }
  catch { log("could not send Telegram alert"); }
}

try {
  log("cycle start");
  log("1/4 pulling data (Apify)...");
  try {
    run(["pull-data.js"]);
  } catch (e) {
    alert("Daily pull failed, no digest today.\n" + e.message);
    throw e;
  }
  log("1/4 pull done - data.json + data.js refreshed");

  try {
    log("2/4 scripting top reels...");
    run(["reel-to-script", "batch.js"]);
    log("2/4 scripts done");

    log("3/4 rebuilding script viewer...");
    run(["reel-to-script", "view.js"]);
    log("3/4 viewer built");
  } catch (e) {
    log("2-3/4 scripting FAILED (continuing): " + e.message);
    alert("Reel transcription failed today. The digest still lists the viral reels, without format breakdowns.\n" + e.message);
  }

  log("4/4 sending Telegram digest...");
  run(["send-digest.js"]);
  log("4/4 digest sent");

  log("cycle complete");
} catch (e) {
  log("cycle FAILED: " + e.message);
  process.exit(1);
}
