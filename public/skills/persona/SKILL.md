---
name: persona
description: Create evidence-based user personas grounded in research — not fictional archetypes. Outputs persona profiles with jobs-to-be-done, behavioral patterns, pain points, workflow context, and product decision implications.
argument-hint: [user research data, target segment, product context]
allowed-tools: Read, Write
---

# User Persona Creator

A persona is a synthesis of real user research into a representative archetype. The danger of personas is that they become fictional characters with names and coffee preferences that nobody uses to make decisions. Good personas are grounded in interview and behavioral data, answer specific product questions, and are referenced in design reviews and roadmap discussions.

## Persona vs. Segment

A **segment** is defined by demographics or firmographics: "SaaS companies with 50–200 employees in North America." A **persona** is defined by behavior, goals, and context: "Sarah, the Integration Manager who spends 4 hours/week firefighting sync failures."

Personas represent meaningfully different behaviors, not just demographics. Two users with identical titles and company sizes may have completely different jobs-to-be-done.

## Jobs-to-Be-Done Foundation

Before writing the persona, identify the job: what is the user trying to accomplish in their work or life? The product is "hired" to do a job. Understanding the job reveals what alternatives the user would accept and what progress looks like.

**Job statement format:**
> When [situation], I want to [motivation], so I can [expected outcome].

**Example:**
> When our nightly data sync fails at 2am, I want to know immediately and understand why, so I can fix it before the sales team shows up at 9am and finds their CRM data is stale.

The job statement is the most important line in the persona. Everything else — the frustrations, the workflow, the tool preferences — flows from the job.

## Research Sources

Rank evidence quality:
1. **Direct interviews** — richest signal; watch for recency and selection bias
2. **Session recordings** (FullStory, Hotjar) — actual behavior, not self-report
3. **Support ticket analysis** — reveals pain points users care enough to report
4. **NPS open-ended responses** — unprompted language about what matters
5. **Usage analytics** — patterns across the full population, not just who you interviewed
6. **Sales call transcripts** — what buyers say matters before they buy
7. **Surveys** — directional; low depth per respondent

A persona based only on interviews may not generalize. Triangulate with behavioral data.

## How Many Personas

- **1 persona**: single narrow product, one user type
- **2-3 personas**: most B2B products; often role-based (end user, admin, economic buyer)
- **4+ personas**: usually a sign of an unfocused product scope; consider whether all are truly meaningfully different

A rule of thumb: if two personas would make the same product decision, they can be merged.

## Process

1. **Gather research** — interviews, recordings, tickets, analytics.
2. **Extract raw observations** — pull quotes, behaviors, frustrations, goals without interpretation.
3. **Cluster by behavior** — group users by what they do, not who they are.
4. **Name the clusters** — give each cluster a pattern name before inventing a character.
5. **Identify the job-to-be-done** — write the job statement for each cluster.
6. **Write the persona card** — use the template below; root every claim in evidence.
7. **Validate with team** — do engineers and designers recognize this person? Would they use it in a design critique?
8. **Use in decisions** — persona is only valuable when referenced in trade-off discussions.

## Output Format

### Persona Card Template

```
╔═══════════════════════════════════════════════════════════════╗
║  PERSONA: [Name]  |  [Role Title]                            ║
║  Company type: [Segment]  |  Team size: [X]                  ║
╚═══════════════════════════════════════════════════════════════╝

PHOTO/AVATAR: [Optional — use only if it helps with recall]

TAGLINE: "[One sentence capturing their defining challenge or worldview]"

JOB-TO-BE-DONE:
  When [situation],
  I want to [motivation],
  so I can [expected outcome].

ROLE & CONTEXT:
  Title: [Exact title or range of titles this persona covers]
  Responsibilities: [2-3 bullets on what they own day-to-day]
  Team: [Who they work with; who they report to]
  Tools: [The 4-6 tools they use most]
  Success metric: [How their manager measures them]

TYPICAL WORKFLOW:
  [Walk through their day/week as it relates to your product domain.
   Write this as prose, not bullets — it reveals context.]

GOALS:
  Primary: [What they are trying to achieve in the next 3-6 months]
  Secondary: [What else matters to them]
  Career: [What they are trying to demonstrate or become]

FRUSTRATIONS (direct quotes where possible):
  - "[Quote or paraphrase from research] — [source]"
  - "[Quote or paraphrase from research] — [source]"
  - "[Quote or paraphrase from research] — [source]"

CURRENT WORKAROUNDS:
  [What they do today to solve the problem without your product.
   This is crucial — it reveals the full cost of the problem and
   the behavioral habit your product must displace.]

OBJECTIONS / FEARS:
  - [What would make them not buy or not adopt]
  - [What could go wrong that they worry about]

BUYING BEHAVIOR:
  Decision role: [Champion / Economic buyer / End user / Blocker]
  Influences: [Who they trust for recommendations]
  Evaluation criteria: [What they need to see before saying yes]
  Deal-breaker: [What kills a deal outright]

PRODUCT IMPLICATIONS:
  Must have:  [Features/qualities without which this persona won't adopt]
  Nice to have: [Features that increase delight but aren't blockers]
  Won't care about: [Things you might build that don't move the needle for them]
  Messaging angle: [How to frame your product for this persona]

EVIDENCE BASE:
  Interviews: [N users matching this pattern; roles and company types]
  Analytics: [Behavioral cluster description]
  Source quotes: [2-3 most representative direct quotes]
```

### Worked Example — Platform Product (B2B SaaS)

```
╔═══════════════════════════════════════════════════════════════╗
║  PERSONA: Marcus  |  Operations/Integration Manager          ║
║  Company type: Mid-market SaaS (50–500 employees)            ║
╚═══════════════════════════════════════════════════════════════╝

TAGLINE: "I didn't become a data manager to stare at failed sync logs at 6am."

JOB-TO-BE-DONE:
  When a data integration fails or produces wrong data,
  I want to know immediately, understand why, and fix it fast,
  so I can keep the business running without filing an engineering ticket.

ROLE & CONTEXT:
  Title: Operations Manager, Revenue Ops, Integration Engineer
  Responsibilities: Own 8–15 active integrations; ensure data freshness;
    field questions from sales and marketing about data accuracy
  Team: Reports to VP Ops or CRO; works alongside Salesforce admin
  Tools: Salesforce, HubSpot, Zapier, Jira (for bugs), Slack, Excel
  Success metric: Zero data incidents per quarter; pipeline data freshness

TYPICAL WORKFLOW:
  Marcus starts every morning by opening the integration dashboard (or,
  currently, checking an email digest of last night's sync results). He
  scans for failures. If something broke, his next 30–90 minutes are
  consumed diagnosing what happened — reading raw error logs, Googling
  API error codes, and deciding whether to retry manually or open a
  ticket to engineering. On a good day, integrations run silently and
  he doesn't think about them. On a bad day, the Head of Sales Slack-
  messages him at 8:45am asking why Salesforce data is 3 days stale.

GOALS:
  Primary: Zero integration incidents in Q3 — wants to be invisible (in a good way)
  Secondary: Self-serve diagnosis without pulling in engineering
  Career: Move toward a more strategic RevOps role; wants to stop being "the guy who fixes Zapier"

FRUSTRATIONS (from interviews):
  - "I can tell something failed but I have no idea why. The error message is just 'timeout'." — interview #3
  - "Every time I need to investigate a sync failure I have to ask our backend engineer to pull logs. He hates it. I hate it." — interview #7
  - "I have 12 integrations and no single place to see if they're all healthy." — interview #11

CURRENT WORKAROUNDS:
  Marcus has set up a personal Zapier workflow that emails him a summary
  of integration statuses every morning. He maintains a spreadsheet
  tracking which integrations have had issues in the last 90 days and
  what the fix was. When debugging, he screenshots error logs and pastes
  them into ChatGPT hoping for a translation. His solutions are fragile
  and do not scale as the business adds new integrations.

OBJECTIONS / FEARS:
  - "Another tool my team won't actually use" — adoption track record is poor
  - "What happens to my existing Zapier automations?" — migration risk
  - "Will I still need engineering for setup?" — wants true self-service

BUYING BEHAVIOR:
  Role: Champion — brings product to VP Ops for budget approval
  Influences: Other ops managers in Slack communities; G2 reviews
  Evaluation criteria: Can I get 30-min MTTR without engineering? Will it integrate with Salesforce and HubSpot on day one?
  Deal-breaker: Requires engineering involvement to set up integrations

PRODUCT IMPLICATIONS:
  Must have: Real-time failure alerts with plain-English explanations;
    one-click retry; Salesforce + HubSpot connectors on day 1
  Nice to have: Root cause analysis AI; team notification routing
  Won't care about: White-labeling; enterprise SSO; audit logs
  Messaging: "Know about integration failures before your CEO does"

EVIDENCE BASE:
  Interviews: 14 users matching this pattern across ops, revops, and integration engineer roles
  Analytics: Behavioral cluster — 40% of sessions start on /integrations/status; avg 4.2 integrations managed
  Representative quote: "I just need one dashboard that tells me everything is green or why it isn't."
```

---

### Persona Validation Test

Ask the team these questions after writing a persona:
1. Can every engineer on the team describe what Marcus would say if we showed him the new feature?
2. When we hit a trade-off in design review, would we actually reference this persona?
3. Does this persona describe behavior, or just demographics?
4. Could we get this wrong and validate against the wrong user type?
5. Is this based on more than 3 interviews, or are we overfitting to one power user?

If any answer is "no" or "not sure," revise the persona before publishing.

### Persona Set Format (Multiple Personas)

When documenting multiple personas, add a comparison table:

| Dimension | Marcus (Ops Manager) | Yuna (Data Analyst) | Brendan (CTO) |
|-----------|---------------------|---------------------|---------------|
| Primary job | Integration health | Data accuracy | Vendor governance |
| Technical depth | Medium | High | Low |
| Decision role | Champion | End user | Economic buyer |
| Success metric | Zero incidents | Query accuracy | Budget ROI |
| Key frustration | No self-serve debugging | Stale data in BI | Shadow IT proliferation |
| Won't care about | Audit trails | Retry UI | Individual integrations |
| Messaging angle | "Fix it yourself" | "Trust your data" | "Governance at scale" |

## Rules

- **Ground every claim in evidence** — if you cannot cite the interview or data source, it is fiction.
- **Behavior over demographics** — define personas by what they do, not their age or industry.
- **2-4 personas maximum** — more than 4 usually means your product scope is unfocused.
- **Write the job-to-be-done first** — it is the most important line; everything else follows from it.
- **Include workarounds** — what they do today reveals the full cost of the problem and what you must displace.
- **Add product implications** — a persona with no decision implications is a decoration.
- **Use direct quotes** — paraphrased frustrations are weaker; exact words from interviews are more convincing.
- **Validate with the team** — if engineers and designers do not recognize the persona, revise it.
- **Update personas after major research** — a persona that is 18 months old is a liability, not an asset.
- **Reference personas in decisions** — if they are not cited in design reviews or prioritization, they are not working.
