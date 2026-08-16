# Shade — Enterprise Heat-Safety Agent

FortyGuard Hackathon — Theme 3: Industrial & Enterprise.

An AI agent that turns hyperlocal temperature data into automatic, auditable
heat-safety decisions for outdoor/non-climate-controlled industrial workforces.

## Status: buildable today, zero API keys required

Every external dependency has a free fallback baked in, so you can `npm run dev`
right now with an empty `.env.local` and the whole pipeline works end to end:

| Dependency | If key is set | If key is NOT set |
|---|---|---|
| FortyGuard Temperature API | real hyperlocal data | falls back to **Open-Meteo** (free, no key, real live weather) |
| Groq (LLM agent) | real LLM tool-calling recommendation | falls back to a **deterministic rule-based recommender** |
| Slack webhook | posts the action card to Slack | logs it to the server console instead |

This means: **start building today**. Swap in the real FortyGuard key the moment
hackathon registration gives you one — nothing else in the app needs to change,
because everything downstream only depends on the `Conditions` shape `lib/fortyguard.ts`
returns, not on where the data came from.

## Setup

1. Sign up at [turso.tech](https://turso.tech) (free tier, no card required) and create a database.
2. Copy `.env.example` to `.env.local` and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click **Refresh conditions** to pull live data
(Open-Meteo by default) for the four seeded demo sites, compute risk, and
generate recommendations. The database schema and seed data are automatically
set up on the first connection using Turso.

### Getting real keys later (all free)

1. **FortyGuard** — claim your hackathon trial API key at registration, then
   fill in `FORTYGUARD_API_KEY` and confirm `FORTYGUARD_BASE_URL` + the two
   `TODO`s in `lib/fortyguard.ts` against FortyGuard's real API docs.
2. **Groq** (optional, upgrades the agent from rule-based to a real LLM) —
   free key at https://console.groq.com/keys, no card required.
3. **Slack** (optional, for real action-card notifications) — create a free
   workspace, add an Incoming Webhook, paste the URL into `SLACK_WEBHOOK_URL`.

## Project layout

```
config/jurisdictions.json   heat-safety rule thresholds per jurisdiction (OSHA/UAE/custom)
data/sites.seed.json        demo sites + synthetic crews & shifts (real coordinates)
lib/
  fortyguard.ts             THE PLACEHOLDER — swap real key in here, see TODOs
  openmeteo.ts               free live-data fallback
  risk-engine.ts             Heat Index + WBGT math, pure functions
  db.ts                      Turso schema + seeding
  agent.ts                   LLM recommendation (Groq) + rule-based fallback
  dispatcher.ts               Slack post + compliance_log writer
  pipeline.ts                 glues the above together per site
app/
  api/                       REST routes (sites, risk, recommendations, ingest, export)
  page.tsx                   dashboard (map + action feed)
  components/                MapView (Leaflet), ActionFeed
```

## Team workflow (Karthi + Kavya)

Branches: `main` (always working/demoable) ← `dev/karthi`, `dev/kavya`.

**Module split (minimizes merge conflicts — mostly different folders):**
- **Karthi — data & logic**: `lib/fortyguard.ts`, `lib/risk-engine.ts`, `lib/agent.ts`,
  `lib/dispatcher.ts`, `lib/pipeline.ts`, `lib/db.ts`, `app/api/**`, the real
  FortyGuard integration once the key arrives.
- **Kavya — experience**: `app/page.tsx`, `app/components/**`, styling, the
  Scenario Runner / demo-walkthrough UX, the compliance export view.

Swap freely if it fits your strengths better — the point is each person owns
folders the other rarely touches.

**Daily loop:**
```bash
git checkout dev/<you>
git pull origin main --rebase     # start each day on top of latest main
# ... work, small commits ...
git push origin dev/<you>
# open a PR into main; merge same-day, don't let branches drift more than a day
```

Keep PRs small and frequent (once a feature/module is working, not once the
whole app is done) — with two people on a tight deadline, a 3-day-old branch
is the single biggest risk to your schedule, not a lack of features.

## Next steps

- [ ] Wire the real FortyGuard key in once you have it (see TODOs in `lib/fortyguard.ts`)
- [ ] Add a Scenario Runner (`/api/scenario/step`) that replays a pre-fetched
      sequence on a compressed timeline for the live demo — don't rely on
      real wall-clock time crossing a threshold while judges watch
- [ ] Add a timeline component showing shifts + risk overlay (currently only
      the map + action feed exist)
- [ ] PDF export (CSV export already works at `/api/compliance/export`)
- [ ] Basic auth if you deploy a public link (skip entirely if demoing locally/by video)
