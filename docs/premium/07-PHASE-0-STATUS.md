# 07 · Phase 0 Status & Handoff

Snapshot of Phase 0 (Credibility Triage) completion vs. what still requires
your action before Phase 1 can start.

## Done (this session)

**Content triage**
- 12 mad-libs stub skills rebuilt to the gold standard (data-contracts,
  reverse-etl, ai-observability, guardrails-implementation, llm-prompt-caching,
  identity-governance, notification-system, search-architecture,
  property-based-testing, streaming-api, product-discovery, product-strategy).
  Every rebuild has a decision framework, a mermaid diagram, ≥2 worked examples
  with real numbers and stated rationale, current-API code (Claude API
  specifics verified against live docs — `cache_control`/TTLs, vision patch
  formula, Batch API pricing), an anti-patterns table, a copyable checklist,
  and 10 opinionated rules.
- 9 thin stubs rebuilt to the same standard (graph-analytics, service-catalog,
  semantic-layer, data-observability, analytics-engineering, multimodal-ai,
  chaos-testing-infra, webhook-security, ai-cost-optimisation).
- Byte-duplicate content removed: vestigial `02-devops/` dir,
  `07-testing-quality/security-testing`, `01-software-dev/api-pagination-design`,
  stray root `SKILL.md`.
- Truncated `09-product-management/enterprise-sales-enablement` restored from
  the shipped site data (43 → 306 lines, closed mid-code-block).
- Fabricated `claude-5-mythos | claude-5-fable` model IDs replaced with the
  real ID in all 13 Claude 5 skills.

**One honest count**
- `scripts/audit_skills.py`: repo/site counts, duplicate and stub detection,
  drift report. Exit 0 for the first time (0 duplicates, 0 sub-100-line stubs).
- `scripts/generate_index.py`: `INDEX.md` is now generated from the tree
  (343 skills with per-skill description + line count); the old hand-written
  version claimed 100.
- Stale process artifacts archived to `docs/archive/` (SKILLS_INDEX.md,
  STATUS.md, PROGRESS.md, BATCH_8/9_SUMMARY.md, FINAL_SESSION_SUMMARY.md,
  DIRECTORY_STRUCTURE.txt — each had a different count).
- README.md rewritten with generated, accurate numbers.
- `.github/workflows/ci.yml`: every push/PR runs the audit, verifies INDEX.md
  freshness, and runs site tests + production build.

**Site hygiene**
- Domain standardized on `claudiator.kalilurrahman.com` across canonical tags,
  og:url, JSON-LD, sitemap.xml, robots.txt, and `SITE_URL` in code.
- Expired third-party og:image replaced with self-hosted `/og.png` +
  `scripts/generate_og_image.py` (reproducible; re-runs when the count changes).
- Broken Install button fixed: `getSkillSlug` slugifies names (89 skills had
  spaces in their names, breaking their curl URLs), and
  `scripts/generate_static_skills.py` emits 542 real
  `/skills/<slug>/SKILL.md` static files — every skill now has a crawlable URL,
  which doubles as the SEO landing-page asset in the GTM plan (doc 04 §3.2).
- Favourites page fixed to load the bundled dataset first, so favourited
  skills that only exist in `skills-data.json` no longer silently vanish.
- Honest counts on user-facing surfaces: `targetSkills` 500/513 → 600;
  "500+" copy → "540+"; Hero fallback 546 → 544; progress bar no longer >100%.

## Not started — requires your input or a decision only you can make

These are unlocked by Phase 0 completing but cannot be done inside a session:

1. **Choose the free-tier LICENSE** (doc 05 item 1). Repo has no LICENSE file
   today. Options and trade-offs:
   - CC BY-NC-SA 4.0 — attribution + share-alike + **no resale** (protects the
     free tier from being rebundled and sold; not OSI "open source" — update
     the site copy).
   - MIT — maximally permissive, but anyone can rebundle and resell.
   - Dual: CC BY-NC-SA on `NN-*/**/*` skill dirs, MIT on `src/` and `scripts/`.
   Recommendation: dual license (CC BY-NC-SA on content, MIT on code).
2. **Anthropic trademark review** (doc 05 item 4). Read Anthropic's usage
   policy against the current "Claudiator" brand and paid product names.
   Pre-register a fallback domain and product name before any launch spend.
3. **Polar.sh org + India payout verification** (doc 05 item 6). Blocking:
   the platform recommendation collapses if Polar can't pay an India seller.
   Create the org today, complete identity verification, run a test payout,
   and pre-commit a fallback date after which you switch to Gumroad.
4. **Engage a chartered accountant** (doc 05 item 7) for GST/LUT (export of
   services), FEMA remittance handling, and the entity structure the Teams
   tier will need for W-8/vendor forms.
5. **Create the private content repo** (doc 05 item 2). Everything premium
   is authored there from day one — git history in the public repo is
   permanently public.

## Also queued (not blocking Phase 1 but worth scheduling)

- **Reconcile the 202 site-only skills.** `scripts/audit_skills.py` shows
  202 skills that live in `public/data/skills-data.json` but have no source in
  the repo — mostly `10-architecture` (26), `11-cross-functional` (14),
  `12-leadership-strategy` (65), `13-claude-5` (13), `14-executive-playbooks`
  (20), and small stubs. Either commit their sources to the repo (preferred:
  they become CI-checked like every other skill) or retire them from the site.
  The audit script tracks the exact list; this is a batch task, not blocking.
- **Rebuild the leadership/executive template families** (docs/premium/02
  §1). ~60 leadership-strategy skills share one persona template and all 20
  executive playbooks share one opener — the same commercial-credibility risk
  as the mad-libs stubs, just under less-hot names. Queue for Vol. VI once
  the launch volumes ship.
- **Reduce PWA precache footprint.** Once premium content ships,
  `public/data/skills-data.json` must be split into a public-teaser dataset
  and a gated full dataset (doc 03 §8) — the current 8.4 MB bundled JSON is
  precached to every visitor's device by the service worker.

## Numbers, before → after

| Metric | Before | After |
|---|---|---|
| Sub-100-line stubs | 21 | **0** |
| Mad-libs boilerplate skills | 12 (74 lines each) | **0** (all 350–414 lines) |
| Exact-duplicate skill files | 4 groups | **0** |
| Skill counts claimed across surfaces | 4 different (129/100/82/546) | **1** honest (343 repo / 544 site, generated) |
| Broken Install command | yes | **fixed** (542 static URLs emitted) |
| Broken social share card (expired image) | yes | **fixed** (self-hosted og.png) |
| Domain in site code | `kr-claudiator-skills.lovable.app` | `claudiator.kalilurrahman.com` |
| CI gate on content quality | none | audit + INDEX freshness + tests + build |
| `scripts/audit_skills.py` exit | 1 (defects) | **0** (clean) |

The bar for launch is now technical, not editorial: the corpus can honestly
be pointed at, and every future rebuild inherits the same CI gate.
