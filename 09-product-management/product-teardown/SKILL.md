---
name: product-teardown
description: Conduct a structured product teardown analyzing UX, positioning, business model, growth strategy, and technical decisions. Outputs a framework-grounded analysis with strategic observations and lessons applicable to your own product.
argument-hint: [product to analyze, analysis focus, your product context]
allowed-tools: Read, Write
---

# Product Teardown

A product teardown reverse-engineers the decisions behind a product. Why is this button here? Why does the onboarding flow work this way? What business model assumption explains this UX? A good teardown moves beyond "I like/dislike this" to "here's the hypothesis they're testing, here's why it works or doesn't, and here's what I'd apply to my own product."

## Teardown Dimensions

| Dimension | Questions to Answer |
|-----------|-------------------|
| First impression & positioning | What problem do they say they solve? Who is the target? |
| Onboarding flow | How do they get users to their first value moment? |
| Core UX loop | What does the user do repeatedly? Is it smooth? |
| Monetization | How do they make money? What does the pricing signal? |
| Growth mechanics | How do they acquire users? What drives word-of-mouth? |
| Technical architecture signals | What does the product tell you about how it's built? |
| Gaps and vulnerabilities | Where is the product weak? What would you do differently? |
| Lessons for your product | What can you apply to your own work? |

## Process

1. **Sign up fresh** — use a new email, no prior knowledge of the product; capture every friction point.
2. **Document the onboarding** — screenshot or write down every step.
3. **Use the core features** — get far enough to understand the product's real loop.
4. **Analyze the pricing page** — what do the tiers tell you about who they're targeting?
5. **Read reviews** — G2, Capterra, App Store; what do users love and hate?
6. **Check job postings** — reveals where they're investing; what they're building next.
7. **Write the teardown** — observations, hypotheses, lessons.

## Output Format

### Product Teardown: [Product Name]

**Category:** [e.g., Integration management / Project management / Data analytics]
**Analyzed by:** [Name]
**Date:** [YYYY-MM-DD]
**Context:** [Why are you analyzing this? Competitive research? Design inspiration?]

---

### Executive Summary

**In one sentence, this product is:** [What it does and for whom]

**Their core hypothesis:** [What they believe to be true about their users that drives their product decisions]

**Biggest strength:** [What they do exceptionally well]

**Biggest weakness:** [Where they are most vulnerable]

**Net assessment:** [Would you use it? Would your users? Why or why not?]

---

### Positioning & First Impression

**Homepage analysis:**
- **Headline:** [Quote the actual headline] — targeting [who], leading with [value proposition]
- **Is the problem statement clear?** [Yes/No — analysis]
- **Who is the assumed buyer?** [Inferred from language, imagery, use cases]
- **What comparisons are implicit?** [Who do they position against?]

**Observations:**
[2-3 specific observations about how they present themselves, with analysis of why they made these choices]

---

### Onboarding Flow

**Goal:** [What is the product trying to get users to do in the first session?]

**Flow map:**

| Step | What Happens | Time Required | Friction Level | Notable Choice |
|------|-------------|---------------|----------------|----------------|
| 1. Sign up | Email + password | 30s | Low | No social sign-in |
| 2. | | | | |
| 3. | | | | |
| [First value moment] | | | | |

**Time to first value:** [X minutes for a new user]

**What they do well in onboarding:**
- [Specific observation with analysis]

**What slows users down:**
- [Friction point] — [Why this hurts and what it costs them]

**Activation hypothesis:**
They believe users will activate if they [reach this specific milestone]. The onboarding is designed to get users there as fast as possible. Evidence: [observation].

---

### Core UX Loop

**What does the user do repeatedly?**
[Describe the core loop: User does X → system responds → user does X again]

**Is the loop tight?** [How many clicks to complete the core action? How long does it take?]

**Habit mechanics:** [What brings users back? Notifications? Email? Intrinsic value?]

**UI/UX observations:**

| Element | Observation | Hypothesis (why they made this choice) |
|---------|-------------|---------------------------------------|
| [Navigation] | | |
| [Key action flow] | | |
| [Information architecture] | | |
| [Empty states] | | |
| [Error handling] | | |

---

### Monetization Analysis

**Pricing model:** [Subscription / Usage-based / Freemium / etc.]

**Tiers:**

| Tier | Price | Limits | Who it targets |
|------|-------|--------|----------------|
| [Tier 1] | | | |
| [Tier 2] | | | |
| [Tier 3] | | | |

**What the pricing signals:**
- [Key insight: e.g., "The growth tier starts at $99/mo — they're not targeting SMBs seriously"]
- [Key insight: e.g., "The 'per integration' pricing aligns cost with customer value perfectly"]

**Monetization observations:**
- [Specific observation about what they include/exclude in each tier and what it tells you about their strategy]

---

### Growth Mechanics

**Acquisition channels (visible):**
- [Channel]: [Evidence you can observe — content, SEO, social, ads]

**Virality / word of mouth:**
- [What features make users tell colleagues? What's the built-in referral loop?]
- [Powered by X" footers, share features, collaborative features that require inviting others]

**Retention drivers:**
- [What keeps users coming back? Data lock-in? Habit? Notifications?]

---

### Competitive Observations

**Who they're really competing with:**
[Not just named competitors but the status quo / alternative workflows]

**Where they've differentiated:**
- [Specific dimension where they're meaningfully better than alternatives]

**Where they're table stakes:**
- [Features that match competitors, not differentiated]

---

### Gaps and Vulnerabilities

| Gap | Evidence | Competitor Opportunity |
|-----|---------|----------------------|
| [Missing capability] | [How you identified it — review quote, missing feature, UX dead-end] | [Who could exploit this] |

---

### Key Lessons for [Your Product]

**What to steal (with adaptation):**
1. [Specific element]: [How you'd apply it to your context]
2. [Specific element]: [Adaptation]
3. [Specific element]: [Adaptation]

**What not to do:**
1. [Mistake they made]: [Why it's a mistake and how to avoid it]

**Strategic observation:**
[1-2 sentences on the most important strategic observation from this teardown — what does it tell you about the market, the user, or the opportunity?]

---

### Review Evidence

**G2 rating:** [X.X/5 — N reviews]

**Most common praise:** [Theme from reviews]

**Most common complaints:** [Theme from reviews]

**Representative negative review:**
*"[Quote]"* — [Reviewer role/company size]

**Representative positive review:**
*"[Quote]"* — [Reviewer role/company size]

## Rules

- **Stay evidence-based** — every observation needs to connect to something you actually saw in the product.
- **Separate observation from hypothesis** — "I observed X" vs. "I hypothesize they did X because Y."
- **Avoid superficial aesthetic judgments** — "it looks nice" is not useful; "the information hierarchy makes the most-used action the most prominent element" is.
- **Connect everything to the business model** — UX decisions reflect business decisions; explain the business logic.
- **Review the pricing page like a PM** — every tier and limit reveals who they're targeting.
- **Read the negative reviews** — they reveal the product's real weaknesses more honestly than the product itself.
- **End with lessons** — a teardown without "what would I do differently" is academic, not useful.
- **Time the teardown from first click** — record how long it takes to reach first value; that number tells you how seriously they take activation.
- **Look for what's missing** — features that should exist but don't reveal what they've decided not to do.
- **Update conclusions with time** — competitive teardowns older than 6 months may no longer be accurate.