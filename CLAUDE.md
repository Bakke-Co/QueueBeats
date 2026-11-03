# QueueBeats

## Services and connections

React 18 SPA with React Router and Vite. Netlify builds main using netlify-build.sh, publishes frontend/dist and bundles netlify/functions. The active Vite configuration is frontend/vite.config.js, not the sibling TypeScript config.

| Service | This repo uses | Verify with |
|---|---|---|
| GitHub | Bakke-Co, https://github.com/Bakke-Co/QueueBeats.git, main | gh auth status; git remote -v |
| Netlify | queuebeats, site 5d13cbeb-c31d-497f-a480-1e20c5c45ec8, account 6777003600bb2607fe4f7352 | site API identity and published deploy |
| Production | https://queuebeats.netlify.app | browser workflow and deploy commit_ref |

Credential reference: Netlify API op://7tr6yo3acnhdlbltgkzexw7rce/p3ot5ifcs6ztumh4h3m3mw2dpi/credential, read only through secret. Never print credentials. Spotify rotation and environment changes belong to the existing credential execution row queuebeats-spotify-secret-public-20261031. Dependency work must preserve its branch, finisher and watcher. Do not invoke its finisher to deploy a dependency change. Database ownership is not verified for this task; no database mutations are authorized here.

## Validation and release

Read STATE.md before continuing. Frontend package scripts: build (tsc then vite), lint. There is currently no test script. Full checks are required by the router execution row; do not treat the Netlify script skipping tsc as a passing build. Use the configured Git identity and signing unchanged.

Router security release requires full frontend checks, Pilot PASS after final head, verified production deploy/workflow and fixed alerts. Do not merge a draft or bypass a failed gate. Rollback is a revert of the dependency commit; preserve the merged credential fix.
