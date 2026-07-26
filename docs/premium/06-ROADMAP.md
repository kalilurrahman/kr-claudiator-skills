# 06 · 90-Day Execution Roadmap

Four phases with explicit gates. The single rule that overrides everything:
**no paid tier ships until Phase 0 is complete and both launch volumes pass the rubric.**

## Phase 0 — Credibility Triage (Weeks 1–2) · BLOCKS EVERYTHING

Content:
- [ ] Delete or rebuild the 12 mad-libs stubs (live under hot names: llm-prompt-caching,
      guardrails-implementation, ai-observability, data-contracts, reverse-etl,
      identity-governance, notification-system, search-architecture, property-based-testing,
      streaming-api, product-discovery, product-strategy) and the 10 thin stubs (doc 02 §3).
- [ ] Remove duplicates: vestigial `02-devops/` dir, doubled `security-testing`, one of the two
      pagination skills, stray root `SKILL.md`.
- [ ] Restore truncated `enterprise-sales-enablement` from the shipped JSON (306-line version).
- [ ] Remove fabricated "claude-5-mythos/fable" model IDs; correct all model references.
- [ ] Build ONE script that generates README counts, INDEX.md, and site JSON from the skill
      directories — one honest number everywhere, enforced in CI.

Site hygiene:
- [ ] Fix expired og:image, broken install command, Favourites data source; standardize the
      domain on claudiator.kalilurrahman.com.

Legal/commercial setup (parallel — see doc 05):
- [ ] Choose and add the free-tier LICENSE (deliberate choice, not default MIT).
- [ ] Review Anthropic trademark/usage policy; register fallback brand + domain.
- [ ] Create the Polar org NOW; complete identity verification; verify India payout with a test
      transaction; pre-commit a Gumroad fallback date.
- [ ] Engage a CA (GST/LUT, FEMA, entity for Teams tier).
- [ ] Create the PRIVATE content repo — all premium authoring happens there from day one.

**Gate G0:** one honest skill count live · zero empty stubs live · license chosen · Polar
payout verified (or fallback triggered) · private repo active.

## Phase 1 — Build the Bar in Public (Weeks 3–8)

- [ ] Publish the gold-standard rubric as a manifesto post ("What a book-quality skill looks
      like") — this IS the marketing (doc 04 §3.4).
- [ ] Rebuild **Vol. I — AI Engineering with Claude** against the rubric (rag-architecture with
      the asyncio bug fixed, llm-evaluation, model-monitoring + rebuilt prompt-caching /
      guardrails / observability, all rebased on the Claude API).
- [ ] Rebuild **Vol. II — Production DevOps** (docker-compose, kubernetes-manifest,
      terraform-module, ci-cd-advanced, secrets-management, monitoring-setup, alerting-rules).
- [ ] Stand up content CI: every code block executes; frontmatter lint; mermaid validation;
      rubric-section checks.
- [ ] Every rebuilt skill: mermaid diagram + ≥2 worked examples + checklist artifact.
- [ ] One capstone per volume; typeset PDF/EPUB pipeline.
- [ ] Produce 3 before/after evals (Claude Code output with vs. without flagship skills).
- [ ] Email capture live from day one (exit-intent + in-modal; double opt-in; privacy policy
      shipped first — doc 05 §9). Weekly build-in-public posts.

**Gate G1 (validation):** ≥1,000 email subscribers OR ≥100 tripwire/pre-order sales.
**If missed:** pause Vol. II completion; diagnose traffic vs conversion vs offer; consider
launching Vol. I alone at $79 with the Complete tier deferred; only resume the full build when
a signal passes. (Capacity rule from doc 05 §12: if the rubric slips, cut scope to one volume —
never cut the rubric.)

## Phase 2 — Licensing & Commerce Infrastructure (Weeks 6–9, parallel)

Build order from doc 03 §10:
- [ ] Supabase schema (purchases/licenses/entitlements/teams/seats/premium_skills/releases).
- [ ] `polar-webhook` edge function; sandbox purchase → entitlement row verified end-to-end.
- [ ] `claim` flow (magic link + license-key redeem) + `/account` page (downloads, devices,
      seats).
- [ ] Teaser/full split pipeline; `get-skill` gate; SkillModal "Unlock" CTA; gate
      `getSkillContent()` / `getInstallCommand()`.
- [ ] `download` function with per-buyer watermarking + private bucket + rate limits.
- [ ] Teams seat flow.
- [ ] Polar products + checkout links + order bumps configured; EULA + refund policy + ToS +
      privacy pages live.
- [ ] **Launch-day leak purge rehearsed** (doc 03 §8): strip premium from public JSONs +
      skills-pack, bump PWA cache version, robots/llms.txt/JSON-LD updated.

**Gate G2:** a stranger can buy in sandbox, claim by magic link, read gated content, download a
watermarked PDF, get revoked on refund — all verified.

## Phase 3 — Two-Stage Launch (Weeks 9–12)

**Weeks 9–10 — free relaunch:** "We deleted 200 skills" on HN / r/ClaudeAI / Product Hunt;
120 open skills at real URLs; contributor program (CLA-gated, accepted PR = free Complete
Library). Nothing paid in this post.

**Weeks 11–12 — founding launch:** Vol. I + Vol. II + Complete Library at $169 founding
(7-day window, real deadline); order bumps live from hour one; 3 evals published; 10 affiliates
(30%, signed disclosure agreements) activated; day-14 team-seat conversion email to Complete
buyers.

**Gate G3 (day 30 post-launch):** refund rate <5% · support load <5 hrs/week · AOV ≥$85.

## Post-90 cadence

- One new volume every 6–8 weeks: System Design → Security → PM Operating System → Executive
  Playbooks 2nd ed. Each is a launch event emailed to all lifetime buyers (updates-as-marketing).
- Model/spec releases trigger a triage sweep + visible changelog entries.
- Year-two options (pre-decided, launch only if two volumes shipped AND list >5,000):
  $99/yr "Forge" membership + Discord; $500–1,350 live workshop tier.
- Revisit platform at ~$10k/mo: Stripe + Keygen migration math (doc 01 §3).

## Workstream × week map

| Workstream | W1–2 | W3–5 | W6–8 | W9–10 | W11–12 |
|---|---|---|---|---|---|
| Content triage | ████ | | | | |
| Vol. I rebuild | | ████ | ██ | | |
| Vol. II rebuild | | ██ | ████ | | |
| Content CI + typesetting | | ██ | ██ | | |
| Licensing infra (doc 03) | | | ████ | ██ | |
| Legal/tax/platform setup | ████ | ██ | | | |
| Marketing (manifesto, evals, list) | | ██ | ██ | ████ | ████ |
| Launches | | | | free | founding |
