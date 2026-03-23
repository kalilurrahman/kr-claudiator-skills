---
name: go-to-market
description: Plan and execute a product go-to-market strategy covering ICP definition, channel selection, messaging, launch sequencing, and success metrics. Covers PLG, sales-led, and hybrid motions.
argument-hint: [product stage, target segment, current distribution, launch timeline, budget]
allowed-tools: Read, Write
---

# Go-To-Market Strategy

A go-to-market (GTM) strategy defines who you sell to, how you reach them, what you say, and in what order you do it. A technically excellent product with a poor GTM will fail. A mediocre product with a precise GTM can win a market segment. GTM is not a launch event — it is a repeatable system for acquiring, converting, and retaining customers.

## GTM Motions

| Motion | How growth happens | Works when |
|--------|-------------------|-----------|
| Product-led growth (PLG) | Product itself drives acquisition and expansion | Low friction product; strong network effects; viral loop possible |
| Sales-led growth (SLG) | Sales team finds and closes deals | High ACV; complex buying process; enterprise market |
| Marketing-led | Content, brand, SEO, paid bring inbound leads | Clear buyer persona; search volume for the problem |
| Community-led | Users recruit users; community is the moat | Strong practitioner community; open-source adjacency |
| Partnership-led | Integrations, resellers, marketplaces | Established distribution channels in the market |

## Process

1. **Define the ICP (Ideal Customer Profile)** — precise description of the best customer, not the broadest.
2. **Map the buyer journey** — who discovers, evaluates, decides, and renews? Each needs different content.
3. **Write the positioning statement** — for whom, what problem, what category, what benefit, versus what alternative.
4. **Choose the GTM motion** — PLG, SLG, or hybrid. Match to ACV and buying complexity.
5. **Select channels** — 2–3 channels to test; do not spread thin across all.
6. **Build the messaging hierarchy** — headline, proof points, differentiators, objection handlers.
7. **Sequence the launch** — internal → beta users → press → broad launch.
8. **Instrument the funnel** — every channel, every step; know where people fall off.
9. **Define success metrics** — not vanity metrics; CAC, conversion rates, activation, retention.
10. **Run weekly GTM reviews** — what is working, what is not, double down, cut what fails.

## Output Format

### ICP Definition

```markdown
## Ideal Customer Profile — [Product Name] v2

### Primary ICP: "The Scaling Engineering Team"

**Company:**
- Stage: Series A–C; 50–500 employees
- Industry: B2B SaaS, fintech, marketplace
- Engineering team: 15–80 engineers
- Infrastructure: AWS or GCP; Kubernetes; microservices
- Current pain: [specific pain point they will pay to solve]

**Buyer (economic):**
- Title: VP Engineering, CTO, Engineering Director
- Budget authority: $50k–$500k/year
- Buying trigger: [event that makes them seek a solution — e.g., "team doubled; current tooling doesn't scale"]
- Evaluation criteria: [3–5 specific things they evaluate]
- Decision timeline: 3–8 weeks for SMB; 3–6 months for enterprise

**Champion (internal advocate):**
- Title: Staff Engineer, Platform Engineer, DevEx lead
- Motivation: They want to solve the technical problem; they influence the VP
- How to reach them: [channel — e.g., "Hacker News, internal Slack communities, engineering blog"]

**Anti-ICP (who NOT to sell to):**
- Companies < 20 engineers (problem not painful enough; churns quickly)
- Companies with a strong "build-not-buy" culture (will not pay; will resent the product)
- Legacy enterprise on-prem (misaligned with product architecture; long sales cycle; low expansion)

### ICP Scoring Criteria (for sales qualification)

| Signal | Score | Weight |
|--------|-------|--------|
| Engineering team 15–80 | 10 | 25% |
| Series A–C funding | 8 | 20% |
| Uses AWS/GCP/K8s | 8 | 20% |
| Prior spend on dev tools | 10 | 15% |
| Inbound (came to us) | 7 | 10% |
| Champion is technical | 6 | 10% |

Minimum qualified score: 7.5/10
```

### Positioning Statement

```markdown
## Positioning — [Product Name]

### One-liner (for pitches, bios, ads)
"[Product] is the [category] that [key benefit], so [target customer] can [outcome]."

Example: "[Product] is the developer observability platform that automatically detects performance regressions in CI, so engineering teams can ship fast without breaking production."

### Full Positioning Statement (internal use)
**For:** [ICP — be specific, not "developers"]
**Who:** [struggle with specific pain point]
**[Product]** is a **[category]**
**That:** [primary benefit — what they get]
**Unlike:** [primary alternative they use today]
**Our product:** [key differentiator — why you win head-to-head]

### Messaging Hierarchy

| Level | Audience | Message |
|-------|---------|---------|
| Headline | All visitors | Stop [problem]. Start [outcome]. |
| Problem statement | Problem-aware buyers | [Quantified cost of the problem] |
| Solution | Solution-aware buyers | How [product] solves it, uniquely |
| Social proof | Evaluating buyers | Who uses it and what they achieved |
| Differentiators | Comparing alternatives | Why [product] vs [Competitor A] and [Competitor B] |
| Risk reducers | Decision-stage buyers | Free trial, security certs, exit terms |

### Objection Handling

| Objection | Response |
|----------|---------|
| "We built this in-house" | "How long did it take? What's the maintenance burden? Our customers tell us in-house solutions cover 60% of what they need — the edge cases are where most of the pain is." |
| "We're not ready to buy" | "Totally fine — let me show you how [champion] used the free tier to build internal momentum before getting budget." |
| "Too expensive" | "Compared to what? Our customers typically save [X hours/month] — at [their eng rate], that's $[Y/month]. We cost less than one engineer hour per day." |
| "[Competitor] does this too" | "They focus on [their strength]. We focus on [your differentiator]. For teams that [specific scenario], we consistently win because [proof point]." |
```

### Launch Sequencing

```markdown
## Launch Plan — [Product Name] v1.0

### Pre-Launch (T-8 weeks to T-1 week)
**Goal:** Build pipeline; create launch-day momentum.

Week -8: Onboard 10 design partners; weekly feedback sessions
Week -6: Beta programme opens (invite-only); 50–100 users
Week -4: Press briefings under embargo; analyst briefing (if relevant)
Week -3: Launch blog post drafted; case studies ready; screenshots approved
Week -2: Sales enablement complete; SDR trained on ICP, messaging, objections
Week -1: Beta users asked for launch-day social shares; Product Hunt scheduled

### Launch Week (T)
**Day 1 (Monday):** Email to existing users and waitlist; blog post live; PR embargo lifts
**Day 2 (Tuesday):** Product Hunt launch at 12:01am PT; all hands promote
**Day 3 (Wednesday):** LinkedIn / Twitter threads from founders and team
**Day 4 (Thursday):** Follow-up email to non-openers; partner announcements
**Day 5 (Friday):** Week-1 numbers to team; press follow-up

### Post-Launch (T+1 to T+8 weeks)
Week +1: Respond to every review, comment, and tweet
Week +2: First case study published; replay launch content for missed audience
Week +4: Analyse conversion by channel; double down on top-2 channels
Week +8: Retrospective; update ICP based on who actually signed up

### Launch Success Metrics (30 days)
| Metric | Target |
|--------|--------|
| New sign-ups | [X] |
| Activation rate (day 7) | > [Y]% |
| Trial → paid conversion | > [Z]% |
| Press pickups | [N] tier-1 publications |
| CAC by channel | < $[X] |
| NPS (first 30 days) | > 40 |
```

### Channel Strategy

```markdown
## Channel Prioritisation — Q1 Focus

### Primary Channels (80% of effort)

**1. Developer community (PLG)**
- Slack communities, Discord, Hacker News, Reddit r/devops
- What: Ship useful tools/content; be present in discussions; answer questions
- KPIs: Community sign-ups, referral rate from community
- Owner: DevRel + Founder

**2. Content / SEO (inbound)**
- Target: "how to [solve specific problem]" searches at 1k–10k/month volume
- What: Technical tutorials, comparison posts, integration guides
- KPIs: Organic sessions, sign-ups from organic, keyword rankings
- Owner: Marketing
- Timeline: Results in 3–6 months

### Secondary Channels (20% of effort)

**3. Outbound sales (SLG)**
- Target: ICP accounts identified via LinkedIn Sales Navigator + Clearbit
- What: Personalised outreach referencing their specific tech stack/pain
- KPIs: Meeting booked rate (>5%), pipeline generated
- Owner: SDR team

**4. Integration marketplace**
- Target: [Partner platform] marketplace listings
- What: Verified integration listing; co-marketing with partner
- KPIs: Installs from marketplace, co-marketing leads
- Owner: BD

### Channels NOT investing in (and why)
- Paid social: ACV too low for profitable B2B paid; revisit at Series B
- Events / conferences: Too expensive per lead at current stage; revisit in H2
- Analyst relations: Not yet at scale to influence enterprise; revisit at Series B
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| "Our market is everyone" | No focused message; no focused channel; no focused sale | Define the specific ICP segment you can win in the next 6 months |
| Launch and disappear | Day-1 spike; no sustained growth | Launch is the start of distribution, not the end |
| Too many channels at once | Thin investment; poor learning signal on any channel | Focus on 2–3 channels; get signal before expanding |
| Positioning by feature, not outcome | "We have 47 features" does not make anyone buy | "You will achieve [X outcome]" — buyers buy outcomes |
| Ignoring the champion | Only talking to the economic buyer | The champion does the internal selling; enable them |
| No ICP discipline | Selling to everyone; churning from misfit customers | Qualify hard; say no to non-ICP; track ICP vs non-ICP metrics separately |

## Rules

- **ICP before channel** — know exactly who you are selling to before deciding how to reach them.
- **Positioning is done when the customer can articulate it back** — if they cannot, rewrite it.
- **Two to three channels max at early stage** — depth of execution beats breadth of channels.
- **The champion sells internally; you enable the champion** — give them the language, the ROI case, and the risk reducers.
- **Launch is a habit, not an event** — great GTM teams launch every sprint, not once a year.
- **Measure CAC by channel from day one** — know which channel acquires customers profitably.
- **Track ICP vs non-ICP metrics separately** — non-ICP customers churn faster; pollute your retention data.
- **Sequence matters** — warm before cold; existing users before new; beta before broad.
- **Objection handling is a product** — build the objection library; every customer-facing person should use the same language.
- **GTM is a cross-functional sport** — product, engineering, marketing, and sales must be aligned on ICP, message, and sequencing.
