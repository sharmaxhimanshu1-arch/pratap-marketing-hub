(function () {
  var COMPANIES = ["Telecrats India", "Beckhaul Technologies", "Corsis Technologies", "Ductel", "Pratap Diesels", "PALS", "Voltters", "Pratap Automobiles"];
  var KEY = "pmh-analytics-v1";
  var data = {}, sample = false, openIds = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Math.round(n).toLocaleString("en-IN"); }
  function num(v) { if (v == null || v === "") return 0; var n = Number(String(v).replace(/[,%\s]/g, "")); return isFinite(n) ? n : 0; }
  function poss(n) { return /s$/i.test(n) ? n + "\u2019" : n + "\u2019s"; }
  function dstr(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

  function save() { if (sample) return; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function load() { try { var s = localStorage.getItem(KEY); if (s) data = JSON.parse(s) || {}; } catch (e) {} }

  /* ---------- reading LinkedIn exports ---------- */
  function toDate(v) {
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number" && v > 30000 && v < 80000) return new Date(Math.round((v - 25569) * 86400 * 1000));
    var m = String(v || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) { var a = +m[1], b = +m[2]; return a > 12 ? new Date(+m[3], b - 1, a) : new Date(+m[3], a - 1, b); }
    var t = Date.parse(v); return isNaN(t) ? null : new Date(t);
  }
  function norm(h) { return String(h || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function findHeader(rows, test) {
    for (var i = 0; i < Math.min(rows.length, 8); i++) { var hs = (rows[i] || []).map(norm); if (test(hs)) return i; }
    return -1;
  }
  function pick(hs, base) {
    var opts = [base + " (total)", base, base + " (organic)"];
    for (var i = 0; i < opts.length; i++) { var k = hs.indexOf(opts[i]); if (k >= 0) return k; }
    return -1;
  }
  function col(r, k) { return k >= 0 ? num(r[k]) : null; }

  function readWorkbook(wb) {
    var out = { daily: [], posts: [], followers: [], found: [] };
    wb.SheetNames.forEach(function (name) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
      var low = name.toLowerCase();
      var hi;
      // Page-level daily metrics
      hi = findHeader(rows, function (hs) { return hs.indexOf("date") >= 0 && hs.some(function (h) { return /^impressions/.test(h); }) && hs.indexOf("post title") < 0; });
      if (hi >= 0) {
        var hs = rows[hi].map(norm), di = hs.indexOf("date");
        var ci = { imp: pick(hs, "impressions"), uni: pick(hs, "unique impressions"), clk: pick(hs, "clicks"), rea: pick(hs, "reactions"), com: pick(hs, "comments"), rep: pick(hs, "reposts") };
        rows.slice(hi + 1).forEach(function (r) {
          var d = toDate(r[di]); if (!d) return;
          out.daily.push({ t: d.getTime(), imp: col(r, ci.imp) || 0, clk: col(r, ci.clk), rea: col(r, ci.rea), com: col(r, ci.com), rep: col(r, ci.rep) });
        });
        if (out.daily.length) out.found.push("daily metrics");
      }
      // Post-level
      hi = findHeader(rows, function (hs) { return hs.indexOf("post title") >= 0 || hs.indexOf("post link") >= 0; });
      if (hi >= 0) {
        var ph = rows[hi].map(norm);
        var idx = function (re) { for (var i = 0; i < ph.length; i++) if (re.test(ph[i])) return i; return -1; };
        var c = { title: idx(/^post title/), link: idx(/^post link/), date: idx(/^created date|^post date/), imp: pick(ph, "impressions"), clk: pick(ph, "clicks"), rea: ph.indexOf("likes") >= 0 ? ph.indexOf("likes") : pick(ph, "reactions"), com: pick(ph, "comments"), rep: pick(ph, "reposts") };
        rows.slice(hi + 1).forEach(function (r) {
          if (!r[c.title] && !r[c.link]) return;
          var d = c.date >= 0 ? toDate(r[c.date]) : null;
          out.posts.push({ title: String(r[c.title] || "").slice(0, 140), link: String(r[c.link] || ""), t: d ? d.getTime() : null, imp: col(r, c.imp) || 0, clk: col(r, c.clk) || 0, rea: col(r, c.rea) || 0, com: col(r, c.com) || 0, rep: col(r, c.rep) || 0 });
        });
        if (out.posts.length) out.found.push("posts");
      }
      // Followers
      if (/follower/.test(low) && !/location|industry|function|seniority|company size/.test(low)) {
        hi = findHeader(rows, function (hs) { return hs.indexOf("date") >= 0; });
        if (hi >= 0) {
          var fh = rows[hi].map(norm), fd = fh.indexOf("date");
          var ft = fh.indexOf("total followers"); if (ft < 0) ft = fh.indexOf("organic followers");
          rows.slice(hi + 1).forEach(function (r) { var d = toDate(r[fd]); if (d && ft >= 0) out.followers.push({ t: d.getTime(), n: num(r[ft]) }); });
          if (out.followers.length) out.found.push("new followers");
        }
      }
    });
    return out;
  }

  function merge(company, parsed) {
    var c = data[company] || { daily: [], posts: [], followers: [] };
    if (parsed.daily.length) c.daily = parsed.daily;
    if (parsed.posts.length) c.posts = parsed.posts;
    if (parsed.followers.length) c.followers = parsed.followers;
    c.daily.sort(function (a, b) { return a.t - b.t; });
    data[company] = c;
  }

  /* ---------- working out the numbers ---------- */
  function sum(arr, f) { return arr.reduce(function (s, x) { return s + (f(x) || 0); }, 0); }
  function trendWords(a, b) {
    if (!a && !b) return null;
    if (!a) return "new";
    var p = (b - a) / a * 100;
    if (Math.abs(p) < 5) return "about the same";
    return (p > 0 ? "up " : "down ") + Math.round(Math.abs(p)) + "%";
  }

  function stats(c) {
    var s = { has: false };
    var d = c.daily || [], p = c.posts || [], f = c.followers || [];
    if (d.length) {
      s.has = true; s.days = d.length; s.from = d[0].t; s.to = d[d.length - 1].t;
      s.imp = sum(d, function (x) { return x.imp; });
      var hasEng = d.some(function (x) { return x.clk != null || x.rea != null || x.com != null || x.rep != null; });
      if (hasEng) s.eng = sum(d, function (x) { return (x.clk || 0) + (x.rea || 0) + (x.com || 0) + (x.rep || 0); });
      s.com = sum(d, function (x) { return x.com; }); s.rep = sum(d, function (x) { return x.rep; }); s.rea = sum(d, function (x) { return x.rea; }); s.clk = sum(d, function (x) { return x.clk; });
      var h = Math.floor(d.length / 2);
      if (d.length >= 6) {
        s.impTrend = trendWords(sum(d.slice(0, h), function (x) { return x.imp; }), sum(d.slice(h), function (x) { return x.imp; }));
      }
    } else if (p.length) {
      s.has = true;
      s.imp = sum(p, function (x) { return x.imp; });
      s.eng = sum(p, function (x) { return x.clk + x.rea + x.com + x.rep; });
      s.com = sum(p, function (x) { return x.com; });
    }
    if (p.length) {
      s.posts = p.length;
      var ts = p.map(function (x) { return x.t; }).filter(Boolean);
      if (ts.length > 1) { var span = (Math.max.apply(null, ts) - Math.min.apply(null, ts)) / 86400000 + 1; s.perWeek = p.length / Math.max(span / 7, 1); }
      s.avgViews = sum(p, function (x) { return x.imp; }) / p.length;
      s.top = p.slice().sort(function (a, b) { return b.imp - a.imp; }).slice(0, 3);
      s.topEng = p.filter(function (x) { return x.imp >= 100; }).map(function (x) { return { p: x, r: (x.clk + x.rea + x.com + x.rep) / x.imp }; }).sort(function (a, b) { return b.r - a.r; })[0];
      s.commentsPerPost = sum(p, function (x) { return x.com; }) / p.length;
      var dow = {}, dn = {};
      p.forEach(function (x) { if (!x.t) return; var k = new Date(x.t).getDay(); dow[k] = (dow[k] || 0) + x.imp; dn[k] = (dn[k] || 0) + 1; });
      var best = null; Object.keys(dow).forEach(function (k) { if (dn[k] >= 3) { var av = dow[k] / dn[k]; if (!best || av > best.av) best = { k: +k, av: av, n: dn[k] }; } });
      if (best && p.length >= 12) s.bestDay = best;
    }
    if (f.length) {
      s.followersNew = sum(f, function (x) { return x.n; });
      f.sort(function (a, b) { return a.t - b.t; });
      if (f.length >= 6) { var hf = Math.floor(f.length / 2); s.fTrend = trendWords(sum(f.slice(0, hf), function (x) { return x.n; }), sum(f.slice(hf), function (x) { return x.n; })); }
    }
    s.rate = s.imp && s.eng != null ? s.eng / s.imp : null;
    return s;
  }

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function per100(rate) { var v = rate * 100; return v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ""); }

  function explain(name, s) {
    var out = [];
    if (s.from) out.push("Between " + dstr(new Date(s.from)) + " and " + dstr(new Date(s.to)) + " (" + s.days + " days), " + esc(poss(name)) + " content was shown " + fmt(s.imp) + " times.");
    else out.push(esc(poss(name)) + " posts were shown " + fmt(s.imp) + " times in total.");
    if (s.rate != null) out.push("That led to " + fmt(s.eng) + " reactions, comments, shares or link clicks, which is about " + per100(s.rate) + " for every 100 views.");
    if (s.impTrend) out.push(s.impTrend === "about the same" ? "Views stayed about the same in the second half of this period compared with the first half." : s.impTrend === "new" ? "Views only started in the second half of this period." : "Views were " + s.impTrend + " in the second half of this period compared with the first half.");
    if (s.posts) out.push("There were " + s.posts + (s.posts === 1 ? " post" : " posts") + (s.perWeek ? ", roughly " + (s.perWeek >= 10 ? Math.round(s.perWeek) : s.perWeek.toFixed(1)) + " a week" : "") + ". An average post was seen about " + fmt(s.avgViews) + " times" + (s.commentsPerPost != null ? " and drew about " + (s.commentsPerPost >= 10 ? Math.round(s.commentsPerPost) : s.commentsPerPost.toFixed(1)) + " comments." : "."));
    if (s.topEng && s.posts >= 3) out.push("The post that made the best use of its views (" + per100(s.topEng.r) + " reactions, comments, shares or clicks per 100 views) was: “" + esc(s.topEng.p.title || "untitled post") + "”.");
    if (s.bestDay) out.push("Posts published on " + DAYS[s.bestDay.k] + " were seen the most on average (" + fmt(s.bestDay.av) + " views, from " + s.bestDay.n + " posts). With this few posts it is a hint, not a rule.");
    if (s.followersNew != null) out.push(fmt(s.followersNew) + " new followers joined" + (s.fTrend ? (s.fTrend === "about the same" ? ", about the same pace in both halves of the period." : s.fTrend === "new" ? ", all in the second half." : ", " + s.fTrend + " in the second half compared with the first.") : "."));
    var missing = [];
    if (!s.posts) missing.push("post-level numbers (the posts export)");
    if (s.followersNew == null) missing.push("follower numbers");
    if (missing.length) out.push('<span class="muted">Not uploaded yet: ' + missing.join(" and ") + ".</span>");
    return out;
  }

  function chart(c) {
    var d = c.daily || []; if (d.length < 2) return "";
    var W = 640, H = 120, max = Math.max.apply(null, d.map(function (x) { return x.imp; })) || 1, bw = W / d.length;
    var bars = d.map(function (x, i) { var h = Math.max(1, x.imp / max * (H - 8)); return '<rect x="' + (i * bw + 0.5).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + Math.max(bw - 1, 1).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="url(#g)"><title>' + esc(dstr(new Date(x.t)) + ": " + fmt(x.imp) + " views") + '</title></rect>'; }).join("");
    return '<div class="sec-sub">Views per day</div><div class="scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:420px;height:auto;display:block" role="img" aria-label="Bar chart of views per day. Busiest day ' + fmt(max) + ' views."><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1AB86B"/><stop offset="1" stop-color="#0E9AC1"/></linearGradient></defs>' + bars + '</svg></div><p class="hint">Each bar is one day. The tallest bar is ' + fmt(max) + ' views.</p>';
  }

  /* ---------- drawing the page ---------- */
  function render() {
    var names = Object.keys(data).filter(function (n) { return stats(data[n]).has; });
    var html = "";
    if (!names.length) {
      $("out").innerHTML = '<div class="empty">No numbers yet. Choose a company, add its LinkedIn export, and the explanation appears here. Or try the sample numbers to see how the page reads.</div>';
      return;
    }
    var all = names.map(function (n) { return { n: n, s: stats(data[n]) }; });
    var totalImp = sum(all, function (x) { return x.s.imp; });
    var totalEng = sum(all, function (x) { return x.s.eng; });
    var hasEng = all.some(function (x) { return x.s.eng != null; });
    var totalF = sum(all, function (x) { return x.s.followersNew; });
    var rows = all.map(function (x) {
      return '<tr><td><b style="font-weight:600">' + esc(x.n) + '</b></td><td>' + fmt(x.s.imp) + '</td><td>' + (x.s.rate != null ? per100(x.s.rate) : "–") + '</td><td>' + (x.s.posts != null ? x.s.posts : "–") + '</td><td>' + (x.s.followersNew != null ? fmt(x.s.followersNew) : "–") + '</td><td>' + (x.s.impTrend && x.s.impTrend !== "new" ? esc(x.s.impTrend) : "–") + '</td></tr>';
    }).join("");
    var lead = all.slice().sort(function (a, b) { return b.s.imp - a.s.imp; })[0];
    var sentences = [];
    sentences.push("Across " + names.length + (names.length === 1 ? " page" : " pages") + ", content was shown " + fmt(totalImp) + " times.");
    if (all.length > 1 && totalImp) sentences.push(esc(lead.n) + " got the biggest share, about " + Math.round(lead.s.imp / totalImp * 100) + " of every 100 views.");
    var rated = all.filter(function (x) { return x.s.rate != null && x.s.imp >= 500; }).sort(function (a, b) { return b.s.rate - a.s.rate; });
    if (rated.length > 1) sentences.push("People reacted most to " + esc(rated[0].n) + " (" + per100(rated[0].s.rate) + " reactions, comments, shares or clicks for every 100 views) and least to " + esc(rated[rated.length - 1].n) + " (" + per100(rated[rated.length - 1].s.rate) + ").");
    if (totalF) sentences.push(fmt(totalF) + " new followers joined across the pages that have follower numbers.");
    var wait = COMPANIES.filter(function (c) { return names.indexOf(c) < 0; });
    if (wait.length) sentences.push('<span class="muted">No numbers yet for: ' + esc(wait.join(", ")) + ".</span>");

    html += '<div class="stats"><div class="stat"><b>' + fmt(totalImp) + '</b><span>views</span></div>' + (hasEng ? '<div class="stat"><b>' + fmt(totalEng) + '</b><span>reactions, comments, shares, clicks</span></div>' : '') + (totalF ? '<div class="stat"><b>' + fmt(totalF) + '</b><span>new followers</span></div>' : '') + '<div class="stat"><b>' + names.length + '</b><span>pages with numbers</span></div></div>';
    html += '<h2 style="margin-top:28px">The big picture</h2><p class="lead" style="margin-top:10px">' + sentences.join(" ") + '</p>';
    html += '<div class="scroll" style="margin-top:18px"><table><thead><tr><th>Page</th><th>Views</th><th>Reactions etc. per 100 views</th><th>Posts</th><th>New followers</th><th>Views, second half vs first</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    html += '<div style="margin-top:34px;border-top:1px solid var(--line)">' + all.map(function (x) {
      var c = data[x.n], id = "a-" + x.n;
      var top = x.s.top && x.s.top.length ? '<div class="sec-sub">Most-seen posts</div><ul class="plain">' + x.s.top.map(function (p) { return '<li>' + (p.link && /^https?:\/\//.test(p.link) ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.title || "Untitled post") + '</a>' : esc(p.title || "Untitled post")) + ' <span class="muted">· ' + fmt(p.imp) + ' views, ' + fmt(p.rea) + ' reactions, ' + fmt(p.com) + ' comments</span></li>'; }).join("") + '</ul>' : '';
      return '<details class="block sec" data-id="' + esc(id) + '"' + (openIds[id] ? ' open' : '') + '><summary><div class="block-h" style="width:100%"><h2>' + esc(x.n) + '</h2><span class="count">' + fmt(x.s.imp) + ' views</span><span class="tog"></span></div></summary>' +
        '<p class="lead">' + explain(x.n, x.s).join(" ") + '</p>' + chart(c) + top +
        '<div class="actions"><button class="btn" data-del="' + esc(x.n) + '">Remove ' + esc(x.n) + ' numbers</button></div></details>';
    }).join("") + '</div>';
    $("out").innerHTML = html;
  }

  /* ---------- sample numbers (made up, clearly labelled) ---------- */
  function makeSample() {
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var out = {};
    [["Telecrats India", 900, 1.4], ["Voltters", 450, 1.9], ["Ductel", 260, 1.2]].forEach(function (cfg) {
      var base = new Date(2026, 8, 28), daily = [], posts = [], fol = [];
      for (var i = 0; i < 30; i++) {
        var t = base.getTime() + i * 86400000, wk = new Date(t).getDay();
        var imp = Math.round(cfg[1] * (wk === 0 || wk === 6 ? 0.4 : 1) * (0.7 + rnd() * 0.8) * (1 + i / 60 * (cfg[2] - 1)));
        daily.push({ t: t, imp: imp, clk: Math.round(imp * 0.012), rea: Math.round(imp * 0.03 * (0.6 + rnd())), com: Math.round(imp * 0.003 * rnd() * 2), rep: Math.round(imp * 0.004 * rnd() * 2) });
        fol.push({ t: t, n: Math.round(rnd() * 5) });
        if (wk === 2 || wk === 4) { var pi = Math.round(imp * (2 + rnd() * 3)); posts.push({ title: "Sample post " + (posts.length + 1), link: "", t: t, imp: pi, clk: Math.round(pi * 0.01), rea: Math.round(pi * 0.03), com: Math.round(pi * 0.004), rep: Math.round(pi * 0.003) }); }
      }
      out[cfg[0]] = { daily: daily, posts: posts, followers: fol };
    });
    return out;
  }

  /* ---------- wiring ---------- */
  function setNote(msg, bad) { var n = $("note"); n.textContent = msg || ""; n.style.color = bad ? "var(--crit)" : "var(--muted)"; }

  function handleFile(file) {
    var company = $("company").value;
    if (!company) { setNote("Choose a company first.", true); return; }
    if (typeof XLSX === "undefined") { setNote("The spreadsheet reader did not load. Check your connection and reload.", true); return; }
    var r = new FileReader();
    r.onload = function () {
      try {
        var wb = XLSX.read(r.result, { type: "array", cellDates: true });
        var parsed = readWorkbook(wb);
        if (!parsed.found.length) { setNote("I could not find LinkedIn analytics tables in that file. Use the Content or Followers export from the page's Analytics.", true); return; }
        if (sample) { sample = false; data = {}; $("sampleBadge").hidden = true; }
        merge(company, parsed); save(); render();
        setNote("Read " + parsed.found.join(", ") + " for " + company + ". Nothing leaves your browser.");
      } catch (e) { setNote("That file could not be read.", true); }
    };
    r.readAsArrayBuffer(file);
  }

  function init() {
    load();
    $("company").innerHTML = '<option value="">Choose a company</option>' + COMPANIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join("");
    $("file").addEventListener("change", function (e) { var f = e.target.files[0]; if (f) handleFile(f); e.target.value = ""; });
    var dz = $("drop");
    ["dragover", "dragenter"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("over"); }); });
    dz.addEventListener("drop", function (e) { var f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    $("sampleBtn").addEventListener("click", function () { sample = true; data = makeSample(); $("sampleBadge").hidden = false; setNote("Showing made-up sample numbers. Add a real export to replace them."); render(); });
    $("clearBtn").addEventListener("click", function () { data = {}; sample = false; $("sampleBadge").hidden = true; try { localStorage.removeItem(KEY); } catch (e) {} setNote("All numbers cleared from this browser."); render(); });
    document.addEventListener("click", function (e) { var b = e.target.closest("[data-del]"); if (!b) return; delete data[b.getAttribute("data-del")]; save(); render(); });
    document.addEventListener("toggle", function (e) { var t = e.target; if (t && t.dataset && t.dataset.id) openIds[t.dataset.id] = t.open; }, true);
    render();
  }
  init();
})();
