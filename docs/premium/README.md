# Claudiator Premium — Commercialization Strategy Suite

> How to take Claudiator from a free skills library to a world-class, book-quality,
> premium content business — with pay-per-access tiers, licensing tokens, and a
> commercial go-to-market plan.

**Status:** Strategy (v1.0, July 2026) · **Owner:** Kalilur Rahman
**Basis:** Full content audit (346 repo skills / 546 shipped skills), product/tech audit of the
site and Supabase stack, platform research (Gumroad, Polar.sh, Lemon Squeezy, Paddle, Whop,
Payhip, Stripe+Keygen), market pricing benchmarks (2025–2026), and licensing-architecture research.

---

## The one-paragraph strategy

**Don't sell files — sell Field Manuals.** The free "Open Library" (~120 genuinely excellent
skills, post-triage) stays free forever as the SEO/AI-citation moat and marketing engine. The
paid product is a small set of curated, versioned, book-quality **volumes** — web + typeset
PDF/EPUB + template packs + capstone projects — with **lifetime updates** as the headline
promise, sold one-time (no subscription at launch) on a ladder from a **$19 Skill Pack**
tripwire through a **$79 Field Manual** to a **$249 Complete Library** anchor and
**$749–$1,199 Team** tiers. Primary platform: **Polar.sh** (full merchant of record, ~5% fees,
best-in-class native license keys); fallback: **Gumroad**. Licensing tokens are managed with
**Supabase as the single source of truth for entitlements**, fed by platform webhooks, with
gated downloads, per-buyer watermarking (social DRM), and per-seat team licensing.

## Why this works (the three numbers that matter)

1. **The market gap is real.** Raw prompt/skill packs are commoditized at $7–29; premium dev
   courses sell at $249–$795; the $99–249 "professional system" mid-market for Claude Code
   content is nearly empty. Claude Code itself went from $1B to $2.5B+ run-rate in under a year,
   and skills directories report 300k+ developers browsing monthly.
2. **The current corpus can't be sold as-is.** The audit found a 4-tier quality mix: ~15–20%
   flagship-grade, ~50% solid, ~25% thin, and 22 sub-100-line stubs — including 12 identical
   boilerplate shells under hot commercial names (llm-prompt-caching, guardrails-implementation,
   ai-observability…). All 546 skills ship today in one unauthenticated 8.1 MB public JSON.
   Premium requires triage + rebuild + server-side gating, in that order.
3. **One-time + lifetime updates beats subscription for a solo author.** Every proven
   solo-creator comparable (Refactoring UI $99/$249, Josh Comeau $149–$599, ShipFast
   $199–$299, Testing JavaScript $67–$332) is a tiered one-time purchase. A weekly-drop
   membership is a churn-and-burnout treadmill; defer it to year two.

## Document map

| Doc | What it covers |
|---|---|
| [01-STRATEGY.md](./01-STRATEGY.md) | Positioning, pricing ladder, platform decision, business model, year-one targets |
| [02-CONTENT-BLUEPRINT.md](./02-CONTENT-BLUEPRINT.md) | Audit findings, the book-quality gold standard (rubric), volume plan, editorial system |
| [03-LICENSING-ARCHITECTURE.md](./03-LICENSING-ARCHITECTURE.md) | License tokens end-to-end: Polar/Gumroad APIs, Supabase schema, edge functions, gating, watermarking, teams |
| [04-GTM-PLAYBOOK.md](./04-GTM-PLAYBOOK.md) | Launch sequencing, funnel design, email ladder, affiliates, pricing hygiene, benchmark tables |
| [05-RISK-LEGAL-CHECKLIST.md](./05-RISK-LEGAL-CHECKLIST.md) | 20 gaps a top-tier consultant would flag: content licensing, EULA, trademark, tax/entity, GDPR, refunds, capacity |
| [06-ROADMAP.md](./06-ROADMAP.md) | 90-day phased execution plan with gates and kill criteria |
| [07-PHASE-0-STATUS.md](./07-PHASE-0-STATUS.md) | What Phase 0 has completed vs. what still needs your decision |

## Non-negotiables (read these before anything else)

1. **No paid tier ships until Phase 0 triage is complete** and both launch volumes pass the
   rubric. Twelve empty stubs next to a $249 price is one Reddit post away from ending the
   business before it starts.
2. **Everything published before launch is permanently public** (git history, forks, Wayback,
   LLM training sets). Premium volumes must be substantively *new, rebuilt* material, authored
   in a private repo from day one.
3. **Resolve the trademark question before spending on brand.** "Claudiator" + paid products
   built around the Claude name needs review against Anthropic's usage policy
   (see [05-RISK-LEGAL-CHECKLIST.md](./05-RISK-LEGAL-CHECKLIST.md), item 4).
4. **Pick one honest number.** The catalog currently claims 129/100/82/346/546 skills depending
   on where you look. Post-triage, market one number — and make "we deleted 200 skills" the
   launch story.
