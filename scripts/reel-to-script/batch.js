// batch.js — reads top 5 reels from the deck, runs each through fetch > transcribe > rewrite > output
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
const DATA = path.join(ROOT, "dashboard", "data.json");

const EXCLUDE_OWNERS = ["ethan_invests"]; // your own reels skip the batch

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flattened = (raw.competitors || []).flatMap(c => (c.posts || []).map(p => ({ ...p, owner: p.owner || c.handle })));
const logPath = path.join(ROOT, "output", "scripts", "scripts_data.json");
const already = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")).map(e => e.sourceUrl) : [];
const items = flattened.filter(i => !already.includes(i.url));
const top5 = items
  .filter(i => i.type === "Video" && i.url && !EXCLUDE_OWNERS.includes(i.owner))
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, 5);

if (top5.length === 0) { console.error("No videos found in " + DATA); process.exit(1); }

console.log("Top " + top5.length + " reels by score:");
top5.forEach((r, i) => console.log("  " + (i + 1) + ". @" + r.owner + " (" + (r.score || 0).toLocaleString() + ") " + r.url));
console.log("");

function step(script, args) {
  execFileSync("node", [path.join(HERE, script), ...(args || [])], { stdio: "inherit" });
}

let done = 0, failed = 0;
for (const [i, reel] of top5.entries()) {
  console.log("\n========== REEL " + (i + 1) + "/" + top5.length + ": @" + reel.owner + " ==========");
  try {
    step("fetch.js", [reel.url]);
    step("transcribe.js");
    step("rewrite.js");
    step("output.js");
    done++;
  } catch (e) {
    console.error(">>> Reel " + (i + 1) + " failed, moving on: " + e.message);
    failed++;
  }
}

console.log("\n========== BATCH DONE ==========");
console.log(done + " scripts written to output\\scripts\\, " + failed + " failed.");



