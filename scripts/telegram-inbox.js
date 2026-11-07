// telegram-inbox.js - send your bot an Instagram reel link, get the transcript back.
// Runs in GitHub Actions every 10 min (.github/workflows/telegram-inbox.yml), or locally:
//   node scripts/telegram-inbox.js --check     -> any reel links waiting? (sets has_work for Actions)
//   node scripts/telegram-inbox.js --process   -> transcribe each one and reply in Telegram
// Only messages from YOUR chat (TELEGRAM_CHAT_ID) are read. Everyone else is ignored.
// Each reel: fetch (yt-dlp free, Apify fallback) -> whisper transcript -> draft script in your voice.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const R2S = path.join(__dirname, "reel-to-script");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = env;
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) { console.error("Need TELEGRAM_TOKEN and TELEGRAM_CHAT_ID in .env"); process.exit(1); }
const API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const REEL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reel|reels|p)\/[A-Za-z0-9_-]+\/?[^\s]*/gi;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}
const say = (text) => tg("sendMessage", { chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true });
// Telegram caps a message at 4096 chars
async function sayLong(header, body) {
  const chunks = [];
  for (let i = 0; i < body.length; i += 3500) chunks.push(body.slice(i, i + 3500));
  for (const [i, c] of chunks.entries()) await say((i === 0 ? header + "\n\n" : "") + esc(c));
}

// pending messages from me, split into reel links and everything else
async function pending() {
  const updates = await tg("getUpdates", { timeout: 0, allowed_updates: ["message"] });
  const mine = updates.filter((u) => String(u.message?.chat?.id) === String(TELEGRAM_CHAT_ID));
  const reels = [];
  for (const u of mine) {
    const text = u.message.text || u.message.caption || "";
    for (const m of text.match(REEL_RE) || []) reels.push(m.split("?")[0]);
  }
  const lastId = updates.length ? Math.max(...updates.map((u) => u.update_id)) : null;
  return { updates, mine, reels: [...new Set(reels)], lastId };
}
// confirm everything up to lastId so it is never processed twice
const ack = (lastId) => (lastId == null ? null : tg("getUpdates", { offset: lastId + 1, timeout: 0 }));

function step(script, args) {
  try {
    execFileSync(process.execPath, [path.join(R2S, script), ...(args || [])], { cwd: ROOT, stdio: ["ignore", "inherit", "pipe"] });
  } catch (e) {
    const err = (e.stderr || "").toString().trim();
    if (err) console.error(err);
    throw new Error(`${script}: ` + (err.split("\n").filter(Boolean).pop() || e.message));
  }
}

async function check() {
  const { mine, reels, lastId } = await pending();
  const hasWork = reels.length > 0;
  if (!hasWork && mine.length) {
    // only chatter, no links: answer once and clear it so the next poll stays cheap
    await say("Send me an Instagram reel link and I'll transcribe it.");
    await ack(lastId);
  }
  console.log(`${reels.length} reel link(s) waiting`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_work=${hasWork}\n`);
}

async function processAll() {
  const { reels, lastId } = await pending();
  // ack first: if a reel crashes the run, it won't loop forever (just resend the link)
  await ack(lastId);
  if (!reels.length) { console.log("nothing to do"); return; }

  for (const url of reels) {
    console.log("\n==== " + url + " ====");
    try {
      await say(`🎬 Got it. Transcribing…\n${esc(url)}`);
      step("fetch.js", [url]);
      step("transcribe.js");
      const t = JSON.parse(fs.readFileSync(path.join(R2S, "last_transcript.json"), "utf8"));
      await sayLong(`📝 <b>Transcript</b> (@${esc(t.handle)})`, t.transcript || "(no speech found)");

      try {
        step("rewrite.js");
        step("output.js");
        const s = JSON.parse(fs.readFileSync(path.join(R2S, "last_script.json"), "utf8"));
        await say([
          `🧩 <b>Format:</b> ${esc(s.format || s.whyOriginalWorked || "")}`,
          s.hookPattern ? `🪝 <b>Hook pattern:</b> <i>${esc(s.hookPattern)}</i>` : "",
          ``,
          `✍️ <b>Draft in your voice</b> (rewrite it however you want):`,
          esc(s.fullScript || ""),
          ``,
          `<i>Check any [VERIFY] flags before filming.</i>`,
        ].join("\n"));
      } catch (e) {
        await say(`Transcript's above. The draft script step failed: ${esc(e.message)}`);
      }
    } catch (e) {
      console.error(e.message);
      await say(`❌ Couldn't transcribe that reel.\n${esc(e.message).slice(0, 300)}\n\nIf it's private or deleted, that's why. Otherwise resend it.`);
    }
  }
  try { step("view.js"); } catch (e) { console.error("viewer rebuild failed: " + e.message); }
}

const mode = process.argv[2];
(mode === "--check" ? check() : mode === "--process" ? processAll() : Promise.reject(new Error("use --check or --process")))
  .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
