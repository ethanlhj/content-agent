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
      ? `💡 <b>Top ${breakouts.length} viral ideas to steal:</b>\n` + breakouts.map((b, i) =>
          `${i + 1}. @${b.handle} — <b>${fmt(b.views)}</b> views (${b.factor.toFixed(1)}×)\n"${(b.caption || "").split("#")[0].trim().slice(0, 70)}"\n${b.url}`
        ).join("\n\n")
      : `💡 No competitor breakout data yet — rerun pull-data.js first.`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

(async () => {
  const chatId = await getChatId();
  const text = buildDigest();
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
