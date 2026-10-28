// Splits private source files into public JSON and an encrypted blob.
// Usage: PMH_PASSWORD=... node tools/build-data.mjs <private-dir>
// The private directory and the password never go in this repo.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const dir = process.argv[2];
const pw = process.env.PMH_PASSWORD;
if (!dir || !pw) { console.error("Need <private-dir> and PMH_PASSWORD"); process.exit(1); }

const ITER = 250000;
const b64 = (u8) => Buffer.from(u8).toString("base64");

async function encrypt(text) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

// Brand kit: open fields go to public JSON, the rest is encrypted.
const src = JSON.parse(readFileSync(`${dir}/brandkit.source.json`, "utf8"));
const OPEN = ["about", "logoFile", "name", "logo", "tagline", "typography", "imagery", "layout", "colors", "artStyle"];
const pub = { companies: {}, rules: [], artstyles: src.artstyles };
const locked = { companies: {}, rules: [] };
for (const [id, c] of Object.entries(src.companies)) {
  pub.companies[id] = {}; locked.companies[id] = {};
  for (const [k, v] of Object.entries(c)) (OPEN.includes(k) ? pub : locked).companies[id][k] = v;
}
for (const r of src.rules) {
  const { vis, ...rest } = r;
  (vis === "public" ? pub : locked).rules.push(rest);
}
writeFileSync("data/brandkit.public.json", JSON.stringify(pub));
writeFileSync("data/brandkit.locked.json", JSON.stringify(await encrypt(JSON.stringify(locked))));

// Comment Desk: the whole page is encrypted.
const desk = readFileSync(`${dir}/comment-desk.source.html`, "utf8");
writeFileSync("data/comment-desk.locked.json", JSON.stringify(await encrypt(desk)));
// Analytics: this week's LinkedIn numbers, encrypted.
const an = readFileSync(`${dir}/analytics.source.json`, "utf8");
writeFileSync("data/analytics.locked.json", JSON.stringify(await encrypt(an)));
console.log("Built data/*.json");
