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

## Dependency maintenance (24.11.2026)

Netlify builds this repository's `main` branch. The legacy directory
`/Users/nyx/Projects/bakke/queuebeats` is an unversioned, divergent copy, not the build source.

| Service | Binding | Evidence |
|---|---|---|
| GitHub | account `Bakke-Co`, `https://github.com/Bakke-Co/QueueBeats.git`, `main` | `project-route --check-github`, 24.11.2026 |
| Netlify | `queuebeats`, site `5d13cbeb-c31d-497f-a480-1e20c5c45ec8`, account `6777003600bb2607fe4f7352` | GET site, repository URL and branch, 24.11.2026 |
| Published source | `afd19550476a0989dc21158a0e360ae2a39dfca8`, deploy `6afdc242b1b35cde037b008b` | GET site published deploy, 24.11.2026 |

Netlify credential reference: `op://7tr6yo3acnhdlbltgkzexw7rce/p3ot5ifcs6ztumh4h3m3mw2dpi/credential`.
Use the guarded secret helper. GitHub operations bind the named account to each invocation.
Database recovery and Spotify credential work have separate owners. Do not start services,
change their data or credentials, or enable stopped builds during dependency maintenance.

## Checks and hazards

- Root dependencies: `npm ci --ignore-scripts`, then `node --test tests/*.test.cjs`.
- Production audit: `npm audit --omit=dev --package-lock-only`.
- Frontend checks: `npx tsc --noEmit` and the package's `npm run build`.
- Root has no TypeScript project or pre-existing test script.
- Root postinstall installs frontend dependencies. Use `--ignore-scripts` for isolated root work.
- `build.sh` and `netlify-build.sh` generate files and overwrite function utilities. Inspect their
  behavior before running them in an isolated worktree.
- `.netlify/` contains tracked generated bundles. Do not hand-edit them.
- Dependency state and source mapping: `docs/DEPENDENCY_STATE.md`.
