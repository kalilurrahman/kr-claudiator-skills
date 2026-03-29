---
name: product-led-growth
description: Design and implement a product-led growth strategy where the product drives user acquisition, expansion, and retention. Outputs PLG model, activation metrics, viral loops, and freemium conversion strategy.
argument-hint: [product type, target segment, current growth motion, pricing model]
allowed-tools: Read, Write
---

# Product-Led Growth (PLG)

Product-led growth is a go-to-market strategy where the product itself is the primary driver of customer acquisition, expansion, and retention. Instead of sales-led (sales demos products) or marketing-led (marketing creates demand), PLG lets users discover value in the product before involving sales. Slack, Figma, and Notion are canonical examples.

## PLG Readiness Assessment

```markdown
## Is PLG Right For You?

HIGH PLG FIT (strong signals):
  ✓ Product delivers value within minutes of signup (not weeks of onboarding)
  ✓ Value is self-evident — users can understand the product without training
  ✓ Individual users or small teams can adopt without enterprise procurement
  ✓ Network effects or collaboration features (more valuable with more users)
  ✓ Free tier can deliver genuine value, not just a limited trial
  ✓ Word-of-mouth is already happening organically

LOW PLG FIT (warning signals):
  ✗ Requires 3-month implementation and data migration before value
  ✗ Price point requires CFO approval ($100k+/year)
  ✗ Regulatory requirement for procurement (healthcare, government)
  ✗ Only valuable after critical mass of users (cold start problem)
  ✗ Value is in services, not the product itself
```

## PLG Model Design

```markdown
## PLG Growth Model: [Product Name]

### Free Tier Design
Objective: Deliver genuine value; demonstrate full product potential

Free tier includes:
  - Core workflow (up to 3 projects)
  - Basic integrations (2 of 10 available)
  - 1 user seat

Free tier excludes (requires upgrade):
  - Team collaboration (>1 seat)
  - Advanced integrations
  - Admin controls / audit logs
  - Priority support

Freemium success metric:
  % of free users who reach the "aha moment" (first successful workflow)
  Target: >40% within 7 days

### Activation Funnel (Free to Active)
Signup → Email Verified → First Project Created → First Task Completed → Team Member Invited

Critical metric: % reaching "First Task Completed" within 7 days
  Current: 28% | Target: 45%
  Hypothesis: Onboarding checklist complexity is the bottleneck

### Viral Loop
How the product spreads organically:
  1. User creates shareable output (report, design, document)
  2. Shares with external collaborators
  3. Collaborators must sign up to comment/edit
  4. Collaborator experiences product value → upgrades or shares further

Viral coefficient (K): 0.3 currently → target 0.6

### Expansion Revenue Motion
Free → Pro: Individual power users hit seat or feature limits
Pro → Team: Projects become collaborative; team plan unlocks collaboration
Team → Enterprise: Security, SSO, audit logs become requirements at scale

Expansion metric: Net Revenue Retention (NRR) target >120%
```

## Activation Instrumentation

```python
# Track activation milestones for PLG funnel
from datetime import datetime, timedelta

class PLGActivationTracker:
    ACTIVATION_MILESTONES = [
        ("signup_completed", "Signed up"),
        ("email_verified", "Email verified"),
        ("first_project_created", "Created first project"),
        ("first_action_completed", "Completed first key action"),
        ("team_member_invited", "Invited a team member"),  # Viral hook
        ("integration_connected", "Connected an integration"),
    ]

    async def track_milestone(self, user_id: str, milestone: str) -> None:
        already_reached = await db.fetchone(
            "SELECT 1 FROM activation_milestones WHERE user_id = $1 AND milestone = $2",
            [user_id, milestone]
        )
        if not already_reached:
            await db.execute(
                "INSERT INTO activation_milestones (user_id, milestone, reached_at) VALUES ($1, $2, NOW())",
                [user_id, milestone]
            )

    async def get_activation_rate(self, milestone: str, cohort_days: int = 7) -> float:
        result = await db.fetchone("""
            SELECT
                COUNT(DISTINCT u.id) AS total_signups,
                COUNT(DISTINCT m.user_id) AS reached_milestone
            FROM users u
            LEFT JOIN activation_milestones m
                ON u.id = m.user_id
                AND m.milestone = $1
                AND m.reached_at <= u.created_at + INTERVAL '$2 days'
            WHERE u.created_at >= NOW() - INTERVAL '30 days'
        """, [milestone, cohort_days])

        if result["total_signups"] == 0:
            return 0.0
        return result["reached_milestone"] / result["total_signups"]
```

## Free-to-Paid Conversion Optimisation

```markdown
## Conversion Levers

USAGE LIMITS (friction-based triggers)
  "You've reached your 3 project limit"
  "Upgrade to invite more than 1 team member"
  Design: Show limit before hitting it; make upgrade path obvious

VALUE DEMONSTRATION (value-based triggers)
  "You've automated 47 hours this month — Premium users save even more"
  "Share this with your team" prompt appears when user creates something shareable
  Design: Show ROI before asking for money

SOCIAL PROOF AT DECISION POINT
  Upgrade modal shows: "3,847 teams like yours use Premium"
  Case study from similar company visible during trial

TIMING
  Offer upgrade after "aha moment" (first successful workflow) — not on signup
  Send email when user hits 80% of free tier limit (not 100%)
  Use in-product prompts, not just email

PRICING PAGE OPTIMISATION
  Annual plan prominently featured (20-30% discount)
  "Most popular" tag on recommended tier
  Feature comparison focused on user's usage patterns
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Free tier with no real value** | Users churn before experiencing value | Free tier must deliver genuine, lasting value |
| **Paywalling too early** | Users leave before "aha moment" | Delay upgrade prompts until after activation |
| **PLG without product analytics** | Flying blind; can't identify bottlenecks | Instrument the full activation funnel from day one |
| **Ignoring expansion revenue** | Acquiring users but not growing revenue | NRR is as important as new logo acquisition |
| **PLG for complex enterprise products** | Users can't self-serve; sales required for value | Hybrid: PLG for discovery; sales for large deals |

## 10 Rules

1. The product delivers genuine value in the free tier — not a hobbled trial.
2. "Aha moment" is defined and measured — it is the highest-leverage activation metric.
3. Upgrade prompts appear after the aha moment, not at signup.
4. Viral loops are built into the product — sharing, inviting, collaborating.
5. Activation funnel is instrumented and reviewed weekly.
6. Freemium → paid conversion is triggered by usage limits OR value demonstration — not arbitrary timers.
7. Net Revenue Retention (NRR) tracks expansion — PLG should drive >100% NRR.
8. Self-serve onboarding is a product feature, not a support function.
9. PLG and sales are complementary — PLG handles SMB; sales handles enterprise.
10. PLG requires product investment — it does not replace GTM investment.
