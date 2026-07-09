// app.js — renders the dashboard from window.DATA + AGENTS. Plain DOM, no frameworks.
(() => {
  const D = window.DATA, me = D.me;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? "—" : n.toLocaleString());
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // stamp
  $("stamp").textContent = "last pull " + new Date(D.pulledAt).toLocaleString();

  // ---- tape: every post as a ticker ----
  const ticks = (me.posts || []).filter((p) => p.score > 0).map((p) => {
    const code = (p.url || "").split("/p/")[1]?.replace("/", "") || p.id;
    const metric = p.views != null ? fmt(p.views) + " views" : fmt(p.likes) + " likes";
    return `<span class="tick"><b>${esc(code)}</b> ${metric} <span class="up">▲</span></span>`;
  }).join("");
  $("tape").innerHTML = ticks + ticks; // doubled for seamless loop

  // ---- stat strip ----
  const top = (me.posts || [])[0];
  const engRate = me.totalViews ? ((me.totalLikes + me.totalComments) / me.totalViews * 100).toFixed(1) + "%" : "—";
  const stats = [
    { lbl: "Followers", val: fmt(me.followers), sub: `@${me.handle} · ${fmt(me.totalPosts)} posts`, click: null },
    { lbl: "Top post", val: top && top.views != null ? fmt(top.views) : "—", sub: top ? esc(top.caption.slice(0, 48)) : "", click: top ? top.url : null },
    { lbl: "Total views", val: fmt(me.totalViews), sub: `across ${(me.posts || []).filter((p) => p.views).length} videos`, click: null },
    { lbl: "Engagement", val: engRate, sub: `${fmt(me.totalLikes)} likes · ${fmt(me.totalComments)} comments`, click: null },
  ];
  $("stats").innerHTML = stats.map((s) => `
    <div class="stat${s.click ? " link" : ""}" ${s.click ? `role="link" tabindex="0" aria-label="${s.lbl}: open top post" onclick="window.open('${s.click}','_blank')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.open('${s.click}','_blank')}"` : ""}>
      <div class="lbl">${s.lbl}</div><div class="val">${s.val}</div><div class="sub">${s.sub}</div>
    </div>`).join("");

  // ---- agent cards ----
  const order = ["ideator", "hookscript", "planner", "analyst", "dm"];
  $("agents").innerHTML = order.map((k) => {
    const a = AGENTS[k];
    return `<div class="agent" data-k="${k}" role="button" tabindex="0" aria-label="View ${a.name} output">
      <div class="top"><h3>${a.name}</h3><div class="dot" aria-hidden="true"></div></div>
      <div class="role">${a.role}</div>
      <div class="metrics">${a.metrics.map(([mk, mv]) => `<div class="m"><span class="k">${mk}</span><span class="v">${mv}</span></div>`).join("")}</div>
      <div class="open">View output →</div>
    </div>`;
  }).join("");

  // ---- drill-down ----
  const panel = $("panel");
  const openPanel = (el) => {
      const a = AGENTS[el.dataset.k];
      panel.innerHTML = `<button class="close" onclick="this.parentElement.classList.remove('on')">CLOSE ✕</button>
        <h2>${a.name} — output</h2>
        <div class="body">${a.rows.map((r) => `
          <div class="row"><div class="h">${r.h}${r.tag ? `<span class="tag">${r.tag}</span>` : ""}</div>
          <div class="d">${r.d}</div>${r.pre ? `<pre>${esc(r.pre)}</pre>` : ""}</div>`).join("")}</div>`;
      panel.classList.add("on");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };
  document.querySelectorAll(".agent").forEach((el) => {
    el.addEventListener("click", () => openPanel(el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPanel(el); }
    });
  });
})();
