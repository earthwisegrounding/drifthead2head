# DRIFT · DriftHead2Head.com

Launch site for DRIFT, the head-to-head board game. Coming summer 2028.

Static site, no build step: `index.html`, `css/site.css`, `js/site.js`, and `media/`.

## Run locally

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Hosting (GitHub Pages)

1. Push this folder to a GitHub repo and turn on Pages (Settings → Pages → Deploy from branch → `main` / root).
2. The `CNAME` file sets the custom domain to `www.drifthead2head.com`.
3. At your domain registrar, add these DNS records:
   - `www` → CNAME → `<github-username>.github.io`
   - `@` (apex) → A records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. Once the certificate is issued, tick "Enforce HTTPS" in the Pages settings.

## Email signup

The form posts to Formspree. Put your endpoint (`https://formspree.io/f/<id>`) in the `action` attribute of `<form class="signup__form">` in `index.html`. Signups show up in your Formspree dashboard.
`_gotcha` is Formspree's spam honeypot.

## Media

Everything in `media/` was cut from the trailer. The full trailer plays from YouTube (`wiKU0IjNOCs`).
