# Database restart, 06.11.2026

The original Supabase project `thuqfmfgpodaxxvydbcz` was removed by the provider; no export of its
data was found. QueueBeats restarts **empty**: earlier accounts, queues, songs and votes are gone.

| What | Value |
|---|---|
| Project | `tkynafomqenuuzqfeems` (QueueBeats), eu-central-1 |
| Organization | `llulkszeaubcnupzyibl` (david@bakke.ai's Org), **Free plan, 0 kr** |
| Management token | `op://7tr6yo3acnhdlbltgkzexw7rce/j4r2xy2glurplrxlfkbsy6jwna` (read keys with `GET /v1/projects/tkynafomqenuuzqfeems/api-keys`) |
| Database login | `op://7tr6yo3acnhdlbltgkzexw7rce/nrjxgbun7a5ggwdgenuf2fosg4` |
| Schema | `supabase/migrations/20261106060000_baseline.sql`, applied 06.11.2026 |
| Auth | site URL `https://queuebeats.netlify.app`; redirects `https://queuebeats.netlify.app/**`, `http://localhost:5173/**`; email confirmation on |

Free-tier caveat: a Free project pauses after one inactive week and has no PITR or daily backup
download. Export the database before go-live if customer data starts arriving.

## Verified 06.11.2026 (two synthetic accounts, deleted afterwards)

Profile and settings triggers, queue create, join by access code, song add (owner and guest), vote
and vote update, creator reorder and mark-played, Spotify token upsert twice, realtime song insert
seen by a second client: all pass. Denied as intended: forged queue creator, forged song
`added_by`, forged vote, cross-user queue update, non-creator song delete, reading another user's
Spotify tokens, cross-user profile update, anonymous song add.

## Not done here

Cutover: Netlify `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` still point at the removed project. Those variables belong to the
credential row `queuebeats-spotify-secret-public-20261031` and must change together with its
finisher, so the build never mixes configurations.
