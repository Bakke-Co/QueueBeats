# QueueBeats

Real-time party music queue (React + Vite frontend in `frontend/`, Netlify functions, Supabase). Entry docs: `README.md`, `NETLIFY_DEPLOY.md`.

## Services and connections

- GitHub: `Bakke-Co/QueueBeats`, branch `main` auto-deploys.
- Netlify (Bakke & Co team): site `queuebeats`, id `5d13cbeb-c31d-497f-a480-1e20c5c45ec8`, builds `Bakke-Co/QueueBeats`. Publish dir `frontend/dist`.
- Production host (measured 18.11.2026): `https://queuebeats.netlify.app`. The site has no custom domain and no domain aliases.
- `queuebeats.com` is NOT on Netlify (AWS S3/CloudFront, NS on awsdns, different content). Ownership unknown; not ours as far as measured. Do not point canonicals at it.
- Supabase and Spotify credentials: 1Password via `secret find queuebeats`.

## SEO

- `frontend/index.html` holds title, description, canonical, Open Graph and Twitter tags (canonical = the Netlify host above; change it if a custom domain is attached).
- `frontend/public/robots.txt` and `sitemap.xml` are served as static files ahead of the SPA fallback. Only `/` is public and indexable; the rest is login-gated app UI.
- No og:image: the repo has no logo or product image (the logo is CSS). Add one at `frontend/public/og.png` and an `og:image` / `twitter:card=summary_large_image` tag when a real asset exists.
