# Pratap Marketing Hub

Static site for Pratap Group's LinkedIn marketing work, served with GitHub Pages.

- `index.html` home, `brand-kit.html`, `comment-desk.html`, `analytics.html`, `workflows.html`
- `data/` holds the site's data files. There is no password, and the repo is public, so anything in `data/` is readable by anyone.
- `tools/build-data.mjs` rebuilds the data files from source files kept outside this repo.
- `workflows.html` runs Claude's skills visually. `assets/workflow-defs.js` holds the workflow definitions (add a new workflow there), `assets/workflows.js` is the engine. Progress is saved in the browser (localStorage), nothing is sent anywhere.
