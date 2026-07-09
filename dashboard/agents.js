// agents.js — computes what each of the 5 agents "produced", purely from window.DATA.
// No invented numbers: every metric traces back to the real Apify pull.

const AGENTS = (() => {
  const D = window.DATA;
  const me = D.me, comps = D.competitors || [];
  const fmt = (n) => (n == null ? "—" : n.toLocaleString());
  const themeOf = (cap) => (cap || "").split("#")[0].trim().slice(0, 70) || "(no caption)";

  // breakout factor = views relative to that account's followers (what over-performed)
  const compBreakouts = comps.flatMap((c) =>
    (c.posts || []).filter((p) => p.views).map((p) => ({
      ...p, handle: c.handle, factor: c.followers ? p.views / c.followers : 0,
    }))
  ).sort((a, b) => b.factor - a.factor);

  const myTop = (me.posts || []).filter((p) => p.score > 0).slice(0, 5);

  // ---------- 1 · IDEATOR ----------
  const ideas = [
    ...compBreakouts.slice(0, 5).map((p) => ({
      title: themeOf(p.caption),
      why: `Broke out at @${p.handle}: ${fmt(p.views)} views on ${fmt(null) === "—" && p.factor ? (p.factor).toFixed(1) + "× their follower count" : "strong reach"}. Your angle: same topic, show your actual position/math.`,
      src: p.url, tag: "competitor breakout",
    })),
    ...myTop.slice(0, 3).map((p) => ({
      title: "Sequel: " + themeOf(p.caption),
      why: `Your own proven winner (${fmt(p.views)} views). Follow-up: what happened since, updated numbers.`,
      src: p.url, tag: "double down",
    })),
  ];

  // ---------- 2 · HOOK & SCRIPT ----------
  const hooks = ideas.slice(0, 3).map((idea, i) => ({
    idea: idea.title,
    hookLines: [
      `nobody's talking about this yet — ${idea.title.toLowerCase()}`,
      `i put real money on this. here's the math.`,
      `this chart is why i'm not sleeping tonight`,
    ],
    script:
`HOOK (0-3s): cold open on the chart / number
CONTEXT (3-15s): what happened, one sentence, no jargon
THE MATH (15-40s): actual dollars, actual %, screen-record the position
TAKE (40-55s): what I'm doing about it (educational, not advice)
CTA (55-60s): "full breakdown in my group — link in bio"`,
  }));

  // ---------- 3 · PLANNER ----------
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const formats = ["Reel", "Reel", "Carousel", "Reel", "Reel", "Story poll", "Reel"];
  const calendar = days.map((d, i) => ({
    day: d, format: formats[i],
    slot: "7:00 PM ET",
    idea: ideas[i % ideas.length] ? ideas[i % ideas.length].title : "open slot",
  }));

  // ---------- 4 · ANALYST ----------
  const viewsPosts = (me.posts || []).filter((p) => p.views);
  const avgViews = viewsPosts.length ? Math.round(me.totalViews / viewsPosts.length) : null;
  const engRate = me.totalViews ? ((me.totalLikes + me.totalComments) / me.totalViews * 100) : null;
  const topShare = me.totalViews && myTop[0] ? Math.round(myTop[0].views / me.totalViews * 100) : null;
  const viewsPerFollower = me.followers ? (me.totalViews / me.followers) : null;
  const findings = [
    { h: "Views are concentrated", d: `Your #1 post carries ${topShare ?? "—"}% of all-time views. Replicate its format before experimenting.` },
    { h: "Reach outpunches size", d: `${fmt(me.totalViews)} views on ${fmt(me.followers)} followers = ${viewsPerFollower ? viewsPerFollower.toFixed(0) : "—"}× views-per-follower. The algorithm already likes you; consistency is the bottleneck.` },
    { h: "Competitor gap", d: comps.map((c) => `@${c.handle} ${fmt(c.followers)}`).join(" · ") + ". Their scale ≠ their hit rate — chase breakout factor, not follower count." },
  ];

  // ---------- 5 · DM MANAGER ----------
  const dmTemplates = [
    { h: "\u201cWhat do you think of $XYZ?\u201d", d: "quick take: i only share full breakdowns in the group so it stays educational — but short version: check revenue trend + margins first. what made you look at it?" },
    { h: "\u201cWhat broker do you use?\u201d", d: "i use [broker]. honestly for starting out, lowest fees + fractional shares matter more than the app. want my beginner checklist?" },
    { h: "Collab / promo request", d: "appreciate it! send over your audience stats + what you have in mind and i'll take a look this week." },
    { h: "\u201cShould I buy…?\u201d (advice line)", d: "can't tell you what to buy — not advice, and honestly nobody serious will. i can show you HOW i analyse it though. start here: [top post link]" },
  ];

  return {
    ideator: {
      name: "Ideator", role: "Scouts breakouts across your niche",
      metrics: [["ideas queued", ideas.length], ["accounts scanned", comps.length + 1], ["breakouts found", compBreakouts.length]],
      rows: ideas.map((i) => ({ h: i.title, tag: i.tag, d: i.why + (i.src ? ` — <a href="${i.src}" target="_blank">source</a>` : "") })),
    },
    hookscript: {
      name: "Hook & Script", role: "Writes hooks + 60s scripts in your voice",
      metrics: [["hooks drafted", hooks.length * 3], ["scripts ready", hooks.length]],
      rows: hooks.map((h) => ({ h: h.idea, tag: "3 hooks + script", d: h.hookLines.map((l) => "• " + l).join("<br>"), pre: h.script })),
    },
    planner: {
      name: "Planner", role: "Builds the daily calendar",
      metrics: [["days planned", 7], ["reels this week", formats.filter((f) => f === "Reel").length]],
      rows: calendar.map((c) => ({ h: `${c.day} — ${c.format}`, tag: c.slot, d: c.idea })),
    },
    analyst: {
      name: "Analyst", role: "Tracks what's working, flags what's dying",
      metrics: [["avg views/video", avgViews ? avgViews.toLocaleString() : "—"], ["eng. rate", engRate ? engRate.toFixed(1) + "%" : "—"], ["top-post share", topShare != null ? topShare + "%" : "—"]],
      rows: findings.map((f) => ({ h: f.h, tag: "finding", d: f.d })),
    },
    dm: {
      name: "DM Manager", role: "Drafts replies — never auto-sends",
      metrics: [["templates ready", dmTemplates.length], ["auto-send", "OFF"]],
      rows: dmTemplates.map((t) => ({ h: t.h, tag: "draft reply", d: t.d })),
    },
  };
})();
