(function () {
  var ORDER = ["pratap-group", "telecrats", "beckhaul", "corsis", "ductel", "pratap-diesels", "pals", "voltters", "pratap-automobiles"];
  var STATUS = { ready: "p-ok", partial: "p-warn", none: "p-neu" };
  var FIELDS = [["logo", "Logo and signature"], ["tagline", "Tagline"], ["typography", "Typography"], ["imagery", "Imagery"], ["layout", "Layout"], ["voice", "Voice and claims"]];
  var GLYPH = { ok: "✓", part: "~", miss: "–" }, GLAB = { ok: "Have", part: "Partial", miss: "Missing" };
  var pub = null, locked = null, openIds = {};

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

  var FILLER = "Locked until the password is entered. Locked until the password is entered. Locked until the password is entered.";
  function lockedBlock(label) {
    return '<div class="blurbox"><div class="sec-sub">' + esc(label) + '</div><p class="blur" aria-hidden="true">' + FILLER + '</p></div>';
  }
  function list(items) { return items && items.length ? '<ul class="plain">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' : '<p class="hint">None recorded.</p>'; }

  function colorsView(c) {
    var cs = c.colors || [];
    if (!cs.length) return '<p class="hint">No colours recorded.</p>';
    return '<ul class="clist">' + cs.map(function (k) {
      var sw = validHex(k.hex) ? '<span class="sw" style="background:' + esc(k.hex) + '"></span>' : '<span class="sw" style="background:repeating-linear-gradient(45deg,#fff,#fff 3px,#eee 3px,#eee 6px)"></span>';
      return '<li><span>' + sw + '<b style="font-weight:600">' + esc(k.name) + '</b></span><span class="mono">' + (validHex(k.hex) ? esc(k.hex.toUpperCase()) : 'hex not set') + '</span>' + (k.role ? '<span class="role">' + esc(k.role) + '</span>' : '') + '</li>';
    }).join("") + '</ul>';
  }

  function artView(c) {
    var s = c.artStyle && pub.artstyles[c.artStyle];
    return s ? '<p class="hint"><b>' + esc(s.name) + '.</b> ' + esc(s.description) + '</p>' : '<p class="hint">No art style chosen yet.</p>';
  }

  function companyBody(id) {
    var c = co(id), u = !!locked, out = "";
    if (u) {
      var miss = checks(c).filter(function (x) { return x[1] !== "ok"; });
      out += '<div class="sec-sub">Still missing</div>' + (miss.length ? '<ul class="plain">' + miss.map(function (x) { return '<li>' + esc(x[0]) + (x[1] === "part" ? ' (provisional)' : '') + '</li>'; }).join("") + '</ul>' : '<p class="hint">Nothing missing.</p>');
    } else out += lockedBlock("Still missing");
    out += '<div class="sec-sub">Art style in use</div>' + artView(c) + '<div class="sec-sub">Colours</div>' + colorsView(c);
    out += '<div class="sec-sub">Details</div><dl class="guide">' + FIELDS.map(function (f) {
      if (f[0] === "voice" && !u) return '<dt>' + f[1] + '</dt><dd><span class="blur" aria-hidden="true">Locked until unlocked</span></dd>';
      return '<dt>' + f[1] + '</dt><dd>' + (c[f[0]] ? esc(c[f[0]]) : '<span style="color:var(--muted)">Not set</span>') + '</dd>';
    }).join("") + '</dl>';
    if (u) {
      out += '<div class="sec-sub">Rules for this company</div>' + list(c.rules) + '<div class="sec-sub">Open items</div>' + list(c.open) + (c.source ? '<p class="src">Source: ' + esc(c.source) + '</p>' : '');
    } else out += lockedBlock("Rules and open items");
    return out;
  }

  function sec(id, title, count, body, lead) {
    return '<details class="block sec" data-id="' + esc(id) + '"' + (openIds[id] ? ' open' : '') + '><summary><div class="block-h" style="width:100%"><h2>' + title + '</h2>' + (count ? '<span class="count">' + count + '</span>' : '') + '<span class="tog"></span></div></summary>' + (lead || "") + body + '</details>';
  }

  function gapsBody() {
    if (!locked) return lockedBlock("Gap table");
    var heads = checks({}).map(function (x) { return x[0]; }), gaps = 0, withGaps = 0, list = ids();
    var rows = list.map(function (id) {
      var c = co(id), ch = checks(c), g = ch.filter(function (x) { return x[1] !== "ok"; }).length; gaps += g; if (g) withGaps++;
      return '<tr><td><button class="linkbtn" data-goto="' + esc(id) + '">' + esc(c.name) + '</button></td>' + ch.map(function (x) {
        return '<td aria-label="' + esc(x[0] + ': ' + GLAB[x[1]]) + '" style="color:' + (x[1] === "miss" ? 'var(--crit)' : x[1] === "part" ? 'var(--warn)' : 'var(--ok)') + ';font-weight:600">' + GLYPH[x[1]] + '</td>';
      }).join("") + '<td class="mono">' + ((c.open || []).length) + '</td></tr>';
    }).join("");
    gapsBody.count = gaps + (gaps === 1 ? " gap" : " gaps") + " across " + withGaps + " of " + list.length;
    return '<div class="scroll"><table><thead><tr><th>Company</th>' + heads.map(function (t) { return '<th>' + esc(t) + '</th>'; }).join("") + '<th>Open items</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }


  function monogram(c) {
    var w = String(c.name || "?").replace(/^Pratap\s+/i, "").trim().split(/\s+/)[0];
    return '<span class="mono-logo" aria-hidden="true">' + esc(w.charAt(0).toUpperCase()) + '</span>';
  }
  function cardsHtml(list) {
    return '<div class="kgrid">' + list.map(function (id) {
      var c = pub.companies[id], st = c.artStyle && pub.artstyles[c.artStyle];
      var logo = c.logoFile ? '<img src="' + esc(c.logoFile) + '?v=8" alt="' + esc(c.name) + ' logo" loading="lazy">' : monogram(c);
      var note = c.logoFile ? '' : '<small class="nologo">Logo file not added yet</small>';
      return '<button type="button" class="kcard" data-goto="' + esc(id) + '"><div class="klogo">' + logo + '</div>' +
        '<h3>' + esc(c.name) + '</h3><p>' + esc(c.about || "Description not added yet.") + '</p>' +
        '<div class="kmeta">' + (st ? '<span class="chip">' + esc(st.name) + '</span>' : '<span class="chip off">No art style</span>') + note + '</div></button>';
    }).join("") + '</div>';
  }

  function render() {
    var list = ids(), n = { ready: 0, partial: 0, none: 0 }, open = 0;
    if (locked) list.forEach(function (i) { var c = co(i); n[c.status in n ? c.status : "none"]++; open += (c.open || []).length; });
    function s(b, l, hot) { return '<div class="stat' + (hot ? ' hot' : '') + '"><b>' + b + '</b><span>' + l + '</span></div>'; }
    $("stats").innerHTML = locked ? s(n.ready, "kits ready") + s(n.partial, "partial") + s(n.none, "no kit yet", n.none > 0) + s(pub.rules.length + locked.rules.length, "group rules") + s(open, "open items")
      : s(list.length, "kits") + s(Object.keys(pub.artstyles).length, "art styles");

    var gb = gapsBody();
    var html = cardsHtml(list) + sec("gaps", "What we have and what's missing", locked ? gapsBody.count : "", gb, locked ? '<p class="hint">✓ we have it · ~ partly or provisional · – missing. Click a company to open its kit.</p>' : "");

    var rules = pub.rules.concat(locked ? locked.rules : []).sort(function (a, b) { return a.order - b.order; });
    var rb = '<ul class="glist">' + rules.map(function (r) { return '<li><span>' + esc(r.text) + '</span><small>' + esc(r.tag) + '</small></li>'; }).join("") + (locked ? '' : '<li><span class="blur" aria-hidden="true">More rules are locked until the password is entered.</span></li>') + '</ul>';
    html += sec("grp", "Group rules", rules.length + (locked ? "" : "+") + " rules", rb, '<p class="hint">Apply to every post, for every company.</p>');

    var sids = Object.keys(pub.artstyles).sort(function (a, b) { return pub.artstyles[a].name.localeCompare(pub.artstyles[b].name); });
    var sb = '<ul class="glist">' + sids.map(function (i) {
      var st = pub.artstyles[i], users = list.filter(function (k) { return pub.companies[k].artStyle === i; }).map(function (k) { return pub.companies[k].name; });
      return '<li><span><b style="font-weight:600">' + esc(st.name) + '</b><br>' + esc(st.description) + (users.length ? '<br><small>In use: ' + esc(users.join(", ")) + '</small>' : '') + '</span></li>';
    }).join("") + '</ul>';
    html += sec("styles", "Art styles", sids.length + " styles", sb, '<p class="hint">The visual styles Claude can use for artwork. Each company\'s kit shows which one is in use now.</p>');

    html += list.map(function (id) {
      var c = co(id);
      var pill = locked ? '<span class="pill ' + (STATUS[c.status] || "p-neu") + '">' + esc(c.statusNote || "") + '</span>' : '';
      return sec("c-" + id, esc(c.name) + " " + pill, "", companyBody(id), locked && c.summary ? '<p class="lead">' + esc(c.summary) + '</p>' : '');
    }).join("");
    $("root").innerHTML = html;
  }

  document.addEventListener("toggle", function (e) { var t = e.target; if (t && t.dataset && t.dataset.id) openIds[t.dataset.id] = t.open; }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-goto]"); if (!b) return;
    var key = "c-" + b.getAttribute("data-goto"); openIds[key] = true;
    var el = document.querySelector('details[data-id="' + key + '"]'); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });

  fetch("data/brandkit.public.json").then(function (r) { return r.json(); }).then(function (d) {
    pub = d; render();
    Lock.init({
      blobUrl: "data/brandkit.locked.json",
      onUnlock: function (text) { locked = JSON.parse(text); render(); },
      onLock: function () { locked = null; render(); }
    });
  }).catch(function () { $("root").innerHTML = '<div class="empty">Could not load the brand kit data.</div>'; });
})();
