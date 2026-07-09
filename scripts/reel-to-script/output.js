// output.js — formats last_script.json into a readable markdown file in output/scripts/
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");
const OUT_DIR = path.join(ROOT, "output", "scripts");

const s = JSON.parse(fs.readFileSync(path.join(HERE, "last_script.json"), "utf8"));

const date = new Date().toISOString().slice(0, 10);
const safeHandle = (s.handle || "unknown").replace(/[^a-z0-9._-]/gi, "");
const shortcode = ((s.sourceUrl || "").match(/(reel|p)\/([A-Za-z0-9_-]+)/) || [])[2] || Date.now();
const filename = date + "_" + safeHandle + "_" + shortcode + ".md";

const md = `# Script: ${s.hook.slice(0, 60)}...

**Date:** ${date}
**Source:** [@${s.handle}](${s.sourceUrl})
**Why the original worked:** ${s.whyOriginalWorked}

---

## HOOK
${s.hook}

## BODY
${s.beats.map((b, i) => (i + 1) + ". " + b).join("\n\n")}

## CTA
${s.cta}

---

## Full read-through
${s.fullScript}

---
*Check any [VERIFY] flags against the source before filming.*
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, filename);
fs.writeFileSync(outPath, md);
const logPath = path.join(OUT_DIR, "scripts_data.json");
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : [];
if (!log.some(e => e.sourceUrl === s.sourceUrl)) log.push(s);
fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log("Script saved: " + outPath);

