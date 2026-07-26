# 02 · Book-Quality Content Blueprint

What "world-class, book-quality" means operationally, what the audit found, and the editorial
system that closes the gap.

## 1. Audit findings (July 2026) — the honest baseline

The repo holds **346 SKILL.md files (~103k lines)**; the live site serves **546 skills across
20 categories**, ~138 of which exist only in the shipped JSON with no source in the repo.
Quality is a four-tier mix, not uniform:

| Tier | Share | Description | Examples |
|---|---|---|---|
| **A — flagship** | ~15–20% | Proof the author can hit book quality: full spec templates, worked examples with decision rationale, anti-pattern tables, opinionated rules | `01-software-dev/api-design` (444 lines, full OpenAPI template, "integer cents not floats" rationale), `09-product-management/prd`, `pricing-strategy` (van Westendorp + real value-metric examples), `05-security/threat-modeling` (concrete STRIDE tables), `06-system-design/api-gateway` (real Kong config, 641 lines), `02-devops-infra/docker-compose` (679 lines) |
| **B — solid** | ~50% | Consistent skeleton, real content, uneven depth | most of 01/02/05/06/07/08 |
| **C — thin** | ~25% | 100–200 lines, sparse examples | much of 03, 09 |
| **D — empty shells** | 22 files <100 lines | **12 are literally the same mad-libs template** with only the topic name substituted — zero domain content — under some of the hottest commercial names | `llm-prompt-caching`, `guardrails-implementation`, `ai-observability`, `data-contracts`, `reverse-etl`, `identity-governance`, `notification-system`, `search-architecture`, `property-based-testing`, `streaming-api`, `product-discovery`, `product-strategy` |

Additional defects that block premium credibility:

- **Catalog metadata is incoherent** — README says 129 skills, INDEX.md says 100,
  SKILLS_INDEX.md says 82, the repo has 346, the site serves 546. Four conflicting counts is a
  fatal trust signal for a paid product.
- **Repo and site are out of sync** — `enterprise-sales-enablement` is truncated mid-code-block
  at 43 lines in the repo but ships as 306 lines in the JSON; a stray copy of the
  streaming-pipeline skill sits at the repo root as `SKILL.md`.
- **Duplicates** — `02-devops/` is a vestigial byte-identical copy of `02-devops-infra/`'s
  ci-cd-pipeline; `security-testing` exists identically in both 05 and 07;
  `pagination-design` and `api-pagination-design` near-duplicate each other in 01.
- **Templated bulk categories** — 60 of 65 leadership-strategy skills share one persona
  template; all 20 executive playbooks share a single opener; the "Claude 5" category contains
  invented model IDs in frontmatter (`claude-5-mythos | claude-5-fable`) — a factual-accuracy
  and brand-risk problem in a paid product.
- **Flagship code defects** — `04-ai-ml/rag-architecture` has broken asyncio code and a naive
  eval method; 10 of 48 AI/ML skills use OpenAI/GPT-4 examples — off-brand for a product named
  after Claude; docker-compose uses the deprecated `version:` key with hardcoded passwords while
  claiming "production-ready."
- **Missing premium differentiators (measured):** 29/346 skills have a Worked Example section;
  **1/346** uses a mermaid diagram; ~4 mention a case study; zero capstones, zero multi-skill
  learning paths, zero versioning/changelogs, zero published evidence that any skill improves
  Claude Code output.

**Conclusion:** the best 20% proves the bar is reachable. The product needs triage, one
enforced gold standard, and net-new premium artifacts — not more volume.

## 2. The Gold Standard — definition of "book quality"

Every skill in a paid volume must pass ALL of the following. Publish this rubric publicly —
the rubric itself is marketing (§5).

### Structure (the anatomy of a premium skill)
1. **Frontmatter** — name, description, argument-hint, allowed-tools; version + changelog fields; only real, verifiable model/tool identifiers.
2. **Context & stakes** — why this practice matters, when to reach for it, when NOT to (a "don't use this when" list is a premium tell).
3. **Decision framework** — the 2–4 architectural choices the reader must make, with a decision table and explicit trade-offs.
4. **Process** — numbered, imperative steps a practitioner (or Claude) can follow.
5. **Diagram** — at least one mermaid diagram (architecture, sequence, or decision flow). Currently 1/346 — the cheapest perceived-quality win.
6. **≥2 worked examples** — realistic scenario, real numbers, inputs → outputs, and *rationale for each decision* ("integer cents, not floats, because…"). This is the single biggest gap between Tier A and everything else.
7. **Production-grade code** — every block runs against a CI test harness (see §4). No deprecated APIs, no hardcoded secrets, Claude-first examples for AI skills.
8. **Anti-patterns table** — symptom → why it fails → what to do instead.
9. **Checklist artifact** — a standalone printable/copyable checklist (shipped in the template pack).
10. **10 opinionated rules** — the author's judgment, not a summary. Craft products sell judgment.
11. **References & further reading** — curated, current, real.

### Quality gates
- **Accuracy gate:** every factual claim and API/model reference verified against current docs at publication.
- **Evidence gate:** flagship skills ship a before/after eval — measured Claude Code output with vs. without the skill. Nobody in this market shows evidence; it is the strongest counter to "free repos exist."
- **Voice gate:** one voice across the volume (currently three distinct authoring generations are visible). A style guide + single-editor pass per volume.
- **Length is an output, not a target:** the mad-libs stubs prove line-count targets generate filler. The rubric is the target.

### Per-volume artifacts (what makes it a "book," not a folder)
- **Capstone project** chaining 5–8 skills into an end-to-end build with a walkthrough.
- **Typeset PDF/EPUB** (professional typography; not a markdown export).
- **Template pack** — checklists, config templates, decision-record templates.
- **Versioned changelog** — visible proof of the maintenance promise.

## 3. Triage plan (Phase 0 — blocks everything)

1. **Delete or rebuild** the 12 mad-libs stubs and 10 thin stubs (graph-analytics 58 lines,
   service-catalog 67, semantic-layer 69, data-observability 72, analytics-engineering 79,
   multimodal-ai 81, chaos-testing-infra 87, webhook-security 96, ai-cost-optimisation 99,
   enterprise-sales-enablement 43). They ship live today under hot names.
2. **Remove duplicates:** the vestigial `02-devops/` dir, the doubled `security-testing`, one of
   the two pagination skills, and the stray root `SKILL.md`.
3. **Fix broken content:** restore `enterprise-sales-enablement` from the shipped JSON (306-line
   version); fix the rag-architecture asyncio bug; remove fabricated model IDs from the
   Claude 5 category or rewrite that category against real, current model documentation.
4. **One source of truth:** a build script that generates README counts, INDEX.md, and the site
   JSON *from the skill directories* — one honest number everywhere, enforced by CI.
5. **Reconcile the ~138 JSON-only skills:** commit their sources to the (private) content repo
   or retire them.

## 4. Editorial system (how quality persists)

- **Private content repo** for everything premium from day one — git history in the public repo
  is permanently public (doc 05, item 2).
- **CI for content:** extract every fenced code block and run it (containerized per language);
  lint frontmatter; validate mermaid syntax; spellcheck; broken-link check; rubric-section
  presence check. A skill that fails CI cannot merge.
- **Definition of Done = the rubric.** A tracked scorecard per skill (rubric items as columns).
- **Two-pass editing:** author pass, then a single editor pass per volume for voice (contract a
  technical editor from Vol. II — doc 05, item 12).
- **Update cadence:** every model release or Skills-spec change triggers a triage sweep;
  changelog entries are user-visible. Updates are the product promise — budget ~20% of ongoing
  time for maintenance.

## 5. Volume plan

| # | Volume | Core skills (rebuilt to standard) | Why this order |
|---|---|---|---|
| I | **AI Engineering with Claude** | rag-architecture (bug-fixed), llm-evaluation, model-monitoring, prompt-caching, guardrails, ai-observability — rebased on the Claude API | Hottest demand; the 12 stubs it replaces are the most damaging; strongest before/after eval material |
| II | **Production DevOps** | docker-compose, kubernetes-manifest, terraform-module, ci-cd-advanced, secrets-management, monitoring-setup, alerting-rules | Deepest existing Tier A/B base — fastest path to a second volume |
| III | **System Design Field Manual** | api-gateway, event-driven-architecture, caching, search, notifications (rebuilt) | Evergreen; interview-adjacent demand |
| IV | **Security Field Manual** | threat-modeling, secrets-management, webhook-security (rebuilt), identity (rebuilt) | Flagship threat-modeling anchors it |
| V | **The PM Operating System** | The 40-skill PM set — most uniform base, cheapest polish | Different buyer; tests non-engineer demand |
| VI | **Executive Playbooks, 2nd ed.** | The 20 CXO playbooks, rewritten from the shared template into real playbooks | Top of the $249 tier's perceived value |

**Free-tier flagships stay free deliberately:** `api-design` and `prd`, rebuilt to the new
standard, remain in the Open Library as the standing public demonstration of the paid bar
(the Refactoring UI teaser-chapter playbook).

## 6. Formats and packaging

- **Web** (gated reader for buyers — doc 03), **PDF + EPUB** (typeset, watermarked per buyer),
  **raw SKILL.md pack** (installable, stamped), **template pack** (zip), **capstone repo access**.
- Skills are written to be dual-use: readable as chapters by humans, installable as SKILL.md by
  Claude Code. That duality — *a book that is also a working toolchain* — is the product's
  category-defining move, and no competitor does both.
- **Frame content ~70% durable engineering practice / ~30% Claude-specific mechanics** so the
  volumes survive model/spec churn and port to other agent harnesses (doc 05, item 14).
