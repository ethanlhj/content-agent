// fetch.js — takes a reel URL, returns video download URL + caption via Apify
// Usage: node fetch.js "https://www.instagram.com/reel/XXXX/"
// Location: content-agent\scripts\reel-to-script\fetch.js

const fs = require("fs");
const path = require("path");

// --- load APIFY_TOKEN from the project .env (two levels up) ---
const envPath = path.join(__dirname, "..", "..", ".env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const TOKEN = env.APIFY_TOKEN;
if (!TOKEN) { console.error("No APIFY_TOKEN found in .env"); process.exit(1); }

// --- get the reel URL from the command line ---
const reelUrl = process.argv[2];
if (!reelUrl || !reelUrl.includes("instagram.com")) {
  console.error('Usage: node fetch.js "https://www.instagram.com/reel/XXXX/"');
  process.exit(1);
}

// --- free path first: yt-dlp downloads public reels without spending Apify credit ---
const { execFileSync } = require("child_process");
function tryYtDlp() {
  const localVideo = path.join(__dirname, "temp_reel.mp4");
  try {
    const info = JSON.parse(execFileSync("yt-dlp", [
      "--no-warnings", "--no-playlist", "-f", "b[ext=mp4]/b", "-o", localVideo,
      "--force-overwrites", "--print-json", reelUrl,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 }));
    if (!fs.existsSync(localVideo)) return null;
    return {
      sourceUrl: reelUrl,
      handle: info.channel || info.uploader_id || info.uploader || "unknown",
      caption: info.description || "",
      videoUrl: info.url || null,
      localVideo,
      via: "yt-dlp",
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const why = (e.stderr || e.message || "").toString().trim().split("\n").pop();
    console.log("yt-dlp unavailable or blocked (" + why.slice(0, 120) + "), falling back to Apify...");
    return null;
  }
}

async function main() {
  const free = tryYtDlp();
  if (free) {
    fs.writeFileSync(path.join(__dirname, "last_fetch.json"), JSON.stringify(free, null, 2));
    console.log("\n--- FETCHED (yt-dlp, free) ---");
    console.log("Handle:  @" + free.handle);
    console.log("Caption:", free.caption.slice(0, 150) + (free.caption.length > 150 ? "..." : ""));
    return;
  }

  console.log("Fetching reel via Apify (takes ~30-60 sec)...");

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [reelUrl],
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
      }),
    }
  );

  if (!res.ok) {
    console.error(`Apify returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const items = await res.json();
  const item = items && items[0];

  // graceful failure: private, deleted, or blocked reels
  if (!item || item.error || !item.videoUrl) {
    console.error("Could not fetch this reel. It may be private, deleted, or region-blocked.");
    if (item && item.error) console.error("Apify says:", item.error);
    process.exit(1);
  }

  const result = {
    sourceUrl: reelUrl,
    handle: item.ownerUsername || "unknown",
    caption: item.caption || "",
    videoUrl: item.videoUrl,
    fetchedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "last_fetch.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log("\n--- FETCHED ---");
  console.log("Handle:  @" + result.handle);
  console.log("Caption:", result.caption.slice(0, 150) + (result.caption.length > 150 ? "..." : ""));
  console.log("Video URL starts with:", result.videoUrl.slice(0, 60) + "...");
  console.log("\nSaved to", outPath);
}

main().catch(err => { console.error("Fetch failed:", err.message); process.exit(1); });
