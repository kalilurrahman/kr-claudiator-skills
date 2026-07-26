# 01 · Master Commercial Strategy

## 1. Positioning

**Claudiator Press — Field Manuals for Claude Code. Not prompts. Playbooks.**

Two facts force this positioning:

- **The current corpus is already public.** All 546 skills ship in an unauthenticated JSON
  (`public/data/skills-data.json`, 8.1 MB), are crawled, forked, and cached. You cannot
  retroactively charge for what the internet already has. Only *new, rebuilt, edited* content is
  defensibly premium.
- **Raw skill files are commoditized.** Free supply (anthropics/skills, Superpowers at 226k+
  GitHub stars, awesome-claude-code) has pushed raw prompt packs into a $7–29 impulse band with
  heavy buyer skepticism. What sells at $99–795 is *methodology, systems, evidence, and
  maintenance* — not files.

So the free tier and paid tier get different jobs:

| | Free "Open Library" | Paid "Field Manuals" |
|---|---|---|
| Job | Marketing engine, SEO/AI-citation moat, trust builder | Revenue |
| Content | ~120 genuinely excellent skills (post-triage), full text, real URLs | Curated, versioned volumes: 25–45 gold-standard skills + capstones + templates + typeset PDF/EPUB |
| Promise | "Every skill earns its place" | "Maintained, versioned, lifetime updates" |
| License | Permissive-with-attribution, chosen deliberately (see doc 05) | Commercial EULA, per-seat |

**The differentiator no free repo can match: maintenance.** Skills decay as models and the
Agent Skills spec evolve. "Versioned, tested, updated — forever" is the ShipFast angle applied
to a content product, and it is the honest core of the value proposition.

## 2. The pricing ladder

One-time purchases with lifetime updates. No subscription at launch (see §4). Prices sit
deliberately above the $7–29 commodity band and inside the thin $99–249 mid-market between
Gumroad packs and $795 courses.

| Tier | Price | Contents | Job |
|---|---|---|---|
| **Open Library** | $0 | ~120 excellent skills, full text, real static URLs (`/skills/<slug>/`), incl. flagship proof pieces (api-design, prd) rebuilt to the new standard | Funnel, SEO, trust |
| **Skill Packs** | $19 | 4–5 themed packs of 8–10 upgraded skills + printable checklist + one capstone walkthrough (e.g. *RAG in Production*, *K8s & Terraform*, *API Design Mastery*, *Threat Modeling Kit*) | Tripwire: convert browsers to buyers, harvest emails, seed pay-the-difference upgrades |
| **Field Manual** (per volume) | $79 | 25–45 gold-standard skills as web + typeset PDF/EPUB + template pack + one capstone chaining 5–8 skills + lifetime updates + 3-device license. Launch: **Vol. I — AI Engineering with Claude**, **Vol. II — Production DevOps** | Core product; $79 signals "book," not "prompt pack" |
| **Complete Library** | $249 (launch $169) | Every current *and future* volume, all capstones/templates, omnibus PDF/EPUB, private changelog, priority skill-request queue | Anchor — the tier the marketing sells; under the ~$300 "expense it without asking" line |
| **Teams** | $749 (5 seats) / $1,199 (10 seats) | Complete Library per seat, individual license keys per member, invoice/PO-friendly | Enterprise is >50% of Claude Code revenue; make procurement trivial |

**Order bumps:** +$10 book-editions bundle on any pack; +$29 Capstone Vault on a volume;
+$49 second volume at checkout. Target AOV ≥ $85.

**Upgrade paths:** pay-the-difference from any rung to the next (the Testing JavaScript
mechanic). Every $19 buyer is an open $60 upgrade opportunity.

**Pricing hygiene:**
- 30-day money-back guarantee (with the EU digital-content withdrawal waiver at checkout — doc 05, item 8).
- 7-day founding-price window (30–40% off) with a real deadline; max two sale events per year afterward (the Epic Web model — discount scarcity protects craft positioning).
- PPP regional pricing, capped at ~40% and bound to card country (doc 05, item 20).
- "Lifetime updates" contractually defined as *updates to this edition, minimum 24 months*, with a sunset clause (final DRM-free editions if updates cease). Reserves a paid v2 and converts an unbounded promise into a trust signal.

**Rationale from benchmarks:** Refactoring UI proved $99/$249 for self-published craft;
Comeau ($149–$599) and Dodds ($67–$332) prove ~2x tier steps and pay-the-difference; ShipFast
($199–$299, $1M+ revenue) proves lifetime-updates as the headline; Lenny's $300 tier proves the
"expense it" ceiling; Every's $1,350 Claude Code workshop and Maven's ~$3,500 AI Evals cohort
prove a live tier can sit far above self-serve later.

## 3. Platform: Polar.sh primary, Gumroad fallback

**Primary — Polar.sh** (open-source MoR, dev-native):

1. **Fees:** ~5% + $0.50 (free tier) vs Gumroad's effective ~12.9% + $0.80. On the $249 anchor
   that's roughly **$13 vs $33 per sale**. Polar Pro ($20/mo → 3.8%) pays for itself past
   ~25–30 sales/month. *Create the Polar org immediately — early orgs have kept grandfathered
   rates (4% + $0.40) in the past.*
2. **Full merchant of record** — calculates, collects, and remits VAT/GST/sales tax in 60+
   countries. Non-negotiable for a solo seller at global price points.
3. **Best-in-class native license keys** — custom prefixes, device-activation limits, expiry,
   usage quotas, automatic revocation on refund, and *public no-secret
   validate/activate/deactivate endpoints* safe to call from a static SPA or CLI (doc 03).
4. **Delivery benefits** that map 1:1 to the product: gated file downloads (10 GB), private
   GitHub repo access, Discord roles.
5. **Seat-based pricing** (beta) covers the Teams tier with per-seat benefit grants.
6. **Standard-Webhooks** events (HMAC-SHA256) with official SDKs and a sandbox.

**Fallback — Gumroad.** MoR since Jan 2025; per-sale license keys with a public
`POST /v2/licenses/verify` API; buyers always download the latest files (updates are easy);
built-in affiliates (1–75%). Costs: ~12.9% + $0.80 effective fees, 30% on Discover-attributed
sales, fee kept on refunds, ~1.4/5 Trustpilot with a documented suspension/payout-hold pattern,
no PayPal payout for India-based sellers, and an email gate until ~$100 earned. Acceptable —
the entitlement layer in doc 03 makes the vendor swappable — but only if Polar onboarding fails.

**Rejected:**
- **Lemon Squeezy** — in Stripe-migration limbo; storefronts/affiliates/license keys have no
  confirmed future in Stripe Managed Payments. Signing up fresh in 2026 means likely rebuilding within a year.
- **Paddle** — strongest MoR but no native license keys in Paddle Billing, SaaS-oriented, onboarding friction.
- **Whop** — partial MoR, payout fees, community/hustle branding is poison for craft positioning.
- **Payhip** — not a real MoR (EU/UK VAT only); weakest license tooling.

**Documented migration path:** Stripe + Keygen past ~$10k/mo, when the ~2.5-point margin gap
funds proper tax compliance. Until then, MoR is worth the premium.

**Verify before committing (blocking):** Polar seller-country eligibility and a successful test
payout for an India-based seller — the platform choice collapses if payouts fail
(doc 05, item 6). Complete identity verification in Phase 0, with a pre-committed Gumroad
fallback date.

## 4. Business model decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| One-time vs subscription | **One-time + lifetime updates** | Every proven solo-creator comparable is one-time tiered; a weekly-drop membership is a churn treadmill with a burnout guarantee for a solo author |
| Sell files vs sell editions | **Editions (volumes)** | Corpus already public; only rebuilt, versioned, multi-format editions are defensible |
| Marketplace vs own traffic | **Own traffic** | Gumroad Discover costs a flat 30%; the Open Library is the traffic engine |
| Free tier size | **Large (~120 skills, full text)** | Superpowers (226k stars) proves open-library compounding; bigger free tier = bigger funnel |
| Community at launch | **No** | Deferred to year two: a $99/yr "Forge" membership + Discord, only after two volumes ship and the list exceeds ~5,000 |
| Live/cohort tier | **Year two** | $500–1,350 workshop layer once self-serve proves demand |

## 5. Year-one financial frame

- **Target:** 800–1,500 Complete-Library-equivalents blended across the ladder ≈ **$120–300k
  gross**, at ~95% net of Polar fees.
- **Validation gate (before the big build completes):** ≥1,000 email subscribers or ≥100
  tripwire/pre-order sales by end of Phase 1. If missed: pause Vol. II, diagnose (traffic vs
  conversion vs offer), pivot packaging before building more (doc 06).
- **Sanity math at maturity:** 30k monthly visitors × 3% email capture × 4% buyer conversion at
  $85 AOV ≈ $3k/mo baseline, before launches, affiliates, and team deals — launches and volume
  releases are the spikes that carry the year.

## 6. What NOT to do

- Don't launch a $12/mo membership, a Discord, or weekly drops at launch.
- Don't sell anything until the 12 boilerplate stubs are deleted or rebuilt (doc 02).
- Don't put premium content in the public repo, the public JSON, or the PWA precache — ever (doc 03).
- Don't list on Gumroad Discover reflexively — the 30% marketplace fee applies to
  Discover-attributed buyers permanently.
- Don't discount more than twice a year after the founding window.
- Don't promise "everything forever": scope "lifetime updates" per edition, in writing.
