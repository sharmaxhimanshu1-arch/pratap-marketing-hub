/* Workflows page engine. Reads WF (assets/workflow-defs.js), renders the step map, the detail panel and the Pipeline.
   Progress lives in localStorage under "pmh-workflows". Nothing here talks to Claude: the page builds commands to copy. */
(function () {
  "use strict";
  var D = window.WF, KEY = "pmh-workflows", T = D.TOOLS;
  var STATE = load(), KIT = null;
  var ui = { funnel: 1, refs: [], saved: true };
  var WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.v === 1) { s.desc = s.desc || {}; s.runs = s.runs || {}; s.skip = s.skip || {}; return s; } } catch (e) {}
    return { v: 1, tab: "ideation", company: "voltters", desc: {}, runs: {}, skip: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(STATE)); ui.saved = true; } catch (e) { ui.saved = false; } }

  /* ---------- lookups ---------- */
  function company(id) { for (var i = 0; i < D.COMPANIES.length; i++) if (D.COMPANIES[i].id === id) return D.COMPANIES[i]; return D.COMPANIES[0]; }
  function wfById(id) { for (var i = 0; i < D.WORKFLOWS.length; i++) if (D.WORKFLOWS[i].id === id) return D.WORKFLOWS[i]; return null; }
  function stepById(wf, id) { for (var i = 0; i < wf.steps.length; i++) if (wf.steps[i].id === id) return wf.steps[i]; return null; }
  function peek(wfId, coId) { return STATE.runs[wfId + ":" + coId] || { done: {}, inputs: {}, checks: {} }; }
  function ensure(wfId, coId) { var k = wfId + ":" + coId; if (!STATE.runs[k]) STATE.runs[k] = { done: {}, inputs: {}, checks: {} }; return STATE.runs[k]; }
  function defaultDesc(coId) {
    var c = KIT && KIT.companies && KIT.companies[coId], a = c && c.about;
    return a && !/not added yet/i.test(a) ? a.replace(/\s+$/, "").replace(/\.$/, "") : "";
  }
  function descFor(coId) { return Object.prototype.hasOwnProperty.call(STATE.desc, coId) ? STATE.desc[coId] : defaultDesc(coId); }
  function ctx(wf, coId) { var r = peek(wf.id, coId); return { co: company(coId), inputs: r.inputs, desc: descFor(coId), run: r, wf: wf }; }
  function curIdx(wf, r) { for (var i = 0; i < wf.steps.length; i++) if (!r.done[wf.steps[i].id]) return i; return wf.steps.length; }
  function countDone(wf, r) { var n = 0; wf.steps.forEach(function (s) { if (r.done[s.id]) n++; }); return n; }
  function locked(step, r) { return !!(step.needs && !r.done[step.needs]); }

  /* pipeline chain for a company, honouring "skip ideation" */
  function chain(coId) {
    var out = [], skip = !!STATE.skip[coId];
    D.PIPELINE.phases.forEach(function (p) {
      if (skip && p.wf === "ideation") return;
      var wf = wfById(p.wf), r = peek(p.wf, coId);
      p.steps.forEach(function (sid) { var s = stepById(wf, sid); out.push({ wf: wf, step: s, phase: p, done: !!r.done[sid] }); });
    });
    return out;
  }
  function nextInChain(coId) { var c = chain(coId); for (var i = 0; i < c.length; i++) if (!c[i].done) return c[i]; return null; }
  function chainProgress(coId) { var c = chain(coId), n = 0; c.forEach(function (x) { if (x.done) n++; }); return { done: n, total: c.length }; }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("on"); }, 1800);
  }
  function copy(text) {
    function fb() {
      var a = document.createElement("textarea"); a.value = text; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(a); toast(ok ? "Copied" : "Copy failed. Select the text and copy it."); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, fb); else fb();
  }
  function who(list) {
    return '<span class="wf-tags">' + list.map(function (k) { var t = T[k]; return '<span class="who who-' + t.tone + '"><i></i>' + esc(t.name) + '</span>'; }).join("") + '</span>';
  }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/&lt;br\s*\/?&gt;/gi, "<br>"); }
  function isMobile() { return window.matchMedia && window.matchMedia("(max-width:860px)").matches; }

  /* ---------- header: tabs and company chips ---------- */
  function renderBar() {
    var tabs = [{ id: "ideation", n: "Post Ideas" }, { id: "creator", n: "Post Creator" }, { id: "pipeline", n: "Pipeline" }];
    $("wftabs").innerHTML = tabs.map(function (t) {
      return '<button class="wf-tab" role="tab" type="button" data-act="tab" data-tab="' + t.id + '" aria-selected="' + (STATE.tab === t.id) + '">' + esc(t.n) + (t.id === "pipeline" ? "<small>both</small>" : "") + '</button>';
    }).join("") + '<span class="wf-tab soon" aria-disabled="true" title="More workflows will be added here">+ Add workflow<small>soon</small></span>';
    $("wfco").innerHTML = D.COMPANIES.map(function (c) {
      var txt;
      if (STATE.tab === "pipeline") { var p = chainProgress(c.id); txt = p.done + "/" + p.total; }
      else { var wf = wfById(STATE.tab); txt = countDone(wf, peek(wf.id, c.id)) + "/" + wf.steps.length; }
      var k = KIT && KIT.companies && KIT.companies[c.id], logo = k && k.logoFile ? '<img src="' + esc(k.logoFile) + '?v=8" alt="">' : '<b>' + esc(c.name.replace(/^Pratap\s+/, "").charAt(0)) + '</b>';
      return '<button type="button" class="wf-chip" data-act="co" data-co="' + c.id + '" aria-pressed="' + (STATE.company === c.id) + '"><span class="wf-lg">' + logo + '</span>' + esc(c.name) + '<small>' + txt + '</small></button>';
    }).join("");
  }

  /* ---------- workflow view ---------- */
  function renderWorkflow(wf) {
    var coId = STATE.company, c = company(coId), r = peek(wf.id, coId);
    var idx = curIdx(wf, r), activeId = r.active && stepById(wf, r.active) ? r.active : (wf.steps[Math.min(idx, wf.steps.length - 1)].id);
    var done = countDone(wf, r), pct = Math.round(done / wf.steps.length * 100);
    var nodes = wf.steps.map(function (s, i) {
      var st = r.done[s.id] ? "done" : locked(s, r) ? "lock" : i === idx ? "cur" : "todo";
      var label = { done: "Done", lock: "Locked", cur: "Up next", todo: s.auto ? "Claude" : "To do" }[st];
      var dot = st === "done" ? "✓" : st === "lock" ? "🔒" : (i + 1);
      return '<li class="wf-node s-' + st + (s.id === activeId ? " is-active" : "") + '"><button type="button" data-act="open" data-step="' + s.id + '" aria-current="' + (s.id === activeId ? "step" : "false") + '">' +
        '<span class="wf-n">' + dot + '</span><span class="wf-nb"><b>' + esc(s.title) + '</b>' + who(s.who) + '</span><span class="wf-st">' + label + '</span></button></li>';
    }).join("");
    var step = stepById(wf, activeId);
    $("wfmain").innerHTML =
      '<section class="wf-intro"><p class="lead">' + esc(wf.blurb) + '</p><div class="wf-meta"><code class="wf-skill">' + esc(wf.skill) + '</code>' +
      '<span class="wf-prog" aria-label="' + done + ' of ' + wf.steps.length + ' steps done"><span class="meter"><span style="width:' + pct + '%"></span></span><span class="mtxt">' + esc(c.name) + ' · ' + done + ' of ' + wf.steps.length + ' steps</span></span>' +
      '<button type="button" class="btn" data-act="newrun">Start a new run</button></div></section>' +
      '<div class="wf-grid"><ol class="wf-map" aria-label="Steps">' + nodes + '</ol><div class="wf-panel" id="wfpanel">' + panelHtml(wf, step, r, c) + '</div></div>';
    afterPanel(wf, step);
  }

  function cmdBlock(label, tool, getter, disabled) {
    var id = ui.refs.length; ui.refs.push(getter);
    var t = T[tool];
    return '<div class="wf-cmd"><div class="wf-cmd-h"><span>' + esc(label) + '</span><span class="wf-cmd-a"><button type="button" class="btn primary" data-act="copy" data-ref="' + id + '"' + (disabled ? " disabled" : "") + '>Copy</button>' +
      (t && t.url ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(t.url) + '">Open ' + esc(t.name) + ' ↗</a>' : "") + '</span></div><pre class="wf-pre" data-pre="' + id + '" tabindex="0"></pre></div>';
  }

  function panelHtml(wf, s, r, c) {
    ui.refs = [];
    var i = wf.steps.indexOf(s), cx = ctx(wf, c.id), lk = locked(s, r), h = "";
    var toolLabel = { claude: "Paste into Claude", perplexity: "Paste into Perplexity", gemini: "Paste into Gemini" };
    h += '<div class="wf-ph"><span class="wf-step">Step ' + (i + 1) + ' of ' + wf.steps.length + '</span>' + who(s.who) +
      (s.auto ? '<span class="wf-badge">Claude does this on its own</span>' : "") + (s.optional ? '<span class="wf-badge dash">Optional</span>' : "") + (r.done[s.id] ? '<span class="wf-badge ok">Done</span>' : "") + '</div>';
    h += '<h2>' + esc(s.title) + '</h2><p class="wf-what">' + esc(s.what) + '</p>';
    if (lk) h += '<div class="note warn">Locked until you finish “' + esc(stepById(wf, s.needs).title) + '”. Approval comes before any asset work, so visuals are not wasted on a draft that changes.</div>';

    if (s.fields) {
      h += '<div class="wf-fields">' + s.fields.map(function (f) {
        var val = f.company ? descFor(c.id) : (cx.inputs[f.k] || "");
        if (f.type === "select") return '<label class="fld"><span>' + esc(f.label) + '</span><select data-f="' + f.k + '">' + f.options.map(function (o) { return '<option value="' + esc(o) + '"' + (o === val ? " selected" : "") + '>' + esc(o || "Not set") + '</option>'; }).join("") + '</select></label>';
        if (f.company) return '<label class="fld wide"><span>' + esc(f.label) + ' · saved for ' + esc(c.name) + '</span><textarea rows="2" data-cf="' + f.k + '" placeholder="' + esc(f.ph || "") + '">' + esc(val) + '</textarea></label>';
        return '<label class="fld"><span>' + esc(f.label) + '</span><input type="text" data-f="' + f.k + '" value="' + esc(val) + '" placeholder="' + esc(f.ph || "") + '"></label>';
      }).join("") + '</div>';
    }
    if (s.list) h += '<ul class="plain wf-list">' + s.list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    if (s.chips) h += '<div class="sec-sub">' + esc(s.chipsLabel) + '</div><div class="wf-chips">' + s.chips.map(function (x) { return '<span class="wf-cp">' + esc(x) + "</span>"; }).join("") + "</div>";
    if (s.chips2) h += '<div class="sec-sub">' + esc(s.chips2Label) + '</div><div class="wf-chips">' + s.chips2.map(function (x) { return '<span class="wf-cp">' + esc(x) + "</span>"; }).join("") + "</div>";
    if (s.widget) h += widgetHtml(s.widget, wf, s, r, c);

    if (s.command) {
      var lab = toolLabel[s.open] || "Command";
      h += cmdBlock(lab, s.open, function () { return s.command(ctx(wf, STATE.company)); }, lk);
    }
    if (s.saveAs) h += '<div class="wf-save"><span>Save the result in Drive as</span><code data-save>' + esc(s.saveAs(cx)) + '</code><button type="button" class="linkbtn" data-act="copysave">Copy name</button></div>';
    if (s.command2) h += cmdBlock(s.command2.label, "claude", function () { return s.command2.text(ctx(wf, STATE.company)); }, lk);
    if (s.paste) {
      h += '<label class="fld wide"><span>' + esc(s.paste.label) + '</span><textarea rows="5" data-f="' + s.paste.k + '" placeholder="' + esc(s.paste.ph || "") + '">' + esc(cx.inputs[s.paste.k] || "") + '</textarea></label>';
      h += cmdBlock("Hand it back to Claude", "claude", function () { return s.handback(ctx(wf, STATE.company)); }, lk);
    }
    if (s.stop) h += '<div class="note crit">' + esc(s.stop.replace("{company}", c.name)) + '</div>';
    if (s.checks) {
      h += '<div class="wf-checks">' + s.checks.map(function (k) {
        var key = s.id + "." + k.k;
        return '<label class="wf-chk"><input type="checkbox" data-chk="' + key + '"' + (r.checks[key] ? " checked" : "") + (lk ? " disabled" : "") + '><span>' + esc(k.label) + '</span></label>';
      }).join("") + '</div>';
    }
    if (s.links) h += '<div class="wf-links">' + s.links.map(function (l) { return '<a class="btn" target="_blank" rel="noopener" href="' + esc(l.url) + '">' + esc(l.label) + ' ↗</a>'; }).join("") + '</div>';
    if (s.note) h += '<p class="wf-note">' + esc(s.note) + '</p>';

    var prev = wf.steps[i - 1], next = wf.steps[i + 1];
    h += '<div class="wf-foot-nav"><button type="button" class="btn" data-act="open" data-step="' + (prev ? prev.id : s.id) + '"' + (prev ? "" : " disabled") + '>← Back</button>';
    if (s.checks) h += '<span class="muted wf-auto">Completes when every box is ticked.</span>';
    else h += '<button type="button" class="btn ' + (r.done[s.id] ? "" : "primary") + '" data-act="done" data-step="' + s.id + '"' + (lk ? " disabled" : "") + '>' + (r.done[s.id] ? "Mark as not done" : s.auto ? "Got it, continue" : s.optional ? "Done or skip, continue" : "Mark done, continue") + '</button>';
    h += '<button type="button" class="btn" data-act="open" data-step="' + (next ? next.id : s.id) + '"' + (next ? "" : " disabled") + '>Next →</button></div>';
    return h;
  }

  function fillRefs() {
    ui.refs.forEach(function (g, i) { var el = document.querySelector('[data-pre="' + i + '"]'); if (el) el.textContent = g(); });
  }
  function afterPanel(wf, step) {
    fillRefs();
    if (step && step.widget === "ideacards") renderCards();
  }

  /* ---------- widgets ---------- */
  var FUNNEL = [
    { n: "100", w: 100, label: "Ideas", sub: "Distinct, across every LinkedIn format and content pillar", items: ["Each one traces back to a research finding with a source URL", "No invented statistics, customer names or engagement numbers", "The same post in two formats counts once"] },
    { n: "35 to 40", w: 66, label: "Pass the gates", sub: "Pass or fail", items: ["Buyer relevance", "Factual defensibility", "Brand safety", "Not a duplicate of the calendar, Notion or the Idea Bank", "Operating rules: no filming at sites or factories, no stock photos, animated or screen-recorded video only, one verified number per post"] },
    { n: "about 12", w: 42, label: "Top scored", sub: "1 to 5 on three criteria, with a reason for each", items: ["Engagement potential for the format (an estimate)", "Ease of producing solo, with no designer or videographer", "Differentiation and credibility", "Banked carry-overs are scored too and must beat fresh ideas"] },
    { n: "5", w: 24, label: "Final five", sub: "After a deep check", items: ["Verify the claims each idea relies on", "Search whether a competitor already owns the angle", "Confirm the data or assets exist", "Pre-mortem: why might it flop?", "Portfolio rules, so the five are not the same thing"] }
  ];

  function widgetHtml(name, wf, s, r, c) {
    var h = "";
    if (name === "funnel") {
      h += '<div class="wf-fun" role="group" aria-label="Funnel from 100 ideas to 5">' + FUNNEL.map(function (f, i) {
        return '<button type="button" class="wf-fb' + (i === ui.funnel ? " on" : "") + '" style="--w:' + f.w + '%" data-act="fun" data-i="' + i + '" aria-pressed="' + (i === ui.funnel) + '"><b>' + esc(f.n) + '</b><span>' + esc(f.label) + '</span></button>';
      }).join("") + '</div>';
      var f = FUNNEL[ui.funnel];
      h += '<div class="wf-fd"><div class="sec-sub">' + esc(f.label) + ' · ' + esc(f.sub) + '</div><ul class="plain">' + f.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    } else if (name === "ideacards") {
      var cx = ctx(wf, c.id);
      h += '<label class="fld wide"><span>Paste Claude\'s top-5 table here (copy it from the chat)</span><textarea rows="4" data-f="table" placeholder="| # | Idea and hook | Format and poster | Pillar | ...">' + esc(cx.inputs.table || "") + '</textarea></label><div id="wfcards" class="wf-cards"></div>';
    } else if (name === "picks") {
      var rows = parseTable(peek("ideation", c.id).inputs.table || ""), picks = peek("ideation", c.id).picks || [];
      if (picks.length && rows.length) {
        h += '<div class="sec-sub">Your picks</div><ul class="wf-picks">' + picks.map(function (p) { var x = rows[p]; return x ? "<li><b>" + (x.rank || p + 1) + "</b> " + esc(x.title) + (x.format ? ' <span class="muted">' + esc(plain(x.format)) + "</span>" : "") + "</li>" : ""; }).join("") + "</ul>";
      } else h += '<p class="wf-note">Pick favourites in “Review the top 5” and they will be listed here.</p>';
    } else if (name === "postingdays") {
      h += '<div class="sec-sub">' + esc(c.name) + ' posting days · sheet tab “' + esc(c.tab) + '”</div><div class="wf-week">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        return '<span class="wf-day' + (c.days.indexOf(d) > -1 ? " on" : "") + '">' + WEEK[d] + "</span>";
      }).join("") + '</div><p class="wf-note">Claude takes the earliest free posting day from tomorrow (India time), skipping dates already in the tab. Posting days come from the Weekly Posting Frequency page in Notion; if they have changed, tell Claude.</p>';
    } else if (name === "brandstatus") {
      var k = KIT && KIT.companies && KIT.companies[c.id];
      if (!KIT) h += '<p class="wf-note">Loading the hub\'s brand data…</p>';
      else if (!k) h += '<p class="wf-note">The hub has no brand data for ' + esc(c.name) + ' yet.</p>';
      else {
        var cols = (k.colors || []).filter(function (x) { return /^#[0-9a-f]{6}$/i.test(x.hex || ""); });
        h += '<div class="wf-brand"><div class="wf-sw">' + cols.slice(0, 8).map(function (x) { return '<i style="background:' + esc(x.hex) + '" title="' + esc(x.name) + '"></i>'; }).join("") + '</div><ul class="wf-bl">' +
          row(cols.length > 0, "Colours", cols.length ? cols.length + " defined" : "none yet") + row(!!k.logoFile, "Logo file", k.logoFile ? "on the hub" : "missing") +
          row(!!k.typography, "Typography", k.typography || "missing") + row(!!k.artStyle, "Art style", k.artStyle || "not chosen") + '</ul>' +
          '<a class="btn" href="brand-kit.html#' + esc(c.id) + '">Open ' + esc(c.name) + ' in the Brand Kit</a></div><p class="wf-note">This is what the hub holds. Claude reads the brand kit folder in Drive, so both should agree.</p>';
      }
    } else if (name === "draftformat") {
      var fmt = (peek(wf.id, c.id).inputs.format || "");
      var F = [
        { id: "Carousel", t: "Carousel", d: "Slide-by-slide copy, with a one-line visual idea per slide." },
        { id: "Single static post (infographic)", t: "Static post or infographic", d: "Headline, supporting copy and data points, plus the layout idea." },
        { id: "Video", t: "Video", d: "A short scene-by-scene script with on-screen text and voiceover or caption lines." }
      ];
      h += '<div class="sec-sub">What the draft contains. Click one to set the format.</div><div class="wf-fmts">' + F.map(function (f) {
        return '<button type="button" class="wf-fm' + (f.id === fmt ? " on" : "") + '" data-act="fmt" data-v="' + esc(f.id) + '" aria-pressed="' + (f.id === fmt) + '"><b>' + esc(f.t) + '</b><span>' + esc(f.d) + '</span></button>';
      }).join("") + '</div><p class="wf-note">Every number must trace back to the research. No caption or hashtags yet.</p>';
    } else if (name === "geminiflow") {
      h += '<div class="wf-gf"><div class="wf-gm"><b>1 · Master prompt</b><span>Fixes the style for every asset: palette and mood from the brand kit, illustration or photo style, lighting, composition. Avoid: text inside images, logos, distorted hardware.</span></div>' +
        '<div class="wf-ga" aria-hidden="true">→</div><div class="wf-gs"><b>2 · One follow-up per asset</b><span>Run each in the same Gemini chat, labelled by slide or element.</span><div class="wf-chips"><span class="wf-cp">Slide 1</span><span class="wf-cp">Slide 2</span><span class="wf-cp">Slide 3</span><span class="wf-cp">…</span></div></div>' +
        '<div class="wf-ga" aria-hidden="true">→</div><div class="wf-gm"><b>3 · Review</b><span>You send the assets back. Claude says which to regenerate and why, before building.</span></div></div>';
    }
    return h;
    function row(ok, k2, t) { return '<li class="' + (ok ? "ok" : "miss") + '"><span>' + (ok ? "✓" : "–") + "</span><b>" + esc(k2) + "</b> " + esc(t) + "</li>"; }
  }

  /* ---------- Idea table parsing and cards ---------- */
  function plain(s) { return String(s || "").replace(/\*\*/g, "").replace(/<br\s*\/?>/gi, " "); }
  function splitRow(l) { l = l.trim().replace(/^\|/, "").replace(/\|$/, ""); return l.split("|").map(function (x) { return x.trim(); }); }
  function parseTable(txt) {
    var lines = String(txt || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean), rows;
    var pipes = lines.filter(function (l) { return l.charAt(0) === "|"; });
    if (pipes.length >= 2) rows = pipes.map(splitRow);
    else { rows = lines.filter(function (l) { return l.indexOf("\t") > -1; }).map(function (l) { return l.split("\t").map(function (x) { return x.trim(); }); }); }
    if (rows.length < 2) return [];
    rows = rows.filter(function (r) { return !r.every(function (x) { return /^:?-{2,}:?$/.test(x); }); });
    var head = rows[0].map(function (x) { return x.toLowerCase(); });
    function col(re, dflt) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return dflt; }
    var m = { rank: col(/^#|rank/, 0), idea: col(/idea|hook/, 1), format: col(/format|poster/, 2), pillar: col(/pillar/, 3), why: col(/why/, 4), score: col(/score/, 5), plan: col(/production|plan/, 6), need: col(/needed|before/, 7), risk: col(/risk/, 8) };
    return rows.slice(1).filter(function (r) { return r.length >= 3; }).map(function (r, n) {
      var idea = r[m.idea] || "", mt = idea.match(/\*\*(.+?)\*\*/), title = mt ? mt[1] : idea.split(/[.:\n]/)[0], hook = mt ? idea.replace(mt[0], "").replace(/^[\s:.\-–—]+/, "") : idea.slice(title.length).replace(/^[\s:.]+/, "");
      var nums = (r[m.score] || "").replace(/<br\s*\/?>/gi, " ").match(/\d+(\.\d+)?/g) || [];
      var sc = nums.slice(0, 3).map(Number), total = nums[3] != null ? Number(nums[3]) : sc.reduce(function (a, b) { return a + b; }, 0);
      return { rank: (r[m.rank] || "").replace(/\D/g, "") || String(n + 1), title: plain(title).trim(), hook: hook, format: r[m.format], pillar: r[m.pillar], why: r[m.why], sc: sc.length === 3 ? sc : null, total: total, plan: r[m.plan], need: r[m.need], risk: r[m.risk] };
    });
  }
  function renderCards() {
    var box = $("wfcards"); if (!box) return;
    var r = peek("ideation", STATE.company), rows = parseTable(r.inputs.table || ""), picks = r.picks || [];
    if (!(r.inputs.table || "").trim()) { box.innerHTML = '<p class="wf-note">No table yet. Once Claude shows the top 5, paste it above and each idea appears as a card.</p>'; return; }
    if (!rows.length) { box.innerHTML = '<div class="note warn">That did not look like a table. Copy the whole table from Claude, including the header row.</div>'; return; }
    var L = ["Engagement", "Ease", "Difference"];
    box.innerHTML = rows.map(function (x, i) {
      var bars = x.sc ? '<div class="wf-sc">' + x.sc.map(function (n, j) { return '<span><em>' + L[j] + '</em><u><i style="width:' + Math.min(100, n / 5 * 100) + '%"></i></u><b>' + n + '</b></span>'; }).join("") + '<strong>' + x.total + ' / 15</strong></div>' : "";
      return '<article class="wf-card' + (picks.indexOf(i) > -1 ? " pick" : "") + '"><header><span class="wf-rk">' + esc(x.rank) + '</span><div><h3>' + esc(x.title) + '</h3>' + (x.hook ? '<p class="wf-hook">' + rich(x.hook) + '</p>' : "") + '</div></header>' +
        '<div class="wf-chips">' + (x.format ? '<span class="wf-cp">' + rich(x.format) + '</span>' : "") + (x.pillar ? '<span class="wf-cp">' + rich(x.pillar) + '</span>' : "") + '</div>' + bars +
        (x.why ? '<p><b>Why it should work</b> ' + rich(x.why) + '</p>' : "") + (x.plan ? '<p><b>Production</b> ' + rich(x.plan) + '</p>' : "") + (x.need ? '<p><b>Needed first</b> ' + rich(x.need) + '</p>' : "") + (x.risk ? '<p class="wf-risk"><b>Main risk</b> ' + rich(x.risk) + '</p>' : "") +
        '<div class="wf-ca"><button type="button" class="btn' + (picks.indexOf(i) > -1 ? " primary" : "") + '" data-act="pick" data-i="' + i + '" aria-pressed="' + (picks.indexOf(i) > -1) + '">' + (picks.indexOf(i) > -1 ? "★ Picked" : "☆ Pick") + '</button>' +
        '<button type="button" class="btn" data-act="copytext" data-text="' + esc("Give me Gemini briefs for idea #" + x.rank + " (" + x.title + ") for " + company(STATE.company).name + ".") + '">Copy Gemini brief request</button></div></article>';
    }).join("");
  }

  /* ---------- Pipeline view ---------- */
  function renderPipeline() {
    var coId = STATE.company, c = company(coId), skip = !!STATE.skip[coId], ch = chain(coId), pr = chainProgress(coId), nx = nextInChain(coId), pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
    var h = '<section class="wf-intro"><p class="lead">' + esc(D.PIPELINE.blurb) + '</p><div class="wf-meta"><span class="wf-prog"><span class="meter"><span style="width:' + pct + '%"></span></span><span class="mtxt">' + esc(c.name) + ' · ' + pr.done + ' of ' + pr.total + ' steps</span></span>' +
      '<label class="wf-chk inline"><input type="checkbox" data-act="skip"' + (skip ? " checked" : "") + '><span>The calendar already has a pending topic for ' + esc(c.name) + ', start at the Post Creator</span></label></div></section>';

    h += '<ol class="wf-track" aria-label="Pipeline phases">';
    D.PIPELINE.phases.forEach(function (p, pi) {
      var wf = wfById(p.wf), r = peek(p.wf, coId), off = skip && p.wf === "ideation", dn = 0;
      p.steps.forEach(function (sid) { if (r.done[sid]) dn++; });
      var full = !off && dn === p.steps.length, deg = Math.round(dn / p.steps.length * 360);
      h += '<li class="wf-ph-c' + (off ? " off" : "") + (full ? " full" : "") + (nx && nx.phase === p ? " now" : "") + '"><div class="wf-ring" style="--deg:' + (off ? 0 : deg) + 'deg"><span>' + (off ? "–" : dn + "/" + p.steps.length) + '</span></div>' +
        '<b>' + esc(p.name) + '</b><span class="wf-ws">' + esc(wf.name) + (off ? " · skipped" : "") + '</span><div class="wf-dots">' + p.steps.map(function (sid) {
          var st = stepById(wf, sid);
          return '<button type="button" class="wf-d' + (r.done[sid] && !off ? " d" : "") + (nx && nx.step === st && nx.wf === wf ? " n" : "") + '" data-act="goto" data-wf="' + wf.id + '" data-step="' + sid + '" title="' + esc(st.title) + '" aria-label="' + esc(wf.name + ": " + st.title) + '"></button>';
        }).join("") + '</div></li>';
      var ho = D.PIPELINE.handoffs.filter(function (x) { return x.after === p.steps[p.steps.length - 1] && x.after !== "present"; })[0];
      if (pi < D.PIPELINE.phases.length - 1) h += '<li class="wf-arrow" aria-hidden="true">' + (ho && !off ? '<span title="' + esc(ho.text) + '">⇢</span>' : "→") + '</li>';
    });
    h += '</ol><div class="wf-handoffs">' + D.PIPELINE.handoffs.map(function (x) { return '<p><span>Hand-off</span> ' + esc(x.text) + '</p>'; }).join("") + '</div>';

    if (nx) {
      var cx = ctx(nx.wf, coId), lk = locked(nx.step, peek(nx.wf.id, coId));
      h += '<section class="wf-next" aria-label="Next action"><div class="wf-ph"><span class="wf-step">Next move</span>' + who(nx.step.who) + '<span class="wf-ws">' + esc(nx.wf.name) + '</span></div><h2>' + esc(nx.step.title) + '</h2><p class="wf-what">' + esc(nx.step.what) + '</p>';
      ui.refs = [];
      if (lk) h += '<div class="note warn">Locked until “' + esc(stepById(nx.wf, nx.step.needs).title) + '” is done.</div>';
      else if (nx.step.command) h += cmdBlock({ claude: "Paste into Claude", perplexity: "Paste into Perplexity", gemini: "Paste into Gemini" }[nx.step.open] || "Command", nx.step.open, function () { return nx.step.command(ctx(nx.wf, STATE.company)); }, false);
      else if (nx.step.auto) h += '<p class="wf-note">Claude handles this on its own. Open the step to confirm when it is finished.</p>';
      h += '<div class="wf-foot-nav"><button type="button" class="btn primary" data-act="goto" data-wf="' + nx.wf.id + '" data-step="' + nx.step.id + '">Open this step →</button></div></section>';
    } else {
      h += '<section class="wf-next ok"><h2>' + esc(c.name) + ' is all done</h2><p class="wf-what">Every step is finished for this run.</p><div class="wf-foot-nav"><button type="button" class="btn primary" data-act="nextrun">Start the next post</button></div></section>';
    }

    h += '<div class="sh-lite"><h2>Across companies</h2><p class="hint">Click a company to switch to it.</p></div><ul class="wf-all">' + D.COMPANIES.map(function (k) {
      var p = chainProgress(k.id), n = nextInChain(k.id), w = p.total ? Math.round(p.done / p.total * 100) : 0;
      return '<li><button type="button" data-act="co" data-co="' + k.id + '" class="' + (k.id === coId ? "on" : "") + '"><b>' + esc(k.name) + '</b><span class="meter"><span style="width:' + w + '%"></span></span><em>' + p.done + '/' + p.total + '</em><span class="wf-nx">' + (n ? "Next: " + esc(n.step.title) : "All done") + '</span></button></li>';
    }).join("") + '</ul>';
    $("wfmain").innerHTML = h;
    fillRefs();
  }

  /* ---------- main render ---------- */
  function render() {
    if (STATE.tab !== "pipeline" && !wfById(STATE.tab)) STATE.tab = "ideation";
    renderBar();
    if (STATE.tab === "pipeline") renderPipeline(); else renderWorkflow(wfById(STATE.tab));
    $("wfstate").textContent = ui.saved ? "Progress saves in this browser only." : "This browser can't save progress (private window?). It will reset when you leave.";
    try {
      var wfn = STATE.tab === "pipeline" ? "Pipeline" : wfById(STATE.tab).name;
      localStorage.setItem("pmh-last", JSON.stringify({ url: "workflows.html#" + STATE.tab, label: "Workflows · " + wfn + " (" + company(STATE.company).name + ")" }));
    } catch (e) {}
    if (location.hash.slice(1).split("/")[0] !== STATE.tab) { try { history.replaceState(null, "", "#" + STATE.tab); } catch (e) {} }
  }

  /* ---------- state changes ---------- */
  function setActive(wfId, stepId) { var r = ensure(wfId, STATE.company); r.active = stepId; save(); }
  function markDone(wf, stepId, val) {
    var r = ensure(wf.id, STATE.company); if (val) r.done[stepId] = true; else delete r.done[stepId];
    if (val) { var i = curIdx(wf, r); r.active = i < wf.steps.length ? wf.steps[i].id : stepId; } save(); toast(val ? "Step done" : "Step reopened");
  }
  function go(wfId, stepId) {
    STATE.tab = wfId; if (stepId) setActive(wfId, stepId); save(); render();
    window.scrollTo({ top: document.getElementById("wfbar").offsetTop - 12, behavior: "smooth" });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b || b.tagName === "INPUT") return;
    var a = b.getAttribute("data-act"), wf = wfById(STATE.tab);
    if (a === "tab") { STATE.tab = b.getAttribute("data-tab"); save(); render(); }
    else if (a === "co") { STATE.company = b.getAttribute("data-co"); save(); render(); }
    else if (a === "open") { var sid = b.getAttribute("data-step"); if (wf) { setActive(wf.id, sid); render(); if (isMobile()) { var p = $("wfpanel"); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); } } }
    else if (a === "goto") go(b.getAttribute("data-wf"), b.getAttribute("data-step"));
    else if (a === "done") { var s = b.getAttribute("data-step"), r = peek(wf.id, STATE.company); markDone(wf, s, !r.done[s]); render(); }
    else if (a === "copy") { var g = ui.refs[+b.getAttribute("data-ref")]; if (g) copy(g()); }
    else if (a === "copysave") { var el = document.querySelector("[data-save]"); if (el) copy(el.textContent); }
    else if (a === "copytext") copy(b.getAttribute("data-text"));
    else if (a === "fun") { ui.funnel = +b.getAttribute("data-i"); render(); }
    else if (a === "fmt") { var rr = ensure(wf.id, STATE.company); rr.inputs.format = b.getAttribute("data-v"); save(); render(); }
    else if (a === "pick") {
      var r2 = ensure("ideation", STATE.company), i = +b.getAttribute("data-i"); r2.picks = r2.picks || [];
      var at = r2.picks.indexOf(i); if (at > -1) r2.picks.splice(at, 1); else r2.picks.push(i); save(); renderCards();
    }
    else if (a === "newrun") {
      if (confirm("Start a new " + wf.name + " run for " + company(STATE.company).name + "? This clears its steps and pasted text.")) { delete STATE.runs[wf.id + ":" + STATE.company]; save(); render(); toast("New run started"); }
    }
    else if (a === "nextrun") {
      if (confirm("Start the next post for " + company(STATE.company).name + "? This clears both workflows for the company.")) { delete STATE.runs["ideation:" + STATE.company]; delete STATE.runs["creator:" + STATE.company]; save(); render(); toast("Ready for the next post"); }
    }
  });

  function onInput(e) {
    var t = e.target, wf = wfById(STATE.tab);
    if (t.hasAttribute("data-f") && wf) {
      ensure(wf.id, STATE.company).inputs[t.getAttribute("data-f")] = t.value; save(); fillRefs();
      if (t.getAttribute("data-f") === "table") renderCards();
      if (t.getAttribute("data-f") === "format") render();
    } else if (t.hasAttribute("data-cf")) { STATE.desc[STATE.company] = t.value; save(); fillRefs(); }
  }
  document.addEventListener("input", onInput);
  document.addEventListener("change", function (e) {
    var t = e.target, wf = wfById(STATE.tab);
    if (t.getAttribute("data-act") === "skip") { STATE.skip[STATE.company] = t.checked; save(); render(); return; }
    if (t.hasAttribute("data-chk") && wf) {
      var key = t.getAttribute("data-chk"), sid = key.split(".")[0], r = ensure(wf.id, STATE.company), s = stepById(wf, sid);
      r.checks[key] = t.checked;
      var all = s.checks.every(function (k) { return r.checks[sid + "." + k.k]; });
      if (all && !r.done[sid]) markDone(wf, sid, true); else if (!all && r.done[sid]) { delete r.done[sid]; r.active = sid; save(); }
      save(); render();
    }
  });
  $("wfexport").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(STATE, null, 2)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "pratap-workflows-progress.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  });
  $("wfreset").addEventListener("click", function () {
    if (confirm("Reset all workflow progress and pasted text in this browser?")) { STATE = { v: 1, tab: STATE.tab, company: STATE.company, desc: {}, runs: {}, skip: {} }; save(); render(); toast("Progress reset"); }
  });
  window.addEventListener("hashchange", function () { var h = location.hash.slice(1).split("/")[0]; if ((h === "pipeline" || wfById(h)) && h !== STATE.tab) { STATE.tab = h; save(); render(); } });

  /* ---------- boot ---------- */
  var h0 = location.hash.slice(1).split("/")[0]; if (h0 === "pipeline" || wfById(h0)) STATE.tab = h0;
  if (!D.COMPANIES.some(function (c) { return c.id === STATE.company; })) STATE.company = "voltters";
  render();
  fetch("data/brandkit.public.json").then(function (r) { return r.json(); }).then(function (d) { KIT = d; render(); }).catch(function () {});
})();
