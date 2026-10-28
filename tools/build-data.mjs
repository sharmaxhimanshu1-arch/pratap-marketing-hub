// Turns private source files into the site's data files.
// Usage: node tools/build-data.mjs <source-dir>
// The source directory stays outside this repo. Everything written to data/ is public.
import { readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
if (!dir) { console.error("Need <source-dir>"); process.exit(1); }

// Brand kit: open fields go to brandkit.public.json, the rest to brandkit.details.json.
const src = JSON.parse(readFileSync(`${dir}/brandkit.source.json`, "utf8"));
const OPEN = ["about", "logoFile", "name", "logo", "tagline", "typography", "imagery", "layout", "colors", "artStyle"];
const pub = { companies: {}, rules: [], artstyles: src.artstyles };
const more = { companies: {}, rules: [] };
for (const [id, c] of Object.entries(src.companies)) {
  pub.companies[id] = {}; more.companies[id] = {};
  for (const [k, v] of Object.entries(c)) (OPEN.includes(k) ? pub : more).companies[id][k] = v;
}
for (const r of src.rules) {
  const { vis, ...rest } = r;
  (vis === "public" ? pub : more).rules.push(rest);
}
writeFileSync("data/brandkit.public.json", JSON.stringify(pub));
writeFileSync("data/brandkit.details.json", JSON.stringify(more));

// Comment Desk page and this week's LinkedIn numbers.
writeFileSync("data/comment-desk.html", readFileSync(`${dir}/comment-desk.source.html`, "utf8"));
writeFileSync("data/analytics.json", readFileSync(`${dir}/analytics.source.json`, "utf8"));
console.log("Built data/*");
