(function () {
  var ORDER = ["pratap-group", "telecrats", "beckhaul", "corsis", "ductel", "pratap-diesels", "pals", "voltters", "pratap-automobiles"];
  var STATUS = { ready: "p-ok", partial: "p-warn", none: "p-neu" };
  var GLYPH = { ok: "✓", part: "~", miss: "–" }, GLAB = { ok: "Have", part: "Partial", miss: "Missing" };
  var pub = null, locked = null, view = "companies", cur = null, tab = "overview", lastFocus = null, toastT, editing = null, confirmDel = null, filt = "all";
  var KEY = "pmh-kit-edits", edits = { styles: {}, assign: {} };
  try { var _e = JSON.parse(localStorage.getItem(KEY) || "null"); if (_e && _e.styles && _e.assign) edits = _e; } catch (e) {}
  function saveEdits() { try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch (e) {} }
  function dirty() { return Object.keys(edits.styles).length + Object.keys(edits.assign).length; }
  function STY() {
    var m = {}, k; for (k in pub.artstyles) m[k] = pub.artstyles[k];
    for (k in edits.styles) { if (edits.styles[k] === null) delete m[k]; else m[k] = edits.styles[k]; }
    return m;
  }
  function styleOf(id) { var b = pub.companies[id].artStyle; if (Object.prototype.hasOwnProperty.call(edits.assign, id)) b = edits.assign[id]; return b && STY()[b] ? b : null; }
  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "style"; }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function validHex(h) { return /^#[0-9A-Fa-f]{6}$/.test(h || ""); }
  function $(id) { return document.getElementById(id); }
  function co(id) { var c = Object.assign({}, pub.companies[id], locked && locked.companies[id]); c.artStyle = styleOf(id); return c; }
  function ids() {
    return Object.keys(pub.companies).sort(function (a, b) {
      var x = ORDER.indexOf(a), y = ORDER.indexOf(b); if (x < 0) x = 99; if (y < 0) y = 99; return x - y || a.localeCompare(b);
    });
  }
  function checks(c) {
    var cs = c.colors || [], valid = cs.filter(function (x) { return validHex(x.hex); }).length;
    var col = !cs.length ? "miss" : (valid === cs.length ? "ok" : (valid ? "part" : "miss"));
    function has(v) { return v && String(v).trim() ? "ok" : "miss"; }
    var open = (c.open || []).join(" ");
    var logo = has(c.logo); if (logo === "ok" && /logo/i.test(open)) logo = "part";
    var typ = has(c.typography); if (typ === "ok" && /working/i.test(c.typography)) typ = "part";
    var doc = c.source && !/^your notes/i.test(c.source) ? "ok" : "miss";
    var art = c.artStyle && STY()[c.artStyle] ? "ok" : "miss";
    return [["Logo files", logo], ["Colours", col], ["Typeface", typ], ["Tagline", has(c.tagline)], ["Imagery", has(c.imagery)], ["Layout", has(c.layout)], ["Voice", has(c.voice)], ["Guideline doc", doc], ["Art style", art]];
  }
  function score(c) { var ch = checks(c), pts = 0; ch.forEach(function (x) { pts += x[1] === "ok" ? 1 : x[1] === "part" ? .5 : 0; }); return { pts: pts, of: ch.length }; }

  function monogram(c) {
    var w = String(c.name || "?").replace(/^Pratap\s+/i, "").trim().split(/\s+/)[0];
    return '<span class="mono-logo" aria-hidden="true">' + esc(w.charAt(0).toUpperCase()) + '</span>';
  }
  function logoHtml(c) { return c.logoFile ? '<img src="' + esc(c.logoFile) + '?v=8" alt="' + esc(c.name) + ' logo" loading="lazy">' : monogram(c); }
  function swatches(c) { return (c.colors || []).filter(function (k) { return validHex(k.hex); }).slice(0, 4).map(function (k) { return '<i style="background:' + esc(k.hex) + '"></i>'; }).join(""); }

  /* ---------- views ---------- */
  function companiesView(list) {
    var u = !!locked;
    var cards = list.map(function (id) {
      var c = co(id), st = c.artStyle && STY()[c.artStyle], sc = score(c), sw = swatches(c);
      var meter = u ? '<div class="meter" title="' + sc.pts + ' of ' + sc.of + ' brand basics in place"><span style="width:' + Math.round(sc.pts / sc.of * 100) + '%"></span></div><small class="mtxt">' + (sc.pts % 1 ? sc.pts.toFixed(1) : sc.pts) + ' / ' + sc.of + ' basics</small>' : '';
      return '<button type="button" class="kcard" data-open="' + esc(id) + '"><div class="klogo">' + logoHtml(c) + '</div>' +
        '<div class="kbody"><h3>' + esc(c.name) + '</h3><p>' + esc(c.about || "Description not added yet.") + '</p></div>' +
        '<div class="kfoot">' + (sw ? '<span class="dots" aria-hidden="true">' + sw + '</span>' : '') + (st ? '<span class="chip">' + esc(st.name) + '</span>' : '<span class="chip off">No art style</span>') +
        '<span class="go" aria-hidden="true">Open →</span></div>' + (u ? '<div class="kprog">' + meter + '</div>' : '') + '</button>';
    }).join("");
    return '<p class="vhint">Pick a company to see its colours, fonts, art style and what is still missing.</p><div class="kgrid">' + cards + '</div>';
  }

  function rulesView() {
    var rules = pub.rules.concat(locked ? locked.rules : []).sort(function (a, b) { return a.order - b.order; });
    var out = '<p class="vhint">These apply to every post, for every company.</p><ol class="rcards">' + rules.map(function (r, i) {
      return '<li><span class="rnum">' + (i + 1) + '</span><div><p>' + esc(r.text) + '</p></div></li>';
    }).join("") + '</ol>';
    if (!locked) out += '<div class="lockhint">🔒 More rules appear once you enter the password above.</div>';
    return out;
  }

  function lookBg(st) { var l = st.look || ["#EAF3EF", "#1AB86B"]; return "linear-gradient(135deg," + l[0] + "," + l[1] + ")"; }
  function lines(t) { return String(t || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean); }
  function stylesView(list) {
    var all = STY(), u = !!locked, sids = Object.keys(all).sort(function (a, b) { return all[a].name.localeCompare(all[b].name); });
    var users = {}; list.forEach(function (k) { var sid = styleOf(k); if (sid) (users[sid] = users[sid] || []).push(k); });
    var used = sids.filter(function (i) { return users[i]; }).length;
    var shown = sids.filter(function (i) { return filt === "all" || (filt === "used" ? users[i] : !users[i]); });
    var bar = '<div class="sbar"><div class="seg" role="group" aria-label="Filter styles">' +
      [["all", "All " + sids.length], ["used", "In use " + used], ["free", "Not in use " + (sids.length - used)]].map(function (f) { return '<button type="button" data-filt="' + f[0] + '" aria-pressed="' + (filt === f[0]) + '">' + f[1] + '</button>'; }).join("") + '</div>' +
      (u ? '<button type="button" class="btn pri" data-new>＋ New style</button>' : '') + '</div>';
    var note = u ? '<p class="vhint">Each company uses one style at a time. Switch a company on under a style and it leaves its old one.</p>' : '<div class="lockhint">🔒 Enter the password above to add, edit, delete or assign art styles.</div>';
    var cards = shown.map(function (i) {
      var st = all[i], us = users[i] || [];
      var tg = list.map(function (k) {
        var on = styleOf(k) === i, c = pub.companies[k], other = !on && styleOf(k) ? all[styleOf(k)].name : "";
        return '<button type="button" class="tgl" role="switch" aria-checked="' + on + '"' + (u ? ' data-toggle="' + esc(i) + '|' + esc(k) + '"' : ' disabled') + ' title="' + esc(on ? "Remove from " + c.name : other ? "Switch " + c.name + " from " + other : "Use for " + c.name) + '"><span class="knob"></span><span class="tl">' + esc(c.name.replace(/\s+(Technologies|India)$/i, "")) + '</span></button>';
      }).join("");
      var det = '<details class="sdet"><summary>Do, avoid and prompt</summary>' +
        (st.bestFor ? '<p><b>Best for:</b> ' + esc(st.bestFor) + '</p>' : '') +
        (st.dos && st.dos.length ? '<div class="two"><div><h5>Do</h5><ul>' + st.dos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>' + (st.avoid && st.avoid.length ? '<div><h5>Avoid</h5><ul class="av">' + st.avoid.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>' : '') + '</div>' : '') +
        (st.prompt ? '<h5>Prompt template</h5><div class="pbox"><code>' + esc(st.prompt) + '</code><button type="button" class="btn sm" data-copy="' + esc(st.prompt) + '">Copy</button></div>' : '') + '</details>';
      var acts = u ? (confirmDel === i ? '<div class="del"><span>' + (us.length ? 'Used by ' + (us.length === 1 ? '1 company' : us.length + ' companies') + '. ' : '') + 'Delete this style?</span><button type="button" class="btn danger sm" data-del-yes="' + esc(i) + '">Yes, delete</button><button type="button" class="btn sm" data-del-no>Keep</button></div>'
        : '<div class="acts"><button type="button" class="btn sm" data-edit="' + esc(i) + '">Edit</button><button type="button" class="btn sm" data-dup="' + esc(i) + '">Duplicate</button><button type="button" class="btn sm ghost" data-del="' + esc(i) + '">Delete</button></div>') : '';
      return '<article class="scard' + (us.length ? ' inuse' : '') + '"><div class="slook" style="background:' + esc(lookBg(st)) + '"><span class="sbadge">' + (us.length ? 'In use · ' + us.length : 'Not in use') + '</span></div><div class="sbody"><h3>' + esc(st.name) + '</h3><p>' + esc(st.description) + '</p>' + det +
        '<div class="sub2">Use for</div><div class="tgls">' + tg + '</div>' + acts + '</div></article>';
    }).join("");
    var pend = dirty() ? '<div class="pend"><span><b>' + dirty() + ' change' + (dirty() > 1 ? 's' : '') + '</b> saved in this browser only.</span><button type="button" class="btn sm" data-export>Copy changes</button><button type="button" class="btn sm ghost" data-reset>Discard changes</button></div>' : '';
    return bar + note + pend + '<div class="sgrid">' + (cards || '<p class="hint">Nothing here.</p>') + '</div>';
  }

  function editorHtml() {
    var e = editing, st = e.data;
    var l = st.look || ["#EAF3EF", "#1AB86B"];
    return '<form class="edform" id="edform" novalidate><h2 id="edtitle">' + (e.isNew ? 'New art style' : 'Edit art style') + '</h2>' +
      '<label>Name<input name="name" required maxlength="60" value="' + esc(st.name) + '"></label>' +
      '<label>Description<textarea name="description" rows="3" maxlength="400">' + esc(st.description) + '</textarea></label>' +
      '<label>Best for<input name="bestFor" maxlength="160" value="' + esc(st.bestFor) + '"></label>' +
      '<div class="row2"><label>Do (one per line)<textarea name="dos" rows="4">' + esc((st.dos || []).join("\n")) + '</textarea></label><label>Avoid (one per line)<textarea name="avoid" rows="4">' + esc((st.avoid || []).join("\n")) + '</textarea></label></div>' +
      '<label>Prompt template <small>use {subject} for the topic</small><textarea name="prompt" rows="3">' + esc(st.prompt) + '</textarea></label>' +
      '<div class="row2"><label>Preview colour A<input type="color" name="c1" value="' + esc(l[0]) + '"></label><label>Preview colour B<input type="color" name="c2" value="' + esc(l[1]) + '"></label></div>' +
      '<p class="err" id="ederr" role="alert"></p><div class="edfoot"><button type="button" class="btn" data-ed-cancel>Cancel</button><button type="submit" class="btn pri">Save style</button></div></form>';
  }
  function openEditor(id, isNew, base) {
    var st = base ? JSON.parse(JSON.stringify(base)) : { name: "", description: "", bestFor: "", dos: [], avoid: [], prompt: "", look: ["#EAF3EF", "#1AB86B"] };
    editing = { id: id, isNew: isNew, data: st, last: document.activeElement };
    var m = $("modal"); m.innerHTML = editorHtml(); m.hidden = false; $("scrim").hidden = false;
    requestAnimationFrame(function () { document.body.classList.add("mopen"); m.querySelector("input").focus(); });
  }
  function closeEditor() {
    if (!editing) return; var l = editing.last; editing = null; document.body.classList.remove("mopen");
    setTimeout(function () { if (!editing) { $("modal").hidden = true; if (!cur) $("scrim").hidden = true; } }, 200);
    if (l && l.focus) try { l.focus({ preventScroll: true }); } catch (e) {}
  }

  function gapsView(list) {
    if (!locked) return '<div class="lockhint big">🔒 The gap table is private. Enter the password above to see what is missing for each company.</div>';
    var heads = checks({}).map(function (x) { return x[0]; }), total = 0;
    var rows = list.map(function (id) {
      var c = co(id), ch = checks(c), g = ch.filter(function (x) { return x[1] !== "ok"; }).length; total += g;
      return '<tr data-open="' + esc(id) + '" tabindex="0"><th scope="row"><span class="gl">' + logoHtml(c) + '</span>' + esc(c.name) + '</th>' + ch.map(function (x) {
        return '<td class="g-' + x[1] + '" title="' + esc(x[0] + ': ' + GLAB[x[1]]) + '"><span>' + GLYPH[x[1]] + '</span></td>';
      }).join("") + '<td class="gn">' + g + '</td></tr>';
    }).join("");
    return '<p class="vhint"><b>' + total + ' gaps</b> across ' + list.length + ' companies. Click a row to open that company.</p>' +
      '<div class="legend"><span class="g-ok">✓ Have</span><span class="g-part">~ Partial or provisional</span><span class="g-miss">– Missing</span></div>' +
      '<div class="scroll"><table class="gt"><thead><tr><th>Company</th>' + heads.map(function (t) { return '<th><span>' + esc(t) + '</span></th>'; }).join("") + '<th><span>Gaps</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function render() {
    var list = ids(), n = { ready: 0, partial: 0, none: 0 }, open = 0;
    if (locked) list.forEach(function (i) { var c = co(i); n[c.status in n ? c.status : "none"]++; open += (c.open || []).length; });
    function s(b, l, hot) { return '<div class="stat' + (hot ? ' hot' : '') + '"><b>' + b + '</b><span>' + l + '</span></div>'; }
    $("stats").innerHTML = locked ? s(n.ready, "kits ready") + s(n.partial, "partial") + s(n.none, "no kit yet", n.none > 0) + s(pub.rules.length + locked.rules.length, "group rules") + s(open, "open items")
      : s(list.length, "kits") + s(Object.keys(STY()).length, "art styles");
    var tabs = [["companies", "Companies", list.length], ["rules", "Group rules", pub.rules.length + (locked ? locked.rules.length : 0)], ["styles", "Art styles", Object.keys(STY()).length], ["gaps", "Gaps", locked ? null : "🔒"]];
    var nav = '<div class="vtabs" role="tablist" aria-label="Brand kit sections">' + tabs.map(function (t) {
      return '<button type="button" role="tab" class="vtab" data-view="' + t[0] + '" aria-selected="' + (view === t[0]) + '">' + t[1] + (t[2] != null ? '<small>' + t[2] + '</small>' : '') + '</button>';
    }).join("") + '</div>';
    var body = view === "rules" ? rulesView() : view === "styles" ? stylesView(list) : view === "gaps" ? gapsView(list) : companiesView(list);
    $("root").innerHTML = nav + '<div class="vpanel" role="tabpanel">' + body + '</div>';
    if (cur) renderDrawer();
  }

  /* ---------- drawer ---------- */
  function lockedLine(label) { return '<div class="blurbox"><div class="sec-sub">' + esc(label) + '</div><p class="blur" aria-hidden="true">Locked until the password is entered. Locked until the password is entered.</p></div>'; }
  function listHtml(items, empty) { return items && items.length ? '<ul class="todo">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' : '<p class="hint">' + empty + '</p>'; }
  function field(label, v) { return '<div class="fld"><dt>' + label + '</dt><dd>' + (v ? esc(v) : '<span class="unset">Not set yet</span>') + '</dd></div>'; }

  function panel(id, t) {
    var c = co(id), u = !!locked, st = c.artStyle && STY()[c.artStyle], out = "";
    if (t === "overview") {
      var cs = c.colors || [];
      out += '<h4>Colours</h4>' + (cs.length ? '<div class="swgrid">' + cs.map(function (k) {
        var ok = validHex(k.hex);
        return '<button type="button" class="swt"' + (ok ? ' data-copy="' + esc(k.hex.toUpperCase()) + '" title="Click to copy"' : ' disabled') + '><span class="swc" style="' + (ok ? 'background:' + esc(k.hex) : '') + '">' + (ok ? '' : 'No hex') + '</span><b>' + esc(k.name) + '</b><code>' + (ok ? esc(k.hex.toUpperCase()) : 'hex not set') + '</code>' + (k.role ? '<small>' + esc(k.role) + '</small>' : '') + '</button>';
      }).join("") + '</div>' : '<p class="hint">No colours recorded yet.</p>');
      out += '<h4>Brand basics</h4><dl class="flds">' + field("Typeface", c.typography) + field("Tagline", c.tagline) + field("Logo files", c.logo) + '</dl>';
    } else if (t === "visual") {
      var all = STY(), sids = Object.keys(all).sort(function (a, b) { return all[a].name.localeCompare(all[b].name); });
      out += '<h4>Art style in use</h4>' + (st ? '<div class="artbox"><div class="alook" style="background:' + esc(lookBg(st)) + '"></div><div><b>' + esc(st.name) + '</b><p>' + esc(st.description) + '</p></div></div>' : '<p class="hint">No art style chosen yet.</p>');
      out += u ? '<label class="pick">Change style<select data-assign="' + esc(id) + '"><option value="">No art style</option>' + sids.map(function (k) { return '<option value="' + esc(k) + '"' + (c.artStyle === k ? ' selected' : '') + '>' + esc(all[k].name) + '</option>'; }).join("") + '</select></label><p class="hint">One style per company. Choosing a new one replaces the old.</p>' : '<p class="hint">🔒 Enter the password to change the style.</p>';
      out += '<h4>Look and feel</h4><dl class="flds">' + field("Imagery", c.imagery) + field("Layout", c.layout) + '</dl>';
    } else if (t === "voice") {
      if (!u) return lockedLine("Voice and claims") + lockedLine("Rules for this company");
      out += '<h4>Voice and claims</h4>' + (c.voice ? '<p class="prose">' + esc(c.voice) + '</p>' : '<p class="hint">Not set yet.</p>');
      out += '<h4>Rules for this company</h4>' + listHtml(c.rules, "No company-specific rules recorded.");
    } else {
      if (!u) return lockedLine("What is still missing");
      var miss = checks(c).filter(function (x) { return x[1] !== "ok"; });
      out += '<h4>Still missing</h4>' + (miss.length ? '<ul class="todo">' + miss.map(function (x) { return '<li>' + esc(x[0]) + (x[1] === "part" ? ' <em>provisional</em>' : '') + '</li>'; }).join("") + '</ul>' : '<p class="hint">Nothing missing.</p>');
      out += '<h4>Open items</h4>' + listHtml(c.open, "No open items.") + (c.source ? '<p class="src">Source: ' + esc(c.source) + '</p>' : '');
    }
    return out;
  }

  function renderDrawer() {
    var id = cur, c = co(id), u = !!locked, list = ids(), i = list.indexOf(id), sc = score(c);
    var nopen = u ? checks(c).filter(function (x) { return x[1] !== "ok"; }).length : null;
    var tabs = [["overview", "Brand"], ["visual", "Visual"], ["voice", "Voice & rules"], ["todo", "To do" + (nopen != null ? " (" + nopen + ")" : "")]];
    var pill = u ? '<span class="pill ' + (STATUS[c.status] || "p-neu") + '">' + esc(c.statusNote || "") + '</span>' : '';
    $("drawer").innerHTML =
      '<div class="dhead"><div class="dnav"><button type="button" class="ibtn" data-step="-1" aria-label="Previous company">←</button><span class="dcount">' + (i + 1) + ' of ' + list.length + '</span><button type="button" class="ibtn" data-step="1" aria-label="Next company">→</button></div><button type="button" class="ibtn close" data-close aria-label="Close">✕</button></div>' +
      '<div class="dhero"><div class="dlogo">' + logoHtml(c) + '</div><div><h2 id="dtitle">' + esc(c.name) + '</h2>' + pill + '</div></div>' +
      '<p class="dabout">' + esc(c.about || "Description not added yet.") + '</p>' + (u && c.summary ? '<p class="dsum">' + esc(c.summary) + '</p>' : '') +
      '<div class="dtabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" class="dtab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join("") + '</div>' +
      '<div class="dbody" role="tabpanel">' + panel(id, tab) + '</div>';
  }

  function openCo(id, keepTab) {
    if (!pub.companies[id]) return;
    if (!cur) lastFocus = document.activeElement;
    cur = id; if (!keepTab) tab = "overview";
    renderDrawer();
    $("scrim").hidden = false; $("drawer").hidden = false;
    requestAnimationFrame(function () { document.body.classList.add("dopen"); var cb = $("drawer").querySelector(".close"); if (cb) cb.focus({ preventScroll: true }); });
    try { history.replaceState(null, "", "#" + id); localStorage.setItem("pmh-last", JSON.stringify({ url: "brand-kit.html#" + id, label: "Brand Kit · " + pub.companies[id].name })); } catch (e) {}
  }
  function closeCo() {
    if (!cur) return; cur = null; document.body.classList.remove("dopen");
    setTimeout(function () { if (!cur) { $("scrim").hidden = true; $("drawer").hidden = true; } }, 220);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }
  function copy(text, msg) {
    function ok() { toast(msg || (text.length > 24 ? "Copied" : "Copied " + text)); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { toast("Copy blocked by browser"); }); else toast("Copy not supported here");
  }

  document.addEventListener("click", function (e) {
    var el;
    if ((el = e.target.closest("[data-view]"))) { view = el.getAttribute("data-view"); render(); return; }
    if ((el = e.target.closest("[data-filt]"))) { filt = el.getAttribute("data-filt"); render(); return; }
    if (e.target.closest("[data-new]")) { openEditor(null, true); return; }
    if ((el = e.target.closest("[data-edit]"))) { var id1 = el.getAttribute("data-edit"); openEditor(id1, false, STY()[id1]); return; }
    if ((el = e.target.closest("[data-dup]"))) { var id2 = el.getAttribute("data-dup"), b2 = JSON.parse(JSON.stringify(STY()[id2])); b2.name += " copy"; openEditor(null, true, b2); return; }
    if ((el = e.target.closest("[data-del]"))) { confirmDel = el.getAttribute("data-del"); render(); return; }
    if (e.target.closest("[data-del-no]")) { confirmDel = null; render(); return; }
    if ((el = e.target.closest("[data-del-yes]"))) {
      var d = el.getAttribute("data-del-yes"); edits.styles[d] = null;
      Object.keys(pub.companies).forEach(function (k) { if (styleOf(k) === d) edits.assign[k] = null; });
      confirmDel = null; saveEdits(); render(); toast("Style deleted"); return;
    }
    if ((el = e.target.closest("[data-toggle]"))) {
      var pr = el.getAttribute("data-toggle").split("|"), sid = pr[0], cid = pr[1];
      if (styleOf(cid) === sid) { edits.assign[cid] = null; toast("Removed from " + pub.companies[cid].name); }
      else { edits.assign[cid] = sid; toast(pub.companies[cid].name + " now uses " + STY()[sid].name); }
      saveEdits(); render(); return;
    }
    if (e.target.closest("[data-ed-cancel]")) { closeEditor(); return; }
    if (e.target.closest("[data-reset]")) { edits = { styles: {}, assign: {} }; saveEdits(); render(); toast("Local changes discarded"); return; }
    if (e.target.closest("[data-export]")) {
      var out = { artstyles: STY(), assignments: {} }; Object.keys(pub.companies).forEach(function (k) { out.assignments[k] = styleOf(k); });
      copy(JSON.stringify(out, null, 2), "Changes copied. Paste them to Claude to make them permanent."); return;
    }
    if ((el = e.target.closest("[data-copy]"))) { copy(el.getAttribute("data-copy")); return; }
    if ((el = e.target.closest("[data-tab]"))) { tab = el.getAttribute("data-tab"); renderDrawer(); var t = $("drawer").querySelector('.dtab[aria-selected="true"]'); if (t) t.focus({ preventScroll: true }); return; }
    if ((el = e.target.closest("[data-step]"))) { var l = ids(), i = (l.indexOf(cur) + parseInt(el.getAttribute("data-step"), 10) + l.length) % l.length; cur = l[i]; renderDrawer(); $("drawer").scrollTop = 0; try { history.replaceState(null, "", "#" + cur); } catch (x) {} return; }
    if (e.target.id === "scrim" && editing) { closeEditor(); return; }
    if (e.target.closest("[data-close]") || e.target.id === "scrim") { closeCo(); return; }
    if ((el = e.target.closest("[data-open]"))) { openCo(el.getAttribute("data-open")); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && editing) { closeEditor(); return; }
    if (e.key === "Escape" && cur) { closeCo(); return; }
    if (cur && !editing && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      var b = $("drawer").querySelector('[data-step="' + (e.key === "ArrowRight" ? 1 : -1) + '"]'); if (b) b.click(); return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("tr[data-open]")) { e.preventDefault(); openCo(e.target.getAttribute("data-open")); }
    if (cur && e.key === "Tab") { // keep focus inside the drawer
      var f = $("drawer").querySelectorAll("button:not([disabled])"); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!$("drawer").contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  document.addEventListener("change", function (e) {
    var el = e.target.closest && e.target.closest("[data-assign]"); if (!el) return;
    var cid = el.getAttribute("data-assign"); edits.assign[cid] = el.value || null; saveEdits(); render(); toast(el.value ? STY()[el.value].name + " set" : "Art style removed");
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "edform") return; e.preventDefault();
    var f = e.target, v = function (n) { return f.elements[n].value.trim(); }, name = v("name");
    if (!name) { $("ederr").textContent = "Give the style a name."; f.elements.name.focus(); return; }
    var all = STY(), dupe = Object.keys(all).some(function (k) { return k !== editing.id && all[k].name.toLowerCase() === name.toLowerCase(); });
    if (dupe) { $("ederr").textContent = "A style with this name already exists."; return; }
    var id = editing.id; if (!id) { id = slug(name); while (all[id]) id += "-2"; }
    edits.styles[id] = { name: name, description: v("description"), bestFor: v("bestFor"), dos: lines(f.elements.dos.value), avoid: lines(f.elements.avoid.value), prompt: v("prompt"), look: [f.elements.c1.value, f.elements.c2.value] };
    saveEdits(); var wasNew = editing.isNew; closeEditor(); render(); toast(wasNew ? "Style added" : "Style updated");
  });

  fetch("data/brandkit.public.json").then(function (r) { return r.json(); }).then(function (d) {
    pub = d; render();
    var h = (location.hash || "").replace("#", "");
    if (h === "art" || h === "styles") { view = "styles"; render(); } else if (h === "rules") { view = "rules"; render(); } else if (h && pub.companies[h]) openCo(h);
    Lock.init({
      blobUrl: "data/brandkit.locked.json",
      onUnlock: function (text) { locked = JSON.parse(text); render(); },
      onLock: function () { locked = null; confirmDel = null; closeEditor(); if (view === "gaps") view = "companies"; render(); }
    });
  }).catch(function () { $("root").innerHTML = '<div class="empty">Could not load the brand kit data.</div>'; });
})();
