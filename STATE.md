# QueueBeats router security

Execution: sec-github-queuebeats-react-router-20261103. Buzz issue 427c0adb508039428297bd7573c1f64b2399244e0f18a3f014b6e35777096bbc. Forge owns build; Pilot verifies. Source thread Mission Control / 802fc78ea5900c648fb99d290d523649e5447a3e022398ed8022f62823832854.

## Status

- [x] Map credential release overlap and preserve the original checkout and finisher.
- [x] Baseline full frontend checks on main 65e3672bf6297d456f3c125687b1fa9f71e41be9.
- [x] Pin react-router-dom 7.18.0 and update npm and Yarn locks.
- [x] Re-run all existing checks: identical TypeScript diagnostics before/after; lint lacks configuration in both; direct Vite production bundle builds.
- [ ] Browser routing checks and independent Pilot assessment.
- [ ] Resolve full-check blockers, obtain Pilot PASS on final head, merge and verify production and GitHub alerts.

## Decision and map

Chose: current-main isolated dependency branch, preserve both lock formats. Over: modifying credential branch, assuming credential gates cover dependencies, deleting Yarn support. Because: all four live alerts name the two locks and credential PR 2 is already merged. Revisit-if: validation or the credential owner identifies a release conflict.

RouterProvider consumes router.tsx and generated user-routes.tsx. Flat routes include queue parameters and a terminal wildcard; all pages share the same router package. React 18.2 and Node >=20.18 satisfy v7.18 package requirements. Imports remain through react-router-dom, which still re-exports the v7 APIs. No application code or TypeScript configuration changed. npm install updated both lockfiles; standalone Yarn 1 rejects the pre-existing yarn@4 packageManager declaration. Do not migrate package-manager formats incidentally.

## Baseline blockers and evidence

Full tsc/build fail before the upgrade with 63 TypeScript errors across 18 files. Before/after diagnostic logs match byte-for-byte. Diagnostics involve API Response shapes, generated Track types, auth return contracts, queue/song schema fields and other application types. Lint has no ESLint configuration. No frontend test script is declared. Evidence files baseline-{tsc,build,lint}.log and after-{tsc,build,lint,vite}.log are under the isolated worktree Git directory/router-evidence. Complete log and coordination record: /Users/nyx/.buzz/WORK_LOGS/FORGE_QUEUEBEATS_ROUTER_20261103.md. These are release blockers, not accepted exceptions.

Production was measured at ready deploy 6ae623df12b539f2109a9a59, commit 65e3672bf6297d456f3c125687b1fa9f71e41be9. The credential finisher is not running, last exit 1, and remains owned separately. No env, watcher, branch, secret or production changes made.

## Next steps

Finish browser comparison, present final head and baseline failures to Pilot. Keep PR draft and execution row open until full frontend gates are genuinely satisfied. Broader auth/data-contract fixes need an explicit coordinated scope rather than silently bundling them with this dependency update. GitHub alerts 249/250/419/420 require fixed status after merge, not merely a patched local lock.

Still unmapped: authenticated production workflow, current database health, full-check repair ownership. Generated .netlify files, generated user routes and netlify-build.sh outputs are not this change. Revert the dependency commit to roll back without reverting credential PR 2.

## Browser check, 03.11.2026

Live production showed Database Setup Required / Failed to check database tables. Continue Anyway rendered the homepage. Local upgraded production bundle showed the same database warning, then Authentication Error because its backend health check could not complete. A browser-only health fixture was attempted, but the browser session disappeared before an inspectable navigation result was captured. No router navigation success or authenticated workflow is claimed. Keep the live-workflow gate open.

The npm resolver reports only react-router-dom 7.18.0 and react-router 7.18.0; npm/Yarn versions, registry URLs and integrity hashes match. No application changes were required to build the bundle.
