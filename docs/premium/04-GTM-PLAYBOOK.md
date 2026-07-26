# 04 · Go-To-Market & Marketing Playbook

## 1. Market context (why now)

- **Claude Code demand is compounding:** ~$1B run-rate ~6 months after GA (Nov 2025), $2.5B+
  by Feb 2026; weekly actives doubled since Jan 2026; business subscriptions quadrupled;
  enterprise is >50% of revenue; ~4% of public GitHub commits are Claude Code-authored.
- **Skills are the hot surface:** Agent Skills launched Oct 2025; the free Superpowers
  framework went from 27k to 226k+ GitHub stars in ~9 months; skill/plugin directories report
  300k+ developers browsing monthly.
- **The price map has a hole:** raw skill files sell at $7–29 (commoditized, skeptical buyers);
  premium Claude Code education sells at $795 (AI Hero) to $1,350 (Every's 2-day workshop) to
  ~$3,500+ (Maven's AI Evals cohort). The $99–249 "professional system" mid-market is thin.
  That's the wedge.

### Benchmark table (what proven products charge)

| Product | Model | Prices |
|---|---|---|
| Refactoring UI | one-time, 2 tiers + team | $99 / $249 |
| Josh Comeau (Joy of React) | one-time, 3 tiers, PPP | $249 / $399 / $599 |
| Testing JavaScript (Dodds) | one-time, 3 tiers, pay-difference | $67 / $136 / $332 |
| ShipFast (Marc Lou) | one-time, lifetime updates | $199 / $249 / $299 ($1M+ revenue) |
| Total TypeScript / AI Hero | one-time flagship | ~$795 |
| ByteByteGo | annual, lifetime = 2–3x | ~$84–189/yr |
| Lenny's / Pragmatic Engineer | annual + "expense it" tier | $150/yr; $300 tier |
| Every Claude Code workshop | live, 2-day | $1,350 |
| Claude Code packs on Gumroad | one-time files | $7–29 |

Patterns to copy: good-better-best with ~2x steps · pay-the-difference upgrades · lifetime
updates as headline · team/"expense it" tiers · PPP · rare, real discounts.

## 2. Launch sequencing — two-stage (free first, then founding)

**Stage 1 (free relaunch, weeks 9–10):** "**We deleted 200 skills**" post on HN, r/ClaudeAI,
and Product Hunt. 120 open skills, every one earning its place, each at a real crawlable URL.
Contributor program: accepted skill PR (with CLA — doc 05, item 17) = free Complete Library.
Nothing paid in this post. Goal: stars, email subs, and trust — the triage cost becomes the
launch asset, and it inoculates against the "screenshot the empty stub" attack.

**Stage 2 (founding launch, weeks 11–12):** Vol. I + Vol. II + Complete Library at $169
founding price, 7-day window with a real deadline. Order bumps live from hour one. Three
published before/after evals as proof. 10 pre-recruited affiliates. Day-14 email to every
Complete buyer offering team-seat conversion (+$299).

**Post-launch cadence:** one new volume every 6–8 weeks; each is a launch event emailed to all
lifetime buyers — **updates-as-marketing**. Two sale events per year, maximum.

## 3. The five highest-leverage marketing moves

1. **The "We deleted 200 skills" relaunch story.** Honest, contrarian, perfectly aimed at
   HN/Reddit skepticism about prompt-pack grift.
2. **120 free skills with real crawlable URLs.** Fixes a broken feature, creates 120 SEO
   landing pages each carrying a volume-specific upsell, and keeps llms.txt welcoming crawlers
   for the free tier — being the cited source in AI answers is this market's search.
3. **Before/after eval evidence.** Measured Claude Code output with vs. without each flagship
   skill. Nobody in the skills market shows evidence; it's the strongest counter to "free
   repos exist" and doubles as proof the rubric matters.
4. **The rubric manifesto + one full teaser chapter per volume.** Publish "What a book-quality
   skill looks like" as a manifesto; give away one complete premium skill per volume. The free
   sample IS the sales pitch (Refactoring UI's playbook). `api-design` and `prd` stay free
   deliberately as the standing demonstration.
5. **Own the email list + 30% affiliates.** Email capture from day one (exit-intent + in-modal;
   double opt-in — doc 05, item 9); never depend on platform email (Gumroad gates it; Polar's
   is basic). Recruit 10 named Claude-Code YouTubers/newsletter writers pre-launch — at 30% of
   a $249 sale they earn ~$75/conversion, far beyond promoting $29 packs. One-page affiliate
   agreement with FTC disclosure requirements (doc 05, item 18).

## 4. Funnel design

```
Traffic (SEO pages · HN/Reddit · AI-answer citations · YouTube affiliates)
  → Free skill page (full content + volume CTA + email exit-intent)
    → Email list (5-part welcome ladder)
      → $19 pack (tripwire; order bump +$10 book editions)
        → Day-3 pay-the-difference coupon → $79 volume (+$29 capstone bump)
          → $249 Complete (the tier marketing sells; launch $169)
            → Team seats ($749/$1,199; day-14 conversion email)
```

**Post-tripwire email ladder (5 emails):** delivery + quick win → capstone tease →
day-3 upgrade coupon → social proof/eval evidence → expiring pay-the-difference.

**KPIs:** visitor→email ≥3%; email→tripwire ≥4%; tripwire→volume upgrade ≥15%; AOV ≥$85;
refund rate <5%; measure citation→visit→email as its own funnel (AI answers will satisfy some
queries with zero clicks — the free tier must convert the clicks it does get).

**Cannibalization control (doc 05, item 15):** free pages and paid volumes must differ by
*artifact type*, not just topic — free = the practice essay + skill file; paid = worked
examples with real numbers, capstones, evals, templates, typeset editions, updates. Every free
page carries a volume-specific CTA, not a generic one.

## 5. Positioning & copy guidelines

- Lead with **outcomes and evidence** ("measured output, with receipts"), never "550+ prompts."
  Counting is what the commodity sellers do.
- **"Not prompts. Playbooks."** — the category-defining line: a book that is also a working toolchain.
- Name the enemy: AI-slop prompt packs. The triage story earns the right to punch at them.
- Be transparent about the human-edited, CI-tested workflow (doc 05, item 5) — provenance is a
  premium signal in 2026.
- Price framing: "$79 — the cost of one team lunch, for the API-design judgment of a principal
  engineer, updated forever."
- **Nominative-use brand hygiene:** "field manuals *for* Claude Code" — pending the trademark
  review (doc 05, item 4).

## 6. Channel plan

| Channel | Play | Cost |
|---|---|---|
| SEO / AI citations | 120 free skill pages, llms.txt, JSON-LD Offer markup | Build once |
| HN / r/ClaudeAI / PH | Two-stage launch posts; founder-voice, evidence-led | Time |
| Affiliates (10, named) | 30% via Polar; disclosure contract | Rev share |
| Email | Welcome ladder + volume-launch events | Tool cost |
| X/LinkedIn | Rubric excerpts, before/after evals, triage war stories | Time |
| YouTube collabs | Capstone walkthroughs with affiliate links | Rev share |
| GitHub | Open Library repo + contributor program (CLA-gated) | Time |

## 7. Support & operations (post-launch reality)

- Support inbox + license-FAQ page + self-serve device deactivation; reserve ~5 hrs/week.
- Refund policy page + EU withdrawal waiver at checkout; refunds honored fast and politely
  (each refund on Gumroad still costs its fee; on Polar the key auto-revokes).
- Affiliate payouts, PPP requests, team-seat admin: batch weekly.
- Public changelog page — the visible heartbeat of the "maintained" promise.
