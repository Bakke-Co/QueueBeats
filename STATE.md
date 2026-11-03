# QueueBeats router release repair

Execution: sec-github-queuebeats-react-router-20261103, issue 427c0adb508039428297bd7573c1f64b2399244e0f18a3f014b6e35777096bbc. Forge builds; Pilot verifies. Draft PR: https://github.com/Bakke-Co/QueueBeats/pull/3. Nyx expanded scope to baseline repair and live diagnosis in aae0160d7ee597c4af3659d666deb64cab5f8480996d75ffaa156db06294e90c.

## Current task list

- [x] Isolate dependency repair on main after credential PR #2, preserve credential checkout/finisher/watcher.
- [x] Pin router 7.18.0 and regenerate both frontend lockfiles.
- [x] Repair full frontend baseline, add regression tests and CI.
- [x] Diagnose live database failure with hostname, DNS and authenticated API controls.
- [ ] Final-head checks and Pilot review.
- [ ] Authorized database recovery, real production workflow, release and fixed-alert verification.

## Verified baseline and repair

Main 65e3672bf6297d456f3c125687b1fa9f71e41be9 had 63 TypeScript errors across 18 files and no lint configuration. Those diagnostics were byte-identical before/after the initial dependency bump. The scoped repair now passes TypeScript, lint and tsc/Vite build, with eight passing regression tests. Git-directory/router-evidence contains baseline, repaired and browser logs. Final-head checks must be repeated after changes. Root package manifests remain unchanged.

Repairs cover schema-declared token/position types, duration/URI/vote adapters, Response objects, auth return type, callback arguments, PromiseLike handling, missing import, shared toaster, and generated-client type/dead code. TypeScript checks remain enabled. ESLint recommended is newly configured; TypeScript identifier/unused checks are not duplicated by core JavaScript rules. CI runs frontend lint, tests and build on PRs/main. Existing credentials remain server-side; no SQL/migration changed.

Health probes now query actual public UI tables (profiles, queues, songs, votes), using GET limit=0 to return structured errors but no customer rows. HEAD was considered and rejected because it discards PostgREST error bodies. Access denial, connection failure, missing relation and unknown probe error remain distinct. Startup checks never call setup or mutation RPCs. Protected token/settings tables remain the responsibility of their authenticated workflows. Auth initialization tests the configured data service rather than an unrelated API 200. The invalid WebSocket.open monkey patch was removed.

## Live diagnosis, 03.11.2026

Production deploy 6ae623df12b539f2109a9a59 was ready at main 65e3672bf6297d456f3c125687b1fa9f71e41be9. Scanning its 32 JavaScript bundles and reading both Netlify Supabase URL variables yielded thuqfmfgpodaxxvydbcz.supabase.co. That hostname did not resolve while supabase.com did. Authenticated GET /v1/projects/thuqfmfgpodaxxvydbcz returned HTTP 404, Resource has been removed. Authenticated GET /v1/projects returned HTTP 200 with no matching reference/name. Provider backup recoverability remains unknown; no replacement, restore, credentials or customer data changes attempted.

Ranked causes: unavailable configured database is confirmed at the current endpoint; broken health probing also exists in source and is repaired; frontend/hosting hostname mismatch is ruled out because the actual deployed bundle and both hosting values agree. A green fixture is not recovery evidence.

## Browser evidence and limits

The production bundle with a read-only browser data fixture renders home, navigates to login and its form, handles history back, redirects an anonymous dynamic queue URL to login, and renders the wildcard route. Zero page errors and zero attempted Supabase writes. Simulated DNS failure renders Database Unavailable with a connection message. No authenticated production workflow claimed. Screenshots and exact fixture script remain under Git-directory/router-evidence; no customer form submitted.

## Decision and release boundary

Chose: repair shared contracts and report unavailable database truthfully on the isolated branch, preserving both lock formats. Over: modifying credential branch, disabling checks, hiding database errors behind API 200, or silently provisioning replacement data. Because: Nyx assigned baseline repair, while recovery could involve protected customer data and new infrastructure. Revisit-if: an authorized recoverable database is identified.

Keep PR #3 draft until Pilot reviews final head and the real workflow passes. The separate credential row queuebeats-spotify-secret-public-20261031 retains its owner. Its checkout remained clean at 0c0cdd420ab4923bfd147cd2280b38ae6aceb98c; finisher last measured not running, exit 1, and untouched. Router alerts 249/250/419/420 were still open at last API read. The digest remains open.

Next: Pilot final-head review; Nyx coordinate the database recovery decision with existing owner, then Forge verifies the restored workflow before release. No auto-merge. Reversal is a revert of the repair commit and/or router bump, leaving credential PR #2 intact.

Still unmapped: whether provider support can recover deleted-project data/backups; a replacement database's authorization and schema; authenticated real workflow and final production release. No other repository or customer data was touched. Durable coordination: /Users/nyx/.buzz/WORK_LOGS/FORGE_QUEUEBEATS_ROUTER_20261103.md.

## Pilot review repair in progress

Pilot d95a8c5234b158676e69c01afa77d544b1bc54ee950827c4ec85d186ddc91c27 blocked fd78995 for automatic token-table provisioning, missing /auth/callback route, and validation presented as applied configuration. Measured consumers: ensureSpotifyTokensTable has two UI callers; initializeSupabase has one Setup caller; Spotify REDIRECT_URI uses /auth/callback while routes expose two different aliases. Alternatives: provider outage explains live failure but not fixture defects; missing route explains callback landing page; shared setup fallback explains unintended writes. All three source defects confirmed.

Change boundary: read-only token readiness shared by both callers; add callback route preserving aliases; validate only the deployed configuration and remove misleading local persistence/success wording. Browser-only client replacement rejected because server configuration and existing auth subscriptions would remain stale. Generated route header is a landmine: add regression coverage at consumption. Reversal: revert repair commit; no database, secret, finisher or hosting changes. Tasks: implement, full checks and fixture verification, commit/push and Pilot callback.

Pilot repairs implemented: shared token readiness is a zero-row GET with no RPC or setup-function fallback. Callback probe failure now renders an error instead of an indefinite setup spinner. /auth/callback maps to SpotifyCallback; aliases preserved. Setup validates only the deployed client, rejects mismatches without contacting that project, and never persists entered configuration or claims to switch it.

Verification before commit: full lint, 15 tests, TypeScript and production build passed. Local browser fixtures exercised actual /auth/callback, both missing-table codes, access denial, thrown transport failure, and matching/mismatched deployed configuration; no page errors or provisioning writes. Evidence: Git-directory/router-evidence/pilot-repair-*. This is fixture evidence, not restored production. Known manual provisioning actions on Setup/AppWrapper remain explicit legacy actions, not invoked; broader recovery security reconciliation belongs to row 15e39f0a. SpotifySetup's pre-existing /spotify-auth continuation and callback /settings destination remain unmapped routing follow-ups for recovery workflow acceptance.

Recovery plan delivered separately at /Users/nyx/.buzz/PLANS/QUEUEBEATS_DATABASE_RECOVERY_20261103.md; no usable data export established in bounded local/Archive-01 searches. Await Nyx recovery decision. Router release remains draft/blocked; Pilot must review new head, then real workflow and alert gates remain.

## Production bundle repair boundary

Pilot c55f162a confirmed /setup fails only after bundling. Causes ranked: explicit Rollup external list confirmed; missing source components ruled out (four .ts re-exports and their parent components exist); dev-server success cannot prove emitted module resolution. Six source consumers use these UI imports. Netlify build also generates shadow .tsx placeholders despite existing .ts wrappers: remove that competing source generator and use the full frontend build. Active JS Vite config differs from TS sibling; edit the active config only. Bundle all local imports and fail future builds retaining @/ specifiers. SpotifySetup should use existing getAuthUrl like Dashboard, with a disabled pending button and visible failure. Wrapper copy must describe read-only checks. Reversal: revert commit; no hosted state or credentials touched. Tasks: patch, full checks, built-preview fixtures, final-head review handoff.

Production-bundle repairs verified: Rollup no longer externalizes local UI modules; new generateBundle guard rejects unresolved @/ imports. Netlify script no longer creates shadow placeholder .tsx files and runs npm run build with TypeScript. Existing getAuthUrl drives SpotifySetup continuation; pending action is disabled and failures render visibly. Wrapper copy describes availability only.

Full local lint, 15 tests, tsc/build pass. Production Vite preview fixture renders /setup and its configuration mismatch, /auth/callback error, authenticated Spotify readiness and intercepted accounts.spotify.com/authorize continuation with /auth/callback redirect. Zero page errors/writes. Git-directory/router-evidence/built-workflow.js and run-built-workflow.py reproduce it. No real authentication, provider consent or data recovery claimed. Prior /spotify-auth follow-up is now resolved; callback /settings remains a pre-existing recovery-workflow follow-up. Final-head review and real production workflow remain required.

## Callback destination repair

Pilot e9eb8df691f24baef49905191d85f5140072748e4e962c84ef513b03c0b0e0c6 retains two invalid destinations in the single SpotifyCallback component. /queue requires an ID and /settings is absent; /dashboard exists and owns queue selection and Spotify connect. Chose dashboard for both success and error recovery over inventing aliases or guessing a queue ID. All three callback route aliases share this component. Change touches two navigations and matching button text only; reversal is revert. Verify success using synthetic token exchange/storage fixtures, and error recovery in compiled preview. No real token, account or database changes.

Callback destinations repaired: success and error recovery use /dashboard with replace, and the button says Back to Dashboard. Full lint, 15 tests, TypeScript and build passed. Built-preview fixtures confirmed error recovery plus success for /auth/callback, /spotify-callback and /spotifycallback, each rendering the dashboard. Three synthetic token exchanges and three intercepted token-storage requests; zero unexpected writes or page errors. No real provider or customer writes. Evidence: Git-directory/router-evidence/callback-destinations.js, run-callback-destinations.py and callback-*. This resolves the earlier /queue and /settings callback follow-ups. Still blocked on Pilot final-head review, database recovery, real workflow, production deployment and alert closure.

## Connected Spotify control repair

Pilot 8af8f831 identifies the sole /queue-settings navigation in Dashboard. Measured: one caller, no registered global settings route; queue-specific management requires a queue ID. Ranked options: disabled connection indicator preserves the label and existing connection state; routing to a guessed queue is invalid without a selection; adding a settings page invents scope. Chose disabled status over the latter two because connection success is informational and existing queue cards own management. Revisit if account-wide settings are implemented. Touches one event handler, no styles, auth or data logic; reversal is a one-commit revert. Active JS build config and generated route file are landmines, neither needs alteration.

Tasks: [in progress] replace invalid action; [pending] full checks and built connected/disconnected fixture; [pending] commit, push and Pilot review. Recovery and real-workflow release gates remain blocked.

Connected control implemented and verified: full lint, 15 tests, TypeScript and production build pass. Built-preview fixture confirms connected control is disabled and cannot navigate, empty queue creation still reaches /create-queue, and disconnected Connect Spotify reaches intercepted authorization. Zero page errors/unexpected writes; no real OAuth or database recovery. Evidence: Git-directory/router-evidence/connected-*. The project-route register still expected the former GitDABA remote; authenticated PR read and actual origin confirm Bakke-Co/QueueBeats, so that single stale expected remote was refreshed. Tasks: implementation/checks complete; final-head review pending.
