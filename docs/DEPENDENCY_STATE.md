# Root dependency compliance

Execution-ID: `compliance-npm-bakke-queuebeats`. Owner: Forge. Verifier: Pilot.
Updated 24.11.2026. This row remains open until review, shipment and the real weekly check.

## Source and scope

Netlify's site API identifies `Bakke-Co/QueueBeats`, branch `main`, as its build source.
Published deploy `6afdc242b1b35cde037b008b` is ready at
`afd19550476a0989dc21158a0e360ae2a39dfca8` (published `2026-11-18T15:21:06.454Z`).
Builds are enabled. The checkout is `/Users/nyx/Projects/_workspaces/queuebeats/repo`.
Its unfinished-looking Spotify branch is behind main, but its root manifests match main.
It is left unchanged; this work uses `fix/root-dependency-compliance-20261124`.

The weekly check instead reads `/Users/nyx/Projects/bakke/queuebeats`, a divergent non-Git
copy. Fresh audit there reports 2 critical and 8 high findings. A safe disposable fixture
shows semver-compatible audit fix still leaves 2 high findings requiring Fastify 5.
That upgrade would repair the wrong source. The production source has only one high
finding, transitive `follow-redirects`, and no vulnerable direct root dependency.

Chose: patch the production root lockfile from `follow-redirects` 1.16.1 to 1.16.3 and
correct the weekly check's source mapping with remote/branch identity checks.
Over: upgrading the stale copy, forcing Fastify 5, or suppressing its finding.
Because: Netlify's source is authoritative and the root target must measure that source.
Revisit-if: Netlify changes repository or branch, or the authoritative checkout moves.

The mapping must preserve `bakke/queuebeats`, `bakke/queuebeats/frontend`, and
`bakke/queuebeats/netlify/functions` labels and their existing issue rows. This task does
not close sibling rows. Their manifests and locks are unchanged by the dependency patch.

## Consumers and reversal

Axios 1.20.0 consumes follow-redirects. Root consumers include the legacy backend adapter;
Netlify's build installs root dependencies before building frontend and bundling functions.
The changed package is exercised through real local HTTP redirects and Axios. No database,
Spotify account, production service startup, credential or customer data changes are made.
Revert the dependency commit and source-mapping commit to reverse this work.

Root postinstall installs frontend; root `build.sh` rewrites source and upgrades global
Python pip. Qualification uses isolated installs and the configured `netlify-build.sh`,
never that unrelated global-pip path. Tracked `.netlify` bundles are generated artifacts.

## Evidence and open gates

- `npm ci --ignore-scripts` succeeds for the root lockfile.
- `node --test tests/*.test.cjs`: 4 pass. The same tests against the deployed lockfile fail
  specifically on cross-realm sensitive-header leakage (3 pass, 1 fail).
- Production root audit after patch: zero vulnerabilities at every severity.
- All four frontend/functions manifest and lock hashes match the before measurement.
- Frontend Vite production build passes.
- `npx tsc --noEmit` and the frontend package build fail with 63 existing diagnostics.
  A separate checkout of the deployed source produces byte-identical TypeScript output.
  No new diagnostic is introduced. These failures remain a package-check gate, not a green check.
- Pilot must judge the patch and source mapping before shipment or closure. Nyx owns the
  scope decision for the pre-existing frontend failures; do not silently waive them or
  convert this dependency task into an app restoration.

Raw receipts: `/Users/nyx/.buzz/WORK_LOGS/QUEUEBEATS_DEPENDENCIES_20261124/`.
Retain through 24.12.2026 or review closure, whichever is later; generated installs are disposable.
Advisory: https://github.com/advisories/GHSA-mrwp-f3q8-3g9p.

Still unmapped: production runtime bundle dependency inventory, database recovery status,
and unrelated frontend typing defects. Those are not certified by the root audit.
