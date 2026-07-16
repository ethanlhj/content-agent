// scripts-panel.js — renders reel-to-script output as a Script desk section
(() => {
  const S = window.SCRIPTS || [];
  const host = document.getElementById("scripts");
  if (!host) return;

  const css = document.createElement("style");
  css.textContent = `
    .scripts{max-width:1160px;margin:16px auto;padding:0 28px 20px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .sc{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);box-shadow:var(--shadow-1);padding:18px 20px;transition:box-shadow var(--dur) var(--ease),border-color var(--dur) var(--ease),transform var(--dur) var(--ease)}
    .sc:hover{transform:translateY(-2px);box-shadow:var(--shadow-2);border-color:var(--color-secondary)}
    .sc .meta{font-family:var(--mono);font-size:11px;color:var(--color-text-2);letter-spacing:.05em}
    .sc .meta a{color:var(--color-primary);text-decoration:underline;text-underline-offset:2px}
    .sc h3{font-size:15px;font-weight:700;letter-spacing:-.01em;margin-top:8px;line-height:1.5;color:var(--color-text)}
    .sc .beats{margin-top:12px;border-top:1px solid var(--color-border);padding-top:12px;display:none}
    .sc.open .beats{display:block}
    .sc .beats p{font-size:13px;color:var(--color-text);line-height:1.6;margin:6px 0}
    .sc .beats p b{color:var(--color-primary);font-family:var(--mono);font-weight:600;margin-right:6px}
    .sc .cta{font-size:13px;color:var(--color-text-2);margin-top:8px}
    .sc .why{font-size:12px;color:var(--color-text-2);font-style:italic;margin-top:6px}
    .sc .actions{margin-top:14px;display:flex;gap:8px}
    .sc button{font-family:var(--mono);font-size:11px;font-weight:500;color:var(--color-text-2);border:1px solid var(--color-border);border-radius:8px;padding:6px 12px;background:none;cursor:pointer;letter-spacing:.05em;transition:border-color var(--dur) var(--ease),color var(--dur) var(--ease)}
    .sc button:hover{border-color:var(--color-primary);color:var(--color-primary)}
    .sc mark{background:var(--color-accent-soft);color:#92400E;padding:0 4px;border-radius:4px;font-weight:600}
    .sc-day{grid-column:1/-1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-heading);border-bottom:1px solid var(--color-border);padding-bottom:6px;margin-top:8px}
    @media(max-width:900px){.scripts{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mark = (s) => esc(s).replace(/\[VERIFY[^\]]*\]/g, "<mark>[VERIFY]</mark>");

  const count = document.getElementById("scripts-count");
  if (count) count.textContent = "Script desk · " + S.length + " ready to film";

  // S arrives pre-sorted from view.js: newest day first, best source reel first within each day
  const fmtN = (n) => (n == null ? "" : n.toLocaleString());
  let lastDay = null;
  host.innerHTML = S.length ? S.map((s, i) => {
    const day = s.day || (s.generatedAt || "").slice(0, 10);
    const header = day !== lastDay ? `<div class="sc-day">${esc(day)} · best to rip first</div>` : "";
    lastDay = day;
    const metric = s.sourceViews ? fmtN(s.sourceViews) + " views" : s.sourceLikes ? fmtN(s.sourceLikes) + " likes" : "";
    return header + `
    <div class="sc" id="sc-${i}">
      <div class="meta"><a href="${esc(s.sourceUrl)}" target="_blank" onclick="event.stopPropagation()">@${esc(s.handle)}</a>${metric ? ` · source: ${metric}` : ""}</div>
      <h3>${mark(s.hook)}</h3>
      <div class="beats">
        ${(s.beats || []).map((b, j) => `<p><b>${j + 1}</b>${mark(b)}</p>`).join("")}
        <p class="cta"><b>CTA</b>${mark(s.cta)}</p>
        <p class="why">${esc(s.whyOriginalWorked)}</p>
      </div>
      <div class="actions">
        <button onclick="event.stopPropagation();this.closest('.sc').classList.toggle('open');this.textContent=this.closest('.sc').classList.contains('open')?'COLLAPSE':'EXPAND'">EXPAND</button>
        <button onclick="event.stopPropagation();navigator.clipboard.writeText(this.dataset.full);this.textContent='COPIED ✓';setTimeout(()=>this.textContent='COPY SCRIPT',1200)" data-full="${esc(s.fullScript)}">COPY SCRIPT</button>
      </div>
    </div>`;
  }).join("")
  : `<div class="sc"><div class="meta">No scripts yet — next daily run fills this desk.</div></div>`;
})();

