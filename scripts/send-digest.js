// send-digest.js — sends the content-desk digest to your Telegram.
// Usage: node scripts/send-digest.js   (run from the content-agent folder)
// Needs: TELEGRAM_TOKEN in .env, and you must have messaged your bot once.
// First run auto-discovers your chat id and saves TELEGRAM_CHAT_ID to .env.
// The token is never printed or logged.

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const readEnv = () =>
  Object.fromEntries(
    fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );

let env = readEnv();
const TOKEN = env.TELEGRAM_TOKEN;
if (!TOKEN) {
  console.error("No TELEGRAM_TOKEN in .env — add TELEGRAM_TOKEN=... (from @BotFather) and rerun.");
  process.exit(1);
}
const API = `https://api.telegram.org/bot${TOKEN}`;

async function getChatId() {
  if (env.TELEGRAM_CHAT_ID) return env.TELEGRAM_CHAT_ID;
  console.log("No TELEGRAM_CHAT_ID yet — discovering it from getUpdates...");
  const res = await fetch(`${API}/getUpdates`);
  const j = await res.json();
  if (!j.ok) throw new Error("Telegram API error: " + j.description);
  const msg = (j.result || []).reverse().find((u) => u.message?.chat?.id);
  if (!msg) throw new Error(
    "No messages found. Open your bot in Telegram, press Start, send it any message, then rerun."
  );
  const id = String(msg.message.chat.id);
  fs.appendFileSync(envPath, `\nTELEGRAM_CHAT_ID=${id}`);
  console.log(`Found chat id (${msg.message.chat.first_name || "you"}) — saved to .env.`);
  return id;
}

function buildDigest() {
  const dataPath = path.join(__dirname, "..", "dashboard", "data.json");
  const D = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const me = D.me;
  const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
  const top = (me.posts || [])[0];
  const eng = me.totalViews
    ? (((me.totalLikes + me.totalComments) / me.totalViews) * 100).toFixed(1) + "%" : "—";

  // top ideas = biggest competitor breakouts by views-per-follower
  const breakouts = (D.competitors || [])
    .flatMap((c) => (c.posts || []).filter((p) => p.views).map((p) => ({
      ...p, handle: c.handle, factor: c.followers ? p.views / c.followers : 0,
    })))
    .sort((a, b) => b.factor - a.factor)
    .slice(0, 5);

  // attach the format breakdown batch.js wrote for each breakout (matched by shortcode)
  const code = (u) => ((u || "").match(/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/) || [])[1] || "";
  const logPath = path.join(__dirname, "..", "output", "scripts", "scripts_data.json");
  const scripts = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : [];
  const byCode = Object.fromEntries(scripts.map((s) => [code(s.sourceUrl), s]));
  const formatLines = (b) => {
    const s = byCode[code(b.url)];
    if (!s) return "";
    return [
      s.format ? `🧩 Format: ${esc(s.format)}` : `🧩 Why it hit: ${esc(s.whyOriginalWorked || "")}`,
      s.hookPattern ? `🪝 Hook: <i>${esc(s.hookPattern)}</i>` : "",
      `🎙 Your version: "${esc((s.hook || "").slice(0, 120))}"`,
    ].filter(Boolean).join("\n") + "\n";
  };

  const lines = [
    `📊 <b>@${me.handle} — content desk digest</b>`,
    `pulled ${new Date(D.pulledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    ``,
    `👥 Followers: <b>${fmt(me.followers)}</b>`,
    `▶️ Total views: <b>${fmt(me.totalViews)}</b> across ${fmt(me.totalPosts)} posts`,
    `❤️ Engagement: <b>${eng}</b> (${fmt(me.totalLikes)} likes · ${fmt(me.totalComments)} comments)`,
    top ? `🏆 Top post: <b>${fmt(top.views)}</b> views\n"${(top.caption || "").split("#")[0].trim().slice(0, 60)}"\n${top.url}` : "",
    ``,
    breakouts.length
      ? `💡 <b>Top ${breakouts.length} viral formats to steal:</b>\n` + breakouts.map((b, i) =>
          `${i + 1}. @${b.handle} — <b>${fmt(b.views)}</b> views (${b.factor.toFixed(1)}× followers)\n"${esc((b.caption || "").split("#")[0].trim().slice(0, 70))}"\n${formatLines(b)}${b.url}`
        ).join("\n\n")
      : `💡 No competitor breakout data yet — rerun pull-data.js first.`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Usage: node send-digest.js              -> send today's digest
//        node send-digest.js --dry-run    -> print it, send nothing
//        node send-digest.js --alert "msg" -> send a short warning instead (run-all uses this)
(async () => {
  const args = process.argv.slice(2);
  const alertIdx = args.indexOf("--alert");
  const text = alertIdx >= 0
    ? `⚠️ <b>Content desk</b>\n${esc(args[alertIdx + 1] || "Something failed.")}`
    : buildDigest();
  if (args.includes("--dry-run")) { console.log(text); return; }
  const chatId = await getChatId();
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error("sendMessage failed: " + j.description);
  console.log("✅ Digest sent — check your phone.");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
