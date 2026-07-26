---
name: north-star-metric
description: Define and validate a North Star Metric that aligns the company on what success looks like. Outputs metric definition, decomposition tree, instrumentation spec, and governance process.
argument-hint: [business model, product stage, current metrics chaos, team size]
allowed-tools: Read, Write
---

# North Star Metric

The North Star Metric (NSM) is the single metric that best captures the value your product delivers to customers, and that predicts long-term business health. When the NSM grows, customers are getting more value, and revenue will follow. It aligns every team on what "winning" means.

## What Makes a Good North Star Metric

```
A good NSM:
  ✓ Reflects value delivered to customers (not revenue — revenue is an outcome)
  ✓ Is a leading indicator of long-term retention and revenue
  ✓ Is understandable to everyone in the company
  ✓ Is measurable and precise (not "engagement")
  ✓ Is influenceable by product and engineering decisions
  ✓ Captures breadth (many users) AND depth (real usage) AND frequency

A bad NSM:
  ✗ Revenue or ARR (lagging; optimisable without delivering value)
  ✗ Registered users (vanity; doesn't measure usage or value)
  ✗ DAU/MAU alone (too broad; can grow without delivering core value)
  ✗ NPS (lags behaviour; hard to attribute to specific actions)
  ✗ Unmeasurable ("customer happiness")
```

## NSM by Business Model

| Business Model | Example NSM | Rationale |
|---------------|-------------|-----------|
| B2B SaaS | Weekly Active Accounts using core feature | Depth + frequency |
| Marketplace | Gross Merchandise Value per month | Value transacted |
| Consumer social | Daily Active Users sharing content | Core action frequency |
| Media / content | Minutes consumed per user per week | Engagement depth |
| Ecommerce | Orders per month from repeat customers | Loyalty + frequency |
| Developer tools | Repos with ≥1 CI run per week | Integration + usage |
| Fintech | Monthly transacting users | Core financial action |

## NSM Definition Workshop

```markdown
## Step 1: Answer these questions as a team

What action signals a user is getting real value from our product?
  Example: "When a customer completes their first automated workflow"
  Example: "When a user creates and publishes a project"

What is the minimum usage that predicts retention?
  Use cohort analysis: what behaviour in week 1 predicts week 8 retention?
  Example: "Users who run ≥3 automations in week 1 retain at 85% vs 20%"

What frequency matters?
  Daily? Weekly? Monthly? Depends on natural use frequency of your product.
  Example: A project management tool → weekly is right (not daily)

## Step 2: Candidate NSM evaluation

| Candidate | Value-reflecting? | Leading indicator? | Influenceable? | Measurable? | Score |
|-----------|-------------------|-------------------|----------------|-------------|-------|
| MAU | Partially | Partially | Yes | Yes | 6/10 |
| Workflows automated/month | Yes | Yes | Yes | Yes | 9/10 |
| Revenue | No (lagging) | No | Partially | Yes | 4/10 |
| Accounts with ≥5 active users | Yes | Yes | Yes | Yes | 8/10 |

## Step 3: Define the winner precisely

North Star Metric: **Monthly Active Automating Accounts (MAAA)**

Definition: Count of distinct accounts where at least one automation successfully
ran to completion in the trailing 30 calendar days, excluding internal test accounts.

Precise enough to prevent ambiguity; not so narrow it misses important usage.
```

## NSM Decomposition Tree

```markdown
# NSM Decomposition: Monthly Active Automating Accounts

MAAA
├── New accounts activating (first automation this month)
│   ├── New trial signups
│   │   ├── Organic traffic (SEO, brand)
│   │   ├── Paid acquisition
│   │   └── Partner/referral
│   └── Trial → activation conversion rate
│       ├── Onboarding completion rate
│       ├── Time to first automation
│       └── Integration setup success rate
│
└── Existing accounts retaining (ran automation last month too)
    ├── Retention rate (month-over-month)
    │   ├── Product value delivered (automation reliability)
    │   ├── Feature adoption (advanced features)
    │   └── Customer health score
    └── Reactivation rate (lapsed accounts returning)
        ├── Win-back campaign effectiveness
        └── New features triggering re-engagement
```

## Instrumentation Spec

```typescript
// Events required to compute MAAA

// automation_run_completed — fires when automation finishes successfully
analytics.track('automation_run_completed', {
  account_id: string,          // Required for MAAA computation
  automation_id: string,
  run_id: string,
  completed_at: string,        // ISO timestamp
  duration_ms: number,
  step_count: number,
  is_first_run: boolean,       // For activation tracking
  trigger_type: 'manual' | 'scheduled' | 'webhook' | 'api',
});

// automation_run_failed — for reliability tracking (guardrail)
analytics.track('automation_run_failed', {
  account_id: string,
  automation_id: string,
  run_id: string,
  error_type: string,
  failed_at_step: number,
});

// NSM SQL query
/*
SELECT
  DATE_TRUNC('month', completed_at) AS month,
  COUNT(DISTINCT account_id) AS maaa
FROM automation_run_completed
WHERE
  completed_at >= NOW() - INTERVAL '12 months'
  AND account_id NOT IN (SELECT id FROM accounts WHERE is_test = true)
GROUP BY 1
ORDER BY 1
*/
```

## NSM Governance

```markdown
# NSM Governance Process

## Single Owner
**Owner:** Chief Product Officer (or CEO for early stage)
**Review cadence:** Weekly in leadership meeting

## Reporting
- NSM reported every Monday by 9am
- Weekly trend (WoW), monthly trend (MoM), year-over-year
- Broken down by: new vs existing, cohort, acquisition channel

## Alert Thresholds
- Week-over-week decline >5%: yellow alert — immediate root cause investigation
- Week-over-week decline >15%: red alert — all-hands investigation
- Month target missed: post-mortem required

## Anti-gaming rules
The NSM must not be achievable without delivering real value:
- "Active" = automation ran to completion — NOT just login, NOT just draft saved
- Excludes: test accounts, accounts created by company employees, free trial
  accounts in first 3 days (before meaningful usage possible)

## Change process
Changing the NSM definition requires:
1. Proposal with rationale and historical data showing improvement
2. CPO sign-off
3. Announcement to whole company with effective date
4. At least 6 months of historical backfill
NSM definitions should be stable for ≥12 months
```

## NSM Communication Template

```markdown
# 🌟 Our North Star: Monthly Active Automating Accounts

**Why this metric?**
MAAA tells us how many customers are getting real value from our product every month.
When a customer runs an automation successfully, we've genuinely helped them.
More MAAA means more customers getting more value — and that predicts revenue growth.

**Current performance:**
- This month: 2,847 accounts (↑ 12% MoM, ↑ 48% YoY)
- Target by year end: 4,500 accounts
- We are 63% of the way to our target

**What moves MAAA?**
Every team has a role:
- Product: make onboarding faster, automations more reliable
- Engineering: reliability, speed, new integrations
- Marketing: bring in more trial accounts
- Sales: convert trials to paid accounts
- Customer Success: activate new accounts quickly

**What doesn't count:**
Running a test automation, creating a draft, or just logging in.
The automation must successfully complete.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Multiple North Stars** | No prioritisation; teams optimise locally | One NSM; supporting L1 metrics, not multiple NSMs |
| **Revenue as the NSM** | Revenue is an outcome; doesn't indicate value delivered | Lead with value delivered; revenue follows |
| **Vanity metrics** | Users, downloads, page views — easy to inflate | NSM requires completion of core value-delivering action |
| **Changing NSM quarterly** | Teams optimise for different things; can't track trend | NSM stable for ≥12 months |
| **NSM unknown to engineers** | Engineers can't design for what they don't know | Every engineer knows and understands the NSM |
| **NSM without decomposition** | Can't act on a single number | Decomposition tree links team metrics to NSM |

## 10 Rules

1. The NSM reflects value delivered to customers — not business outcomes like revenue.
2. One NSM per company — not one per team, not one per quarter.
3. The NSM is understandable to every employee, including non-product people.
4. Precisely defined: include exactly what counts and what doesn't.
5. The NSM is a leading indicator — it predicts retention and revenue, not just reflects it.
6. The decomposition tree connects every team's metrics to the NSM.
7. The NSM is stable for at least 12 months — frequent changes lose trust and comparability.
8. Anti-gaming rules are defined upfront — specify what does NOT count.
9. Every engineer knows the NSM — they need to build toward it intentionally.
10. Alert on unexpected NSM changes in both directions — sudden increases may indicate measurement bugs.
