---
name: customer-journey-map
description: Create customer journey maps documenting touchpoints, emotions, pain points, and opportunities. Outputs visual journey maps, moment-of-truth analysis, and prioritised improvement backlog.
argument-hint: [customer segment, journey scope, data available, format needed]
allowed-tools: Read, Write
---

# Customer Journey Map

A customer journey map visualises a customer's experience across all touchpoints with your product or service. It reveals where customers struggle, what delights them, and where they drop off — giving the team a shared, evidence-based view of the customer experience.

## Process

1. **Define scope.** Which customer segment? Which journey (acquisition, onboarding, core use, renewal, support)? Start narrow — one segment, one journey.
2. **Gather data.** Customer interviews, session recordings, support tickets, NPS verbatims, analytics funnels. Don't map assumptions — map evidence.
3. **Define stages.** The high-level phases the customer moves through (Aware → Consider → Try → Buy → Use → Renew).
4. **Map touchpoints.** Every interaction with your product, team, or brand at each stage.
5. **Add emotions.** What is the customer feeling at each point? Use evidence, not empathy alone.
6. **Identify pain points and moments of truth.** Where do emotions dip? Where do decisions get made?
7. **Find opportunities.** What would move the emotion curve up? Prioritise by impact and effort.
8. **Socialise and act.** The map is only valuable if it drives decisions. Put it on the wall; reference it in sprint planning.

## Journey Map Template

```markdown
# Customer Journey Map: [Segment] — [Journey Name]

**Customer segment:** Mid-market B2B SaaS buyer (IT Manager, 50-500 employees)  
**Journey scope:** First awareness to first successful workflow automation  
**Last updated:** 2024-03-15  
**Data sources:** 12 customer interviews, Hotjar recordings, support ticket analysis (n=340)

---

## Stage 1: AWARE
*Customer realises they have a problem and starts exploring solutions*

### What they're doing
- Googling "how to automate [workflow]"
- Asking peers on LinkedIn/Slack communities
- Reading analyst reports and comparison sites

### Touchpoints
- SEO / blog content
- G2/Capterra listings
- Peer recommendations
- LinkedIn ads

### Emotions: 😐 → 🤔
Frustrated by manual process; cautiously hopeful that solutions exist

### Pain Points
- Overwhelming number of solutions; hard to differentiate
- Our G2 profile has fewer reviews than competitors
- Blog content is generic; doesn't speak to their specific workflow

### Opportunities
- Publish workflow-specific content (not generic automation content)
- Increase G2 review count (customer success initiative)
- LinkedIn case study ads by industry vertical

---

## Stage 2: CONSIDER
*Evaluating 2-3 solutions; building internal case*

### What they're doing
- Signing up for demos
- Sharing with decision-makers (VP Ops, CTO)
- Calculating ROI
- Reading case studies from similar companies

### Touchpoints
- Demo booking flow
- Demo itself (sales/SE)
- Pricing page
- Case studies
- Free trial

### Emotions: 🤔 → 😬
Interested but uncertain; worried about justifying the investment internally

### Pain Points (evidence from 8 interviews)
- "The demo showed generic examples — I needed to see our exact use case"
- "Pricing page was confusing — I couldn't figure out what tier we needed"
- "No case studies from companies our size"

### Moments of Truth
⚡ **"Does this work for my use case?"** — answered in first 10 minutes of demo  
⚡ **"Can I justify the cost?"** — ROI calculator or reference customer

### Opportunities
- Build industry/use-case specific demo flows
- Add ROI calculator to pricing page
- Create 3 case studies for 100-500 employee companies
- Add "for companies like yours" tier recommendation

---

## Stage 3: TRY (Free Trial)
*Hands-on evaluation; building conviction*

### What they're doing
- Setting up their first workflow
- Inviting colleagues
- Hitting first technical blockers

### Touchpoints
- Onboarding email sequence
- In-app onboarding checklist
- Documentation
- In-app chat support

### Emotions: 😊 → 😤 → 😊 or ❌
Initial excitement → frustration at setup complexity → relief if they succeed

### Pain Points (Hotjar + support ticket analysis)
- 62% don't complete first workflow in first session (session recording evidence)
- Top support ticket: "How do I connect my [most common integration]?"
- Onboarding checklist: 8 steps — most abandon after step 4

### Moments of Truth
⚡ **"First workflow working"** — 73% of users who complete first workflow convert

### Opportunities
- Reduce onboarding checklist to 3 steps ("quick win" then optional steps)
- Pre-built integration templates for top 10 integrations
- Proactive in-app help at known drop-off points (step 4)

---

## Stage 4: BUY
*Purchase decision and onboarding*

### Emotions: 😊 → 😐
Relief at decision; anxiety about rollout

### Pain Points
- Contract negotiation takes average 3.2 weeks for mid-market
- No self-serve upgrade path — must contact sales for team plan
- Onboarding call scheduled 2 weeks after purchase

### Opportunities
- Self-serve team upgrade (no sales required under $5k ARR)
- Onboarding call within 3 days
- Implementation checklist shared pre-call

---

## Stage 5: USE (Ongoing)
*Daily/weekly use of the product*

### Emotions: 😊 → 📉 → 😊 (renewal anxiety)
High initial satisfaction → gradual familiarity → "what else can this do?"

### Pain Points
- Power users hit limits and don't know about advanced features
- "I forgot about the feature — never discovered it" (NPS verbatims n=12)
- Support response time perceived as slow (> 4h)

### Opportunities
- Contextual feature discovery (show advanced feature when relevant, not in a list)
- Power-user webinar series
- Support SLA improvement: < 2h for business hours

---

## Stage 6: RENEW
*Annual renewal decision*

### Pain Points
- Renewal email sent to billing contact, not product champion
- No proactive usage summary before renewal

### Opportunities
- Usage summary report emailed to champion 60 days before renewal
- QBR offer for accounts > $10k ARR
```

## Emotion Curve (Visual)

```
Emotion
  10 |                    😊              😊
     |         😊    😊      😊   😊
   5 |    🤔                           
     | 😐                        😤
   0 |
     |_________________________________________
      Aware  Consider  Try    Buy    Use   Renew

Moments of truth: ⚡ = critical decision or drop-off points
```

## Prioritised Opportunity Backlog

```markdown
| # | Opportunity | Stage | Impact | Effort | Priority |
|---|------------|-------|--------|--------|----------|
| 1 | 3-step onboarding quick win | Try | HIGH | LOW | P0 |
| 2 | Pre-built integration templates | Try | HIGH | MED | P0 |
| 3 | Industry-specific demo flows | Consider | HIGH | MED | P1 |
| 4 | ROI calculator on pricing page | Consider | MED | LOW | P1 |
| 5 | Self-serve team upgrade | Buy | MED | MED | P1 |
| 6 | Usage summary 60d before renewal | Renew | HIGH | LOW | P1 |
| 7 | Mid-market case studies (×3) | Consider | MED | MED | P2 |
| 8 | Contextual feature discovery | Use | MED | HIGH | P2 |
| 9 | Support SLA < 2h | Use | MED | HIGH | P2 |
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Mapping assumptions** | Team already knows their blind spots | Ground every pain point in data (interviews, tickets, recordings) |
| **Too broad scope** | "B2B customer, entire lifecycle" is unmappable | One segment + one journey at a time |
| **Beautiful map, no actions** | Decoration, not tool | Every map ends with a prioritised opportunity backlog |
| **One-time artefact** | Experience changes; map becomes stale | Review and update quarterly |
| **Team builds it alone** | No buy-in from other functions | Cross-functional workshop; include sales, support, CS |
| **Only showing pain** | Successes are learnable too | Map moments of delight alongside pain points |

## 10 Rules

1. Ground every emotion and pain point in evidence — not team assumptions.
2. Start narrow: one customer segment, one journey phase, one channel.
3. The most important output is the prioritised opportunity backlog — not the map itself.
4. Moments of truth are the highest-ROI improvements — identify and prioritise them first.
5. Build the map in a cross-functional workshop — CS, sales, support, and product see different parts of the journey.
6. The emotion curve reveals where to invest — improve the dips, protect the peaks.
7. Update the map quarterly — customer experience changes with the product.
8. "First value moment" in the Try stage is almost always the highest-impact opportunity.
9. Pain points need a root cause — "signup is confusing" leads to different fixes than "signup is slow."
10. Share the map widely — every decision-maker should have the customer journey front of mind.
