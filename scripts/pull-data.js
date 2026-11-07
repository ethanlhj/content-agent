// pull-data.js — pulls real Instagram data via Apify's instagram-scraper
// Usage: node scripts/pull-data.js   (run from the content-agent folder)
// Needs: Node 18+, APIFY_TOKEN in .env
// Note: uses apify/instagram-scraper with resultsType "posts" for post history
// (NOT instagram-profile-scraper latestPosts — that only returns recent posts).

const fs = require("fs");
const path = require("path");

// ---- config -----------------------------------------------------------
const ME = "ethan_invests";
const COMPETITORS = ["mo.invests", "kevvonz", "charan.invests", "bdinvestingg", "joe.investss"];
const MY_POST_LIMIT = 500;        // high limit = full post history for my account
const COMPETITOR_POST_LIMIT = 10; // recent posts per competitor (was 20; halves the biggest Apify cost)
// Apify free plan = $5/month. A daily run now costs ~$0.14; your own posts are only
// re-pulled on Sundays (or with FULL_PULL=1) and reused from data.json in between.
const MY_POSTS_REFRESH_DAY = 0;   // 0 = Sunday (UTC)
const EST_RUN_COST_USD = 0.2;     // headroom check before starting any Apify run
// -----------------------------------------------------------------------

// read APIFY_TOKEN from .env (no dotenv dependency needed)
const envPath = path.join(__dirname, "..", ".env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const TOKEN = env.APIFY_TOKEN;
if (!TOKEN) {
  console.error("No APIFY_TOKEN found in .env — add the line APIFY_TOKEN=... and rerun.");
  process.exit(1);
}

const API = "https://api.apify.com/v2";
const ACTOR = "apify~instagram-scraper";
const igUrl = (h) => `https://www.instagram.com/${h}/`;

// start an actor run, poll until it finishes, return dataset items
async function runActor(input, label) {
  console.log(`\n▶ starting Apify run: ${label} ...`);
  const startRes = await fetch(`${API}/acts/${ACTOR}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!startRes.ok) throw new Error(`start failed (${startRes.status}): ${await startRes.text()}`);
  const run = (await startRes.json()).data;

  let status = run.status;
  while (["READY", "RUNNING"].includes(status)) {
    await new Promise((r) => setTimeout(r, 10000));
    const poll = await fetch(`${API}/actor-runs/${run.id}?token=${TOKEN}`);
    status = (await poll.json()).data.status;
    process.stdout.write(`  status: ${status}      \r`);
  }
  console.log(`\n  finished: ${status}`);
  if (status !== "SUCCEEDED") throw new Error(`run ${label} ended with status ${status}`);

  const itemsRes = await fetch(
    `${API}/actor-runs/${run.id}/dataset/items?token=${TOKEN}&clean=true&format=json`
  );
  return itemsRes.json();
}

// normalise one raw post into the shape the dashboard uses
function toPost(p) {
  const views = p.videoViewCount ?? p.videoPlayCount ?? null;
  return {
    id: p.id ?? p.shortCode,
    url: p.url,
    type: p.type,                                    // Video / Image / Sidecar
    caption: (p.caption || "").slice(0, 140),
    timestamp: p.timestamp,
    likes: p.likesCount ?? 0,
    comments: p.commentsCount ?? 0,
    views,                                           // null for image posts
    score: views ?? p.likesCount ?? 0,               // rank videos by views, images by likes
    owner: p.ownerUsername,
    videoUrl: p.videoUrl || null,                    // CDN link (expires in hours) — lets batch.js skip a paid re-fetch
  };
}

// stop early with a clear message instead of failing mid-run when the monthly cap is hit
async function checkBudget() {
  const res = await fetch(`${API}/users/me/limits?token=${TOKEN}`);
  if (!res.ok) return; // can't check, carry on
  const d = (await res.json()).data;
  const used = d.current?.monthlyUsageUsd ?? 0;
  const cap = d.limits?.maxMonthlyUsageUsd ?? Infinity;
  const resets = (d.monthlyUsageCycle?.endAt || "").slice(0, 10);
  console.log(`Apify budget: $${used.toFixed(2)} of $${cap} used this cycle (resets after ${resets})`);
  if (used + EST_RUN_COST_USD > cap) {
    throw new Error(`Apify monthly cap reached ($${used.toFixed(2)} of $${cap}). Pulls resume after ${resets}.`);
  }
}

(async () => {
  await checkBudget();

  const prevPath = path.join(__dirname, "..", "dashboard", "data.json");
  const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : null;
  const refreshMine =
    process.env.FULL_PULL === "1" || !prev?.me?.posts?.length || new Date().getUTCDay() === MY_POSTS_REFRESH_DAY;

  // 1) profile details (followers etc.) for me + competitors — one run
  const details = await runActor(
    {
      directUrls: [ME, ...COMPETITORS].map(igUrl),
      resultsType: "details",
      resultsLimit: 1,
    },
    "profile details (6 accounts)"
  );

  // 2) my full post history — high resultsLimit
  const myPostsRaw = refreshMine
    ? await runActor(
        { directUrls: [igUrl(ME)], resultsType: "posts", resultsLimit: MY_POST_LIMIT },
        `my posts (@${ME}, up to ${MY_POST_LIMIT})`
      )
    : null;
  if (!refreshMine) console.log(`\n↺ reusing my ${prev.me.posts.length} posts from last pull (full refresh on Sundays)`);

  // 3) competitors' recent posts
  const compPostsRaw = await runActor(
    {
      directUrls: COMPETITORS.map(igUrl),
      resultsType: "posts",
      resultsLimit: COMPETITOR_POST_LIMIT,
    },
    `competitor posts (${COMPETITORS.length} accounts × ${COMPETITOR_POST_LIMIT})`
  );

  const profileOf = (h) =>
    details.find((d) => (d.username || "").toLowerCase() === h.toLowerCase()) || {};

  const myPosts = myPostsRaw ? myPostsRaw.map(toPost).sort((a, b) => b.score - a.score) : prev.me.posts;
  const compPosts = compPostsRaw.map(toPost);

  const data = {
    pulledAt: new Date().toISOString(),
    me: {
      handle: ME,
      followers: profileOf(ME).followersCount ?? null,
      following: profileOf(ME).followsCount ?? null,
      totalPosts: profileOf(ME).postsCount ?? myPosts.length,
      totalViews: myPosts.reduce((s, p) => s + (p.views || 0), 0),
      totalLikes: myPosts.reduce((s, p) => s + p.likes, 0),
      totalComments: myPosts.reduce((s, p) => s + p.comments, 0),
      posts: myPosts,
    },
    competitors: COMPETITORS.map((h) => {
      const posts = compPosts
        .filter((p) => (p.owner || "").toLowerCase() === h.toLowerCase())
        .sort((a, b) => b.score - a.score);
      return {
        handle: h,
        followers: profileOf(h).followersCount ?? null,
        posts,
      };
    }),
  };

  const outPath = path.join(__dirname, "..", "dashboard", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
const jsPath = path.join(__dirname, "..", "dashboard", "data.js");
fs.writeFileSync(jsPath, "window.DATA = " + JSON.stringify(data, null, 2) + ";");

  // ---- human-readable summary ----
  console.log("\n================ RESULTS ================");
  console.log(`@${ME} — followers: ${data.me.followers}  posts: ${data.me.totalPosts}`);
  console.log(`total views (videos): ${data.me.totalViews.toLocaleString()}\n`);
  console.log("Your top 5 posts of all time:");
  myPosts.slice(0, 5).forEach((p, i) => {
    const metric = p.views != null ? `${p.views.toLocaleString()} views` : `${p.likes.toLocaleString()} likes`;
    console.log(`  ${i + 1}. [${metric}] ${p.url}\n     "${p.caption.slice(0, 80)}"`);
  });
  console.log("\nCompetitors:");
  data.competitors.forEach((c) =>
    console.log(`  @${c.handle}: ${c.followers ?? "?"} followers, ${c.posts.length} recent posts pulled`)
  );
  console.log(`\nSaved → dashboard/data.json`);
})().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exitCode = 1; // not process.exit(): avoids a Node-on-Windows crash with open sockets
});
