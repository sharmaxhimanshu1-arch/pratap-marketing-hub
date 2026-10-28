# Pratap Marketing Hub

Static site for Pratap Group's LinkedIn marketing work, served with GitHub Pages.

- `index.html` home, `brand-kit.html`, `comment-desk.html`
- `data/*.public.json` open data. `data/*.locked.json` encrypted data, readable only with the password.
- `tools/build-data.mjs` rebuilds the data files from private source files kept outside this repo.

Never commit the private source files or the password.
