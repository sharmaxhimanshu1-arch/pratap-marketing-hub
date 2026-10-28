(function () {
  var ORDER = ["pratap-group", "telecrats", "beckhaul", "corsis", "ductel", "pratap-diesels", "pals", "voltters", "pratap-automobiles"];
  var STATUS = { ready: "p-ok", partial: "p-warn", none: "p-neu" };
  var GLYPH = { ok: "✓", part: "~", miss: "–" }, GLAB = { ok: "Have", part: "Partial", miss: "Missing" };
  var pub = null, locked = null, view = "companies", cur = null, tab = "overview", lastFocus = null, toastT;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function validHex(h) { return /^#[0-9A-Fa-f]{6}$/.test(h || ""); }
  function $(id) { return document.getElementById(id); }
  function co(id) { return Object.assign({}, pub.companies[id], locked && locked.companies[id]); }
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
    var art = c.artStyle && pub.artstyles[c.artStyle] ? "ok" : "miss";
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
      var c = co(id), st = c.artStyle && pub.artstyles[c.artStyle], sc = score(c), sw = swatches(c);
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

  function stylesView(list) {
    var sids = Object.keys(pub.artstyles).sort(function (a, b) { return pub.artstyles[a].name.localeCompare(pub.artstyles[b].name); });
    return '<p class="vhint">The visual styles Claude can use for artwork. The companies using each style are shown on it.</p><div class="sgrid">' + sids.map(function (i) {
      var st = pub.artstyles[i], users = list.filter(function (k) { return pub.companies[k].artStyle === i; });
      return '<article class="scard"><h3>' + esc(st.name) + '</h3><p>' + esc(st.description) + '</p><div class="susers">' +
        (users.length ? users.map(function (k) { return '<button type="button" class="upill" data-open="' + esc(k) + '">' + esc(pub.companies[k].name) + '</button>'; }).join("") : '<span class="chip off">Not used yet</span>') + '</div></article>';
    }).join("") + '</div>';
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
      : s(list.length, "kits") + s(Object.keys(pub.artstyles).length, "art styles");
    var tabs = [["companies", "Companies", list.length], ["rules", "Group rules", pub.rules.length + (locked ? locked.rules.length : 0)], ["styles", "Art styles", Object.keys(pub.artstyles).length], ["gaps", "Gaps", locked ? null : "🔒"]];
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
    var c = co(id), u = !!locked, st = c.artStyle && pub.artstyles[c.artStyle], out = "";
    if (t === "overview") {
      var cs = c.colors || [];
      out += '<h4>Colours</h4>' + (cs.length ? '<div class="swgrid">' + cs.map(function (k) {
        var ok = validHex(k.hex);
        return '<button type="button" class="swt"' + (ok ? ' data-copy="' + esc(k.hex.toUpperCase()) + '" title="Click to copy"' : ' disabled') + '><span class="swc" style="' + (ok ? 'background:' + esc(k.hex) : '') + '">' + (ok ? '' : 'No hex') + '</span><b>' + esc(k.name) + '</b><code>' + (ok ? esc(k.hex.toUpperCase()) : 'hex not set') + '</code>' + (k.role ? '<small>' + esc(k.role) + '</small>' : '') + '</button>';
      }).join("") + '</div>' : '<p class="hint">No colours recorded yet.</p>');
      out += '<h4>Brand basics</h4><dl class="flds">' + field("Typeface", c.typography) + field("Tagline", c.tagline) + field("Logo files", c.logo) + '</dl>';
    } else if (t === "visual") {
      out += '<h4>Art style in use</h4>' + (st ? '<div class="artbox"><b>' + esc(st.name) + '</b><p>' + esc(st.description) + '</p></div>' : '<p class="hint">No art style chosen yet.</p>');
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
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
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
  function copy(text) {
    function ok() { toast("Copied " + text); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { toast(text); }); else toast(text);
  }

  document.addEventListener("click", function (e) {
    var el;
    if ((el = e.target.closest("[data-view]"))) { view = el.getAttribute("data-view"); render(); return; }
    if ((el = e.target.closest("[data-copy]"))) { copy(el.getAttribute("data-copy")); return; }
    if ((el = e.target.closest("[data-tab]"))) { tab = el.getAttribute("data-tab"); renderDrawer(); var t = $("drawer").querySelector('.dtab[aria-selected="true"]'); if (t) t.focus({ preventScroll: true }); return; }
    if ((el = e.target.closest("[data-step]"))) { var l = ids(), i = (l.indexOf(cur) + parseInt(el.getAttribute("data-step"), 10) + l.length) % l.length; cur = l[i]; renderDrawer(); $("drawer").scrollTop = 0; try { history.replaceState(null, "", "#" + cur); } catch (x) {} return; }
    if (e.target.closest("[data-close]") || e.target.id === "scrim") { closeCo(); return; }
    if ((el = e.target.closest("[data-open]"))) { openCo(el.getAttribute("data-open")); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && cur) { closeCo(); return; }
    if (cur && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
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

  fetch("data/brandkit.public.json").then(function (r) { return r.json(); }).then(function (d) {
    pub = d; render();
    var h = (location.hash || "").replace("#", ""); if (h && pub.companies[h]) openCo(h);
    Lock.init({
      blobUrl: "data/brandkit.locked.json",
      onUnlock: function (text) { locked = JSON.parse(text); render(); },
      onLock: function () { locked = null; if (view === "gaps") view = "companies"; render(); }
    });
  }).catch(function () { $("root").innerHTML = '<div class="empty">Could not load the brand kit data.</div>'; });
})();
