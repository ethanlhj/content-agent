// view.js — builds output/scripts/index.html from the accumulated script log.
// Scripts are NEVER wiped: scripts_data.json only grows (output.js dedupes by sourceUrl).
// Display: grouped by day (newest day first), best source reel (views) first within each day.
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
const OUT_DIR = path.join(ROOT, "output", "scripts");
const DATA_FILE = path.join(OUT_DIR, "scripts_data.json");

let scripts = [];
if (fs.existsSync(DATA_FILE)) scripts = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// --- enrich with source reel performance from dashboard/data.json (views/likes) ---
const shortcodeOf = (url) => (((url || "").match(/(reel|p)\/([A-Za-z0-9_-]+)/) || [])[2] || "");
const perf = {};
try {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "dashboard", "data.json"), "utf8"));
  const allPosts = [...((D.me || {}).posts || []), ...(D.competitors || []).flatMap((c) => c.posts || [])];
  for (const p of allPosts) {
    const code = shortcodeOf(p.url);
    if (code) perf[code] = { views: p.views ?? null, likes: p.likes ?? null };
  }
} catch (e) { /* data.json missing — render without metrics */ }

for (const s of scripts) {
  const m = perf[shortcodeOf(s.sourceUrl)] || {};
  s.sourceViews = m.views ?? s.sourceViews ?? null;
  s.sourceLikes = m.likes ?? s.sourceLikes ?? null;
  s.day = (s.generatedAt || "").slice(0, 10) || "undated";
}

// newest day first; within a day, biggest source reel first
scripts.sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : (b.sourceViews || b.sourceLikes || 0) - (a.sourceViews || a.sourceLikes || 0)));

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => (n == null ? null : n.toLocaleString());

let cards = "", lastDay = null;
scripts.forEach((s, i) => {
  if (s.day !== lastDay) {
    const count = scripts.filter((x) => x.day === s.day).length;
    cards += `<h2 class="day">${esc(s.day)} · ${count} script${count > 1 ? "s" : ""} · best to rip first</h2>`;
    lastDay = s.day;
  }
  const metric = fmt(s.sourceViews) ? fmt(s.sourceViews) + " views" : fmt(s.sourceLikes) ? fmt(s.sourceLikes) + " likes" : "";
  cards += `
  <div class="card">
    <div class="meta"><a href="${esc(s.sourceUrl)}" target="_blank">@${esc(s.handle)}</a>${metric ? ` · source: ${metric}` : ""}</div>
    <h2>${esc(s.hook)}</h2>
    <div class="beats">${(s.beats || []).map((b, j) => `<p><span>${j + 1}</span> ${esc(b)}</p>`).join("")}</div>
    <p class="cta"><strong>CTA:</strong> ${esc(s.cta)}</p>
    <p class="why">${esc(s.whyOriginalWorked)}</p>
    <button onclick="copyScript(${i})">Copy full script</button>
    <textarea id="full-${i}" hidden>${esc(s.fullScript)}</textarea>
  </div>`;
});

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reel Scripts</title>
<style>
  body { font-family: -apple-system, Segoe UI, sans-serif; background: #0d1512; color: #e8f0ec; max-width: 780px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #4ade80; font-size: 22px; }
  .day { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #7fa892; border-bottom: 1px solid #234433; padding-bottom: 8px; margin: 34px 0 6px; }
  .card { background: #14211b; border: 1px solid #234433; border-radius: 12px; padding: 20px 24px; margin: 18px 0; }
  .card h2 { font-size: 17px; margin: 8px 0 14px; line-height: 1.4; }
  .meta { font-size: 12px; color: #7fa892; } .meta a { color: #4ade80; text-decoration: none; }
  .beats p { font-size: 14px; line-height: 1.55; margin: 8px 0; }
  .beats span { color: #4ade80; font-weight: 600; margin-right: 6px; }
  .cta { font-size: 14px; color: #b8d9c6; } .why { font-size: 12.5px; color: #7fa892; font-style: italic; }
  button { background: #1d3528; color: #4ade80; border: 1px solid #2f5a41; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
  button:hover { background: #234433; }
  mark { background: #5a3a1a; color: #ffb86b; padding: 0 4px; border-radius: 4px; }
</style></head><body>
<h1>Reel-to-Script — ${scripts.length} scripts</h1>
${cards.replace(/\[VERIFY\]/g, "<mark>[VERIFY]</mark>") || "<p>No scripts yet. Run the pipeline, then view.js.</p>"}
<script>
function copyScript(i) { navigator.clipboard.writeText(document.getElementById("full-" + i).value); }
</script></body></html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "dashboard", "scripts_data.js"), "window.SCRIPTS = " + JSON.stringify(scripts) + ";");
console.log("Viewer built: " + path.join(OUT_DIR, "index.html") + " (" + scripts.length + " scripts, grouped by day)");
