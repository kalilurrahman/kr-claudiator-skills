---
name: prioritize
description: Prioritize a product backlog using structured frameworks (RICE, ICE, MoSCoW, Kano, Weighted Scoring). Produces a ranked list with scores, rationale, and a defensible recommendation for what to build next.
argument-hint: [list of features/initiatives, business goal, constraints]
allowed-tools: Read, Write
---

# Backlog Prioritization

Prioritization is the most consequential product skill — choosing what NOT to build matters as much as choosing what to build. A prioritized backlog is a statement of bets, not a wish list. Every item you move up moves something else down. Every framework is a lens, not the truth. Use at least two frameworks, compare results, and document why you chose the order you did.

## Frameworks

### RICE Scoring
**Reach × Impact × Confidence ÷ Effort**

| Factor | Definition | Scale |
|--------|-----------|-------|
| Reach | Users affected per quarter | Raw number (e.g., 5,000) |
| Impact | Effect on goal per user | 3=massive, 2=high, 1=medium, 0.5=low, 0.25=minimal |
| Confidence | How certain are you? | 100%=high, 80%=medium, 50%=low |
| Effort | Person-months required | Raw number (e.g., 2.5) |

```
RICE = (Reach × Impact × Confidence) / Effort

Example:
Feature A: (10,000 × 2 × 0.8) / 3 = 5,333
Feature B: (2,000 × 3 × 0.9) / 1 = 5,400
→ Feature B wins despite lower reach
```

**When to use:** Comparing features that reach different user segments with different levels of effort. Best for growth-stage teams optimizing a known metric.

---

### ICE Scoring
**Impact × Confidence × Ease**

| Factor | Scale |
|--------|-------|
| Impact | 1–10 |
| Confidence | 1–10 |
| Ease | 1–10 (10 = very easy) |

```
ICE = Impact × Confidence × Ease

Example:
Feature A: 8 × 7 × 5 = 280
Feature B: 6 × 9 × 8 = 432
→ Feature B wins (less risky and easier)
```

**When to use:** Quick scoring when you lack data for RICE. Works well in early-stage startups. Fast to calculate but highly subjective — calibrate your team's scoring first.

---

### MoSCoW
Sort items into four buckets:

| Bucket | Meaning | Typical % of scope |
|--------|---------|-------------------|
| **Must Have** | Release is a failure without this | 40–50% |
| **Should Have** | Important but not critical for launch | 30–40% |
| **Could Have** | Nice-to-have if time permits | 10–20% |
| **Won't Have (this time)** | Explicitly deferred | Remainder |

**Warning:** MoSCoW is a negotiation tool, not a prioritization tool. Stakeholders will fight to classify everything as Must Have. Enforce ruthlessly — if more than half the list is Must Have, the definition is broken. "Must Have" means: the product ships without this and we lose customers or miss legal requirements.

---

### Kano Model
Classify features by user satisfaction response:

| Category | Behavior | Example |
|----------|---------|---------|
| **Basic** | Expected; absence causes dissatisfaction | Login, save, undo |
| **Performance** | More = better satisfaction | Page load speed, storage space |
| **Delighter** | Unexpected; absence not noticed | Auto-save, smart suggestions |
| **Indifferent** | Does not affect satisfaction either way | Internal admin tooling |
| **Reverse** | Some users hate it | Aggressive notifications |

**Process:** Survey users. For each feature, ask: (1) "How would you feel if this feature WAS included?" and (2) "How would you feel if this feature WAS NOT included?" Map answers to the Kano category matrix.

**When to use:** Before roadmap planning to understand which features are table stakes vs. differentiation vs. delight. Prevents over-investing in basic features users already expect.

---

### Weighted Scoring Matrix
Define criteria, assign weights, score each initiative:

```
Criteria weights (must sum to 100%):
  Strategic alignment:  30%
  Revenue impact:       25%
  User value:           20%
  Feasibility:          15%
  Risk reduction:       10%

Scoring 1–5 per criterion:

Initiative A: (4×30) + (3×25) + (5×20) + (4×15) + (2×10) = 370
Initiative B: (5×30) + (2×25) + (3×20) + (3×15) + (4×10) = 370
→ Tie — re-examine weights or add a tiebreaker criterion
```

**When to use:** Strategic planning, annual roadmap, comparing initiatives of very different types (infrastructure vs. growth vs. compliance).

---

## Process

1. **Align on the goal first** — what metric are we optimizing for this quarter? Prioritization without a shared goal produces noise.
2. **List all candidates** — dump everything in a spreadsheet; nothing is excluded yet.
3. **Remove obvious non-starters** — dependencies not met, strategic misalignment, legal blockers. Cut the list before scoring.
4. **Choose the right framework** — RICE for growth features; Kano for roadmap planning; MoSCoW for sprint scoping; Weighted Scoring for strategic decisions.
5. **Score independently first** — have PM, engineering lead, and design lead score separately, then compare. Divergence reveals assumptions.
6. **Run sensitivity analysis** — change one score by 20%. Does the ranking change? If yes, investigate the uncertainty.
7. **Gut-check the output** — if the top-ranked item feels wrong, the input data is wrong. Find what is off.
8. **Document the rationale** — record what scores were assigned and why. Future-you will not remember.
9. **Present trade-offs, not just the ranking** — stakeholders need to understand what the #1 choice costs (the item displaced to #3).
10. **Revisit monthly** — context changes. A high-priority item from 60 days ago may be obsolete today.

## Output Format

### RICE Scorecard

```markdown
## Backlog Prioritization — Q3 2025
**Goal:** Increase trial-to-paid conversion by 5pp
**Framework:** RICE
**Date:** July 1, 2025

| Feature | Reach | Impact | Confidence | Effort | RICE | Rank |
|---------|-------|--------|------------|--------|------|------|
| Onboarding checklist | 8,000 | 2 | 0.8 | 2 | 6,400 | #2 |
| In-app upgrade nudge | 6,000 | 2 | 0.9 | 1 | 10,800 | #1 |
| Email drip (trial) | 12,000 | 1 | 0.7 | 1.5 | 5,600 | #3 |
| Feature gating UI | 4,000 | 3 | 0.6 | 3 | 2,400 | #4 |
| Billing page redesign | 3,000 | 2 | 0.8 | 4 | 1,200 | #5 |

**Recommendation:** Prioritize in-app upgrade nudge (highest RICE, 1 month effort).
Pair with onboarding checklist in same sprint — combined impact on conversion funnel.
**Deferred:** Billing page redesign — high effort, lowest RICE. Revisit Q4.

**Assumptions to validate:**
- Reach estimates from Amplitude (last 90 days)
- Impact scores from PM team calibration session (June 28)
- Effort estimates from eng leads (preliminary — confirm at sprint planning)
```

### MoSCoW for Sprint

```markdown
## Sprint 14 Scope — MoSCoW
**Capacity:** 28 story points

### Must Have (18 pts)
- [ ] Fix payment failure handling (#342) — 5 pts — blocks billing
- [ ] Onboarding step 3 crash on iOS (#389) — 3 pts — P0 bug
- [ ] GDPR data deletion endpoint (#401) — 10 pts — legal deadline Aug 1

### Should Have (8 pts)
- [ ] Upgrade prompt on feature gate — 5 pts
- [ ] Empty state: Projects list — 3 pts

### Could Have (2 pts)
- [ ] Tooltip copy improvements — 2 pts

### Won't Have (deferred to Sprint 15)
- Bulk CSV export — too large for this sprint
- Notification preferences — design not finalized
```

## Worked Example: RICE Calibration Session

**Common failure mode:** Two PMs score the same feature — one gives Impact=3, the other Impact=1. Uncalibrated teams produce meaningless scores.

**Fix: Run a calibration session before the first RICE exercise.**

Step 1: Pick 3 "anchor" features the team knows well.
Step 2: PM, Eng Lead, Design Lead independently score the anchors.
Step 3: Compare scores. Discuss divergences until you agree on anchors.
Step 4: Use anchors as reference points for all future scoring.

Example anchors:
- "Login page" = Impact 0.25 (minimal — everyone already logs in)
- "Mobile app launch" = Impact 3 (massive — opens new user segment)
- "Dark mode" = Impact 0.5 (low — nice to have, few ask for it)

Now when someone says "Impact=2" for a new feature, the team has shared meaning.

## Anti-Patterns

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| HiPPO prioritization | Highest-paid person's opinion decides | Show scores; ask them to challenge the data |
| Everything is P0 | 15 items all marked critical | Enforce: P0 means "outage or churn risk" |
| Ignoring effort | High-impact items always win regardless of cost | Weight effort; compare RICE not raw impact |
| No confidence score | Assume all estimates are certain | Force a confidence rating; expose uncertainty |
| Scores without rationale | Numbers in a spreadsheet, no context | Document why each score was assigned |
| Prioritizing features not problems | "We should build X" before "users struggle with Y" | Reframe backlog as problems, then score solutions |
| Annual prioritization | Set roadmap once, never revisit | Run RICE monthly; reprioritize on new data |

## Choosing the Right Framework

| Situation | Best framework |
|-----------|---------------|
| Growth/conversion focus, data available | RICE |
| Early stage, fast decisions needed | ICE |
| Sprint scoping, team alignment | MoSCoW |
| Annual roadmap, strategic bets | Weighted Scoring |
| Understanding feature categories | Kano |
| Multiple stakeholders with different criteria | Weighted Scoring |

## Rules

- **Prioritization is a bet, not a truth** — every score is an estimate; treat output as a starting point for conversation, not a mandate.
- **Align on the goal before scoring** — without a shared north star metric, RICE scores are arbitrary.
- **Score independently before comparing** — group scoring anchors on the first number said out loud; independent scoring reveals real disagreement.
- **Effort is not optional** — RICE without effort is just "things we want." The denominator is what separates good prioritization from wish lists.
- **MoSCoW Must Have means launch-blocking** — if you can ship without it, it is a Should Have.
- **Document confidence, not just scores** — a feature with 40% confidence at Impact=3 is riskier than one with 90% confidence at Impact=2.
- **Show what you are not doing and why** — stakeholders trust prioritization more when they see trade-offs, not just the winner list.
- **Revisit monthly** — a Q1 priority may become irrelevant by Q2; stale roadmaps cause wasted engineering effort.
- **Never prioritize features without a problem statement** — "Add dark mode" is not a backlog item; "Users report eye strain in low-light environments (100 tickets, Q1)" is.
- **The goal is to say no gracefully** — prioritization frameworks give you language to decline requests with data, not opinion.
