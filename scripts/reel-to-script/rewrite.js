// rewrite.js — turns last_transcript.json into an original 30-sec script in Ethan's voice
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const ROOT = path.join(HERE, "..", "..");

// env
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
if (!env.ANTHROPIC_API_KEY) { console.error("No ANTHROPIC_API_KEY in .env"); process.exit(1); }

// inputs
const t = JSON.parse(fs.readFileSync(path.join(HERE, "last_transcript.json"), "utf8"));
const claudeMd = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
const styleStart = claudeMd.indexOf("## Reel-to-Script style guide");
const style = styleStart >= 0 ? claudeMd.slice(styleStart) : "30-second talking-head investing script, direct, no hype.";

const prompt = `You are a scriptwriter for Ethan (@ethan_invests), a 19-year-old investor with 8 years of market experience and a six-figure portfolio, speaking to a young retail investing audience.

Below is a transcript of a competitor's Instagram reel. Write an ORIGINAL 30-second talking-head script covering the same topic and core facts, but in Ethan's voice per the style guide. Rules:
- Do NOT reuse the original's sentences or phrasings. Same concept, entirely new words and structure.
- ~75-85 words total. Hook lands in the first sentence.
- Structure: hook, 2-3 body beats, one CTA.
- Stop-slop: no em-dashes, no adverbs, no passive voice, no cliches like "game-changer". No setup phrases like "here is the honest part", "real talk", or "here is the thing". State facts directly with no wind-up, matching the voice sample.
- Facts: only use facts present in the transcript. If a company name, ticker, or number seems uncertain, mark it [VERIFY].
- Do not tell people what to buy. Frame as "what I'm watching". Include a quick "not financial advice" beat.

STYLE GUIDE AND VOICE SAMPLE:
${style}

SOURCE TRANSCRIPT (@${t.handle}):
${t.transcript}

Respond ONLY with JSON, no markdown fences: {"hook": "...", "beats": ["...", "..."], "cta": "...", "whyOriginalWorked": "one line", "fullScript": "the whole thing as one readable block"}`;

async function main() {
  console.log("Rewriting via Claude API...");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) { console.error("API error " + res.status + ": " + (await res.text())); process.exit(1); }
  const data = await res.json();
  const text = data.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();

  let script;
  try { script = JSON.parse(text); }
  catch { console.error("Could not parse response as JSON. Raw output:\n" + text); process.exit(1); }

  const result = { sourceUrl: t.sourceUrl, handle: t.handle, generatedAt: new Date().toISOString(), ...script };
  fs.writeFileSync(path.join(HERE, "last_script.json"), JSON.stringify(result, null, 2));

  console.log("\n--- SCRIPT ---\n");
  console.log("HOOK: " + script.hook + "\n");
  script.beats.forEach((b, i) => console.log("BEAT " + (i + 1) + ": " + b + "\n"));
  console.log("CTA: " + script.cta + "\n");
  console.log("WHY THE ORIGINAL WORKED: " + script.whyOriginalWorked);
  console.log("\nSaved to last_script.json");
}

main().catch(err => { console.error("Rewrite failed:", err.message); process.exit(1); });

