(function () {
  var COMPANIES = ["Pratap Group", "Telecrats India", "Beckhaul Technologies", "Corsis Technologies", "Ductel", "Pratap Diesels", "PALS", "Voltters", "Pratap Automobiles"];
  var KEY = "pmh-analytics-v1";
  var data = {}, sample = false, openIds = {}, base = null, baseInfo = null, local = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Math.round(n).toLocaleString("en-IN"); }
  function num(v) { if (v == null || v === "") return 0; var n = Number(String(v).replace(/[,%\s]/g, "")); return isFinite(n) ? n : 0; }
  function poss(n) { return /s$/i.test(n) ? n + "\u2019" : n + "\u2019s"; }
  function dstr(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

  function save() { if (sample) return; try { var o = {}; Object.keys(data).forEach(function (k) { if (!base || !base[k] || data[k].__mine) o[k] = data[k]; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
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
    c.__mine = true; data[company] = c;
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

  /* ---------- helpers for the layout ---------- */
  var loadFailed = false, sel = "All", sortKey = "imp", sortDir = -1, chartSeries = null;
  function dayKey(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function halfDelta(arr, f) {
    if (arr.length < 6) return null;
    var h = Math.floor(arr.length / 2), a = sum(arr.slice(0, h), f), b = sum(arr.slice(h), f);
    return a ? (b - a) / a * 100 : null;
  }
  function pill(p, suffix) {
    if (p == null) return "";
    var cls, ic, sr, txt;
    if (Math.abs(p) < 5) { cls = "flat"; ic = "●"; sr = ""; txt = "Steady"; }
    else if (p > 0) { cls = "up"; ic = "▲"; sr = "Up "; txt = (p > 999 ? ">999" : Math.round(p)) + "%"; }
    else { cls = "down"; ic = "▼"; sr = "Down "; txt = (p < -999 ? ">999" : Math.round(-p)) + "%"; }
    return '<span class="dl ' + cls + '"><i aria-hidden="true">' + ic + '</i><span class="sr">' + sr + '</span>' + txt + (suffix ? " <em>" + suffix + "</em>" : "") + "</span>";
  }
  function fmtC(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(Math.round(n));
  }
  function niceMax(v) {
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p, o = [1, 2, 4, 6, 8, 10];
    for (var i = 0; i < o.length; i++) if (f <= o[i] + 1e-9) return o[i] * p;
    return 10 * p;
  }
  function sdate(t, long) { return new Date(t).toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" }); }

  function aggDaily(names) {
    var m = {};
    names.forEach(function (n) {
      (data[n].daily || []).forEach(function (x) {
        var k = dayKey(x.t), o = m[k] || (m[k] = { t: k, imp: 0, eng: 0 });
        o.imp += x.imp || 0; o.eng += (x.clk || 0) + (x.rea || 0) + (x.com || 0) + (x.rep || 0);
      });
    });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return m[k]; });
  }
  function aggFollowers(names) {
    var m = {};
    names.forEach(function (n) { (data[n].followers || []).forEach(function (x) { var k = dayKey(x.t); m[k] = (m[k] || 0) + x.n; }); });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { t: k, n: m[k] }; });
  }
  function seriesFor(scope, names) {
    if (scope === "All") return aggDaily(names);
    return (data[scope].daily || []).map(function (x) { return { t: dayKey(x.t), imp: x.imp || 0, eng: (x.clk || 0) + (x.rea || 0) + (x.com || 0) + (x.rep || 0) }; });
  }
  function info(n) {
    var c = data[n], s = stats(c);
    s.dp = halfDelta(c.daily || [], function (x) { return x.imp; });
    s.spark = (c.daily || []).map(function (x) { return x.imp; });
    return s;
  }
  function spark(v) {
    if (v.length < 2) return '<span class="muted">–</span>';
    var W = 84, H = 26, mx = Math.max.apply(null, v) || 1, mn = Math.min.apply(null, v);
    var pts = v.map(function (y, i) { return (i / (v.length - 1) * W).toFixed(1) + "," + (H - 2 - (y - mn) / ((mx - mn) || 1) * (H - 4)).toFixed(1); }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="#0E9AC1" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ---------- the trend chart (drawn at real width so text stays readable) ---------- */
  function drawChart() {
    var host = $("chart"); if (!host) return;
    var ser = chartSeries;
    if (!ser || ser.length < 2) { host.innerHTML = '<p class="hint">Not enough daily numbers to draw a chart yet.</p>'; host.removeAttribute("tabindex"); return; }
    var W = Math.max(host.clientWidth, 280), H = W < 520 ? 200 : 240, L = 40, R = 10, T = 12, B = 26, pw = W - L - R, ph = H - T - B, n = ser.length;
    var peak = 0, peakI = 0; ser.forEach(function (x, i) { if (x.imp > peak) { peak = x.imp; peakI = i; } });
    var mx = niceMax(peak || 1);
    function X(i) { return L + i / (n - 1) * pw; }
    function Y(v) { return T + ph - v / mx * ph; }
    var grid = "", i;
    for (i = 0; i <= 4; i++) { var v = mx * i / 4, y = Y(v); grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="gl' + (i ? "" : " base") + '"/><text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" class="ax">' + fmtC(v) + "</text>"; }
    var pts = ser.map(function (x, k) { return X(k).toFixed(1) + "," + Y(x.imp).toFixed(1); });
    var area = "M" + pts.join(" L") + " L" + X(n - 1).toFixed(1) + "," + Y(0).toFixed(1) + " L" + X(0).toFixed(1) + "," + Y(0).toFixed(1) + " Z";
    var ticks = W < 520 ? 3 : 5, xl = "";
    for (i = 0; i < ticks; i++) { var idx = Math.round(i * (n - 1) / (ticks - 1)); xl += '<text x="' + X(idx).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === ticks - 1 ? "end" : "middle") + '" class="ax">' + esc(sdate(ser[idx].t)) + "</text>"; }
    var hasEng = ser.some(function (x) { return x.eng > 0; });
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Line chart of views per day, ' + esc(sdate(ser[0].t) + " to " + sdate(ser[n - 1].t)) + ". Busiest day " + esc(sdate(ser[peakI].t)) + " with " + fmt(peak) + ' views."><defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1AB86B" stop-opacity=".28"/><stop offset="1" stop-color="#0E9AC1" stop-opacity="0"/></linearGradient></defs>' + grid +
      '<path d="' + area + '" fill="url(#ag)"/><path d="M' + pts.join(" L") + '" fill="none" stroke="#0E9AC1" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + xl +
      '<g id="hv" hidden><line id="hvl" y1="' + T + '" y2="' + (T + ph) + '" stroke="#52615B" stroke-width="1" stroke-dasharray="3 3"/><circle id="hvc" r="5" fill="#0E9AC1" stroke="#fff" stroke-width="2"/></g></svg><div class="tip" id="tip" hidden></div>';
    host.setAttribute("tabindex", "0");
    var hv = $("hv"), hvl = $("hvl"), hvc = $("hvc"), tip = $("tip"), cur = peakI;
    function show(k) {
      cur = Math.max(0, Math.min(n - 1, k)); var x = X(cur), d = ser[cur];
      hv.removeAttribute("hidden"); hvl.setAttribute("x1", x); hvl.setAttribute("x2", x); hvc.setAttribute("cx", x); hvc.setAttribute("cy", Y(d.imp));
      tip.innerHTML = "<b>" + esc(sdate(d.t, true)) + "</b>" + fmt(d.imp) + " views" + (hasEng ? "<br><span>" + fmt(d.eng) + " actions</span>" : "");
      tip.removeAttribute("hidden");
      var tw = tip.offsetWidth, left = Math.max(0, Math.min(W - tw, x - tw / 2)), top = Y(d.imp) - tip.offsetHeight - 12;
      tip.style.left = left + "px"; tip.style.top = Math.max(0, top) + "px";
    }
    function hide() { hv.setAttribute("hidden", ""); tip.setAttribute("hidden", ""); }
    host.onpointermove = function (e) { var r = host.getBoundingClientRect(); show(Math.round((e.clientX - r.left - L) / pw * (n - 1))); };
    host.onpointerdown = host.onpointermove;
    host.onpointerleave = function () { if (document.activeElement !== host) hide(); };
    host.onfocus = function () { show(cur); };
    host.onblur = hide;
    host.onkeydown = function (e) {
      if (e.key === "ArrowLeft") { show(cur - 1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { show(cur + 1); e.preventDefault(); }
      else if (e.key === "Home") { show(0); e.preventDefault(); }
      else if (e.key === "End") { show(n - 1); e.preventDefault(); }
    };
  }

  /* ---------- drawing the page ---------- */
  var SORTS = { n: "Page", imp: "Views", trend: "Trend", rate: "Actions per 100 views", posts: "Posts", fol: "New followers" };
  function sortVal(x, k) {
    if (k === "n") return x.n.toLowerCase();
    var v = k === "imp" ? x.s.imp : k === "trend" ? x.s.dp : k === "rate" ? x.s.rate : k === "posts" ? x.s.posts : x.s.followersNew;
    return v == null ? null : v;
  }
  function th(k, label) {
    return '<th scope="col"' + (sortKey === k ? ' aria-sort="' + (sortDir > 0 ? "ascending" : "descending") + '"' : "") + '><button type="button" data-sort="' + k + '">' + label + "</button></th>";
  }

  function emptyState() {
    return '<div class="emptyc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>' +
      "<h2>No numbers yet</h2><p>" + (loadFailed ? "This week's numbers could not be loaded. Reload the page, or add a LinkedIn export yourself." : "Add a LinkedIn export, or look at sample numbers to see how this page reads.") + "</p>" +
      '<div class="actions"><button class="btn primary" type="button" data-act="tools">Add LinkedIn export</button><button class="btn" type="button" data-act="sample">Try sample numbers</button></div></div>';
  }

  function render() {
    status();
    var names = Object.keys(data).filter(function (n) { return stats(data[n]).has; });
    if (!names.length) { chartSeries = null; $("out").innerHTML = emptyState(); return; }
    if (sel !== "All" && names.indexOf(sel) < 0) sel = "All";
    var all = names.map(function (n) { return { n: n, s: info(n) }; });
    var totalImp = sum(all, function (x) { return x.s.imp; });
    var totalEng = sum(all, function (x) { return x.s.eng; });
    var hasEng = all.some(function (x) { return x.s.eng != null; });
    var totalF = sum(all, function (x) { return x.s.followersNew; });
    var hasF = all.some(function (x) { return x.s.followersNew != null; });
    var totalP = sum(all, function (x) { return x.s.posts; });
    var from = Math.min.apply(null, all.filter(function (x) { return x.s.from; }).map(function (x) { return x.s.from; }));
    var to = Math.max.apply(null, all.filter(function (x) { return x.s.to; }).map(function (x) { return x.s.to; }));
    var period = isFinite(from) && isFinite(to) ? Math.round((to - from) / 86400000 + 1) + " days · " + dstr(new Date(from)) + " to " + dstr(new Date(to)) : "";
    var aggD = aggDaily(names), aggF = aggFollowers(names);
    var dViews = halfDelta(aggD, function (x) { return x.imp; }), dFol = halfDelta(aggF, function (x) { return x.n; });
    var html = "";

    /* 1. KPI strip */
    html += '<div class="sec-title" style="margin-top:26px"><h2>At a glance</h2>' + (period ? '<span class="muted">' + esc(period) + "</span>" : "") + "</div>";
    html += '<div class="kpis">' +
      '<div class="kpi"><div class="l">Views</div><div class="v">' + fmt(totalImp) + '</div><div class="s">' + pill(dViews, "vs first half") + (dViews == null ? "across " + names.length + (names.length === 1 ? " page" : " pages") : "") + "</div></div>" +
      (hasEng ? '<div class="kpi"><div class="l">Actions</div><div class="v">' + fmt(totalEng) + '</div><div class="s">' + (totalImp ? per100(totalEng / totalImp) + " per 100 views" : "") + "</div></div>" : "") +
      (hasF ? '<div class="kpi"><div class="l">New followers</div><div class="v">' + fmt(totalF) + '</div><div class="s">' + pill(dFol, "vs first half") + "</div></div>" : "") +
      (totalP ? '<div class="kpi"><div class="l">Posts</div><div class="v">' + fmt(totalP) + '</div><div class="s">' + (totalImp && totalP ? "about " + fmt(totalImp / totalP) + " views each" : "") + "</div></div>" : "") + "</div>";

    /* 2. Headlines */
    var lead = all.slice().sort(function (a, b) { return b.s.imp - a.s.imp; })[0];
    var rated = all.filter(function (x) { return x.s.rate != null && x.s.imp >= 500; }).sort(function (a, b) { return b.s.rate - a.s.rate; });
    var moving = all.filter(function (x) { return x.s.dp != null; }).sort(function (a, b) { return a.s.dp - b.s.dp; });
    var heads = [];
    heads.push({ k: "Most seen", n: lead.n, t: all.length > 1 && totalImp ? "About " + Math.round(lead.s.imp / totalImp * 100) + " of every 100 views across the pages." : fmt(lead.s.imp) + " views in this period." });
    if (rated.length) heads.push({ k: "Most engaging", n: rated[0].n, t: per100(rated[0].s.rate) + " actions for every 100 views" + (rated.length > 1 ? ", against " + per100(rated[rated.length - 1].s.rate) + " for " + rated[rated.length - 1].n + "." : ".") });
    if (moving.length) {
      var dn = moving[0], up = moving[moving.length - 1];
      if (dn.s.dp <= -15) heads.push({ k: "Needs attention", n: dn.n, t: "Views down " + Math.round(-dn.s.dp) + "% in the second half compared with the first." });
      else if (up.s.dp >= 15) heads.push({ k: "Gaining momentum", n: up.n, t: "Views up " + Math.round(up.s.dp) + "% in the second half compared with the first." });
      else heads.push({ k: "Direction", n: "Steady", t: "No page moved more than 15% between the two halves of the period." });
    }
    html += '<div class="sec-title"><h2>What stands out</h2></div><div class="heads">' + heads.map(function (h) {
      var pick = names.indexOf(h.n) >= 0;
      return "<" + (pick ? 'button type="button" data-pick="' + esc(h.n) + '"' : "div") + ' class="head"><span class="k">' + esc(h.k) + '</span><span class="n">' + esc(h.n) + '</span><span class="t">' + esc(h.t) + "</span></" + (pick ? "button" : "div") + ">";
    }).join("") + "</div>";
    var wait = COMPANIES.filter(function (c) { return names.indexOf(c) < 0; });
    if (wait.length) html += '<p class="waiting">No numbers yet for ' + esc(wait.join(", ")) + ".</p>";

    /* 3. Leaderboard */
    all.sort(function (a, b) {
      var x = sortVal(a, sortKey), y = sortVal(b, sortKey);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    var maxImp = Math.max.apply(null, all.map(function (x) { return x.s.imp; })) || 1;
    html += '<div class="sec-title"><h2>Page by page</h2><span class="muted">Select a page to see its detail</span></div>';
    html += '<div class="sortbar"><label for="sortSel">Sort by</label><select id="sortSel">' + Object.keys(SORTS).map(function (k) { return '<option value="' + k + '"' + (k === sortKey ? " selected" : "") + ">" + SORTS[k] + "</option>"; }).join("") + "</select></div>";
    html += '<div class="lbwrap"><table class="lb"><thead><tr>' + th("n", "Page") + th("imp", "Views") + th("trend", "Trend") + th("rate", "Actions per 100 views") + th("posts", "Posts") + th("fol", "New followers") + "</tr></thead><tbody>" +
      all.map(function (x) {
        return '<tr' + (x.n === sel ? ' class="on"' : "") + '><td data-l="Page"><button type="button" class="pg" data-pick="' + esc(x.n) + '">' + esc(x.n) + '</button></td>' +
          '<td class="vcell" data-l="Views"><span class="num">' + fmt(x.s.imp) + '</span><span class="bar"><i style="width:' + Math.max(2, x.s.imp / maxImp * 100).toFixed(1) + '%"></i></span></td>' +
          '<td data-l="Trend"><span class="tcell">' + spark(x.s.spark) + (pill(x.s.dp) || "") + "</span></td>" +
          '<td data-l="Actions per 100 views">' + (x.s.rate != null ? per100(x.s.rate) : "–") + "</td>" +
          '<td data-l="Posts">' + (x.s.posts != null ? x.s.posts : "–") + "</td>" +
          '<td data-l="New followers">' + (x.s.followersNew != null ? fmt(x.s.followersNew) : "–") + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    /* 4. Trend chart + page focus */
    chartSeries = seriesFor(sel, names);
    var peak = chartSeries.reduce(function (m, x) { return x.imp > m.imp ? x : m; }, { imp: -1 });
    html += '<div class="sec-title" id="focus"><h2>Views over time</h2></div><div class="pnl">';
    html += '<div class="scopes" role="group" aria-label="Choose what the chart shows">' + ["All"].concat(names).map(function (n) { return '<button type="button" class="scope" data-scope="' + esc(n) + '" aria-pressed="' + (n === sel) + '">' + (n === "All" ? "All pages" : esc(n)) + "</button>"; }).join("") + "</div>";
    html += '<div class="ctitle"><b>Views per day, ' + (sel === "All" ? "all pages together" : esc(sel)) + "</b>" + (peak.imp >= 0 ? "<span>Busiest day " + esc(sdate(peak.t, true)) + ", " + fmt(peak.imp) + " views</span>" : "") + "</div>";
    html += '<div class="chart" id="chart" aria-describedby="chartHelp"></div><p class="hint" id="chartHelp" style="margin-top:8px">Hover, tap, or use the arrow keys on the chart to read a single day.</p>';
    html += '<details class="mini"><summary>Show the numbers as a table</summary><div class="scroll"><table><thead><tr><th>Day</th><th>Views</th>' + (chartSeries.some(function (x) { return x.eng > 0; }) ? "<th>Actions</th>" : "") + "</tr></thead><tbody>" +
      chartSeries.map(function (x) { return "<tr><td>" + esc(sdate(x.t, true)) + "</td><td>" + fmt(x.imp) + "</td>" + (x.eng > 0 || chartSeries.some(function (y) { return y.eng > 0; }) ? "<td>" + fmt(x.eng) + "</td>" : "") + "</tr>"; }).join("") + "</tbody></table></div></details>";

    if (sel !== "All") {
      var s = info(sel), c = data[sel];
      var maxP = s.top && s.top.length ? s.top[0].imp || 1 : 1;
      html += '<div class="detail"><div class="dh"><h3>' + esc(sel) + ": what is happening</h3>" + pill(s.dp, "views vs first half") + "</div>" +
        '<ul class="facts">' + explain(sel, s).map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" +
        (s.top && s.top.length ? '<div class="sec-sub" style="margin-top:22px">Most-seen posts</div><ol class="posts">' + s.top.map(function (p, i) {
          var t = esc(p.title || "Untitled post");
          return '<li><span class="rk">' + (i + 1) + '</span><div><div class="pt">' + (p.link && /^https?:\/\//.test(p.link) ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + t + "</a>" : t) + '</div><div class="pm"><span><b>' + fmt(p.imp) + "</b> views</span><span><b>" + fmt(p.rea) + "</b> reactions</span><span><b>" + fmt(p.com) + "</b> comments</span></div>" +
            '<span class="bar" aria-hidden="true"><i style="width:' + Math.max(2, p.imp / maxP * 100).toFixed(1) + '%"></i></span></div></li>';
        }).join("") + "</ol>" : "") +
        '<div class="actions"><button class="btn" data-del="' + esc(sel) + '">Remove ' + esc(sel) + " numbers from this browser</button></div></div>";
    }
    html += "</div>";
    $("out").innerHTML = html;
    drawChart();
  }

  function status() {
    var el = $("status"), t, c;
    if (base && baseInfo) { t = baseInfo.week + (baseInfo.range ? " · " + baseInfo.range : ""); c = "live"; }
    else if (sample) { t = "Sample numbers, made up"; c = "sample"; }
    else if (Object.keys(data).some(function (k) { return data[k].__mine; })) { t = "Your uploads · this browser only"; c = "mine"; }
    else { t = "No numbers yet"; c = "none"; }
    el.className = "state " + c; el.textContent = t;
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
  function calm() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; }
  function openTools() { var t = $("tools"); t.open = true; t.scrollIntoView({ behavior: calm(), block: "start" }); }
  function startSample() { sample = true; data = makeSample(); sel = "All"; setNote("Showing made-up sample numbers. Add a real export to replace them."); render(); }

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
        if (sample) { sample = false; data = {}; }
        merge(company, parsed); save(); sel = company; render();
        setNote("Read " + parsed.found.join(", ") + " for " + company + ". Nothing leaves your browser.");
      } catch (e) { setNote("That file could not be read.", true); }
    };
    r.readAsArrayBuffer(file);
  }

  function init() {
    load();
    $("company").innerHTML = '<option value="">Choose a company</option>' + COMPANIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
    $("file").addEventListener("change", function (e) { var f = e.target.files[0]; if (f) handleFile(f); e.target.value = ""; });
    var dz = $("drop");
    ["dragover", "dragenter"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("over"); }); });
    dz.addEventListener("drop", function (e) { var f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    $("clearBtn").addEventListener("click", function () { data = {}; sample = false; sel = "All"; try { localStorage.removeItem(KEY); } catch (e) {} setNote("All numbers cleared from this browser."); render(); });

    document.addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-del]"))) { delete data[b.getAttribute("data-del")]; sel = "All"; save(); render(); return; }
      if ((b = e.target.closest("[data-sort]"))) { var k = b.getAttribute("data-sort"); if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === "n" ? 1 : -1; } render(); var nb = document.querySelector('[data-sort="' + k + '"]'); if (nb) nb.focus(); return; }
      if ((b = e.target.closest("[data-scope]"))) { sel = b.getAttribute("data-scope"); render(); var nb2 = document.querySelector('[data-scope="' + sel.replace(/"/g, '\\"') + '"]'); if (nb2) nb2.focus(); return; }
      if ((b = e.target.closest("[data-pick]"))) { sel = b.getAttribute("data-pick"); render(); var f = $("focus"); if (f) f.scrollIntoView({ behavior: calm(), block: "start" }); return; }
      if ((b = e.target.closest("[data-act]"))) {
        var a = b.getAttribute("data-act");
        if (a === "tools") openTools();
        else if (a === "sample") startSample();
      }
    });
    document.addEventListener("change", function (e) { if (e.target.id === "sortSel") { sortKey = e.target.value; sortDir = sortKey === "n" ? 1 : -1; render(); var s = $("sortSel"); if (s) s.focus(); } });
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(drawChart, 120); });

    fetch("data/analytics.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (o) {
      base = o.data; baseInfo = o;
      if (!sample) { var mine = data; data = {}; Object.keys(base).forEach(function (k) { data[k] = base[k]; }); Object.keys(mine).forEach(function (k) { if (mine[k].__mine) data[k] = mine[k]; }); }
      setNote(baseInfo.week + " loaded (" + baseInfo.range + "). Files you add here replace a page for this browser only.");
      render();
    }).catch(function () { loadFailed = true; render(); });
    render();
  }
  init();
})();
