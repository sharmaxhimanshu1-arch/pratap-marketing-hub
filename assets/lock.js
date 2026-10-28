/* Password lock. Locked data is AES-GCM encrypted; the key comes from the password (PBKDF2). */
(function () {
  var KEY = "pmh-unlock";
  function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function store(v) { try { v == null ? sessionStorage.removeItem(KEY) : sessionStorage.setItem(KEY, v); } catch (e) {} }
  function stored() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function decrypt(blob, pw) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (km) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.ct));
    }).then(function (pt) { return new TextDecoder().decode(pt); });
  }
  function init(opts) {
    var bar = document.createElement("div");
    bar.className = "lockbar";
    var anchor = document.querySelector(".wrap") || document.body.firstChild;
    anchor.parentNode.insertBefore(bar, anchor);
    var blob = null;
    function showLocked(msg) {
      bar.innerHTML = '<strong>Some details are locked.</strong><input type="password" id="pw" placeholder="Password" autocomplete="off" aria-label="Password"><button class="btn primary" id="go">Unlock</button><span class="msg" id="msg"></span>';
      bar.querySelector("#msg").textContent = msg || "";
      var inp = bar.querySelector("#pw");
      function go() { tryPw(inp.value); }
      bar.querySelector("#go").addEventListener("click", go);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    }
    function showOpen() {
      bar.innerHTML = '<strong>Unlocked</strong><span style="color:var(--muted)">for this tab only</span><button class="btn" id="relock" style="margin-left:auto">Lock again</button>';
      bar.querySelector("#relock").addEventListener("click", function () { store(null); opts.onLock(); showLocked(); });
    }
    function tryPw(pw, silent) {
      if (!pw || !blob) return Promise.resolve();
      return decrypt(blob, pw).then(function (text) { store(pw); showOpen(); opts.onUnlock(text); },
        function () { if (!silent) showLocked("Wrong password."); else store(null); });
    }
    if (!(window.crypto && crypto.subtle)) { bar.textContent = "Locked details need a secure (https) page."; return; }
    showLocked();
    fetch(opts.blobUrl).then(function (r) { return r.json(); }).then(function (b) { blob = b; var s = stored(); if (s) tryPw(s, true); })
      .catch(function () { showLocked("Could not load locked data."); });
  }
  window.Lock = { init: init, decrypt: decrypt };
})();
