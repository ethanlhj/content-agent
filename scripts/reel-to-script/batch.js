// batch.js — takes the top 5 competitor breakout reels from the deck and runs each through
// fetch > transcribe > rewrite > output.
// Ranking matches the Telegram digest: views per follower (a 50k-follower account pulling
// 500k views beats a 500k account pulling 600k), so the digest can show each one's format.
// If pull-data.js already captured the reel's video link, the paid Apify fetch is skipped.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
const DATA = path.join(ROOT, "dashboard", "data.json");
const TOP_N = 5;

const EXCLUDE_OWNERS = ["ethan_invests"]; // your own reels skip the batch

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flattened = (raw.competitors || []).flatMap((c) =>
  (c.posts || []).map((p) => ({
    ...p,
    owner: p.owner || c.handle,
    factor: c.followers && p.views ? p.views / c.followers : 0,
  }))
);
const logPath = path.join(ROOT, "output", "scripts", "scripts_data.json");
const already = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")).map((e) => e.sourceUrl) : [];
const top = flattened
  .filter((i) => i.type === "Video" && i.url && !EXCLUDE_OWNERS.includes(i.owner) && !already.includes(i.url))
  .sort((a, b) => b.factor - a.factor || (b.score || 0) - (a.score || 0))
  .slice(0, TOP_N);

if (top.length === 0) { console.log("No new competitor reels to script."); process.exit(0); }

console.log("Top " + top.length + " breakout reels:");
top.forEach((r, i) =>
  console.log("  " + (i + 1) + ". @" + r.owner + " (" + (r.views || 0).toLocaleString() + " views, " + r.factor.toFixed(1) + "x) " + r.url)
);
console.log("");

function step(script, args) {
  execFileSync(process.execPath, [path.join(HERE, script), ...(args || [])], { stdio: "inherit" });
}

let done = 0, failed = 0;
for (const [i, reel] of top.entries()) {
  console.log("\n========== REEL " + (i + 1) + "/" + top.length + ": @" + reel.owner + " ==========");
  try {
    if (reel.videoUrl) {
      // already have the CDN link from today's pull: write last_fetch.json directly
      fs.writeFileSync(path.join(HERE, "last_fetch.json"), JSON.stringify({
        sourceUrl: reel.url, handle: reel.owner, caption: reel.caption || "",
        videoUrl: reel.videoUrl, fetchedAt: new Date().toISOString(),
      }, null, 2));
    } else {
      step("fetch.js", [reel.url]);
    }
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
console.log(done + " scripts written to output/scripts/, " + failed + " failed.");
if (done === 0 && failed > 0) process.exit(1); // every reel failed: surface it instead of hiding it
