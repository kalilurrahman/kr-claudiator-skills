---
name: product-analytics-plan
description: Define an instrumentation and analytics plan for a product feature or launch. Outputs event taxonomy, tracking spec, dashboard design, and analysis playbook.
argument-hint: [feature type, key questions to answer, analytics stack, launch timeline]
allowed-tools: Read, Write
---

# Product Analytics Plan

An analytics plan defines what to measure, how to measure it, and what questions the data will answer — before the feature ships. Analytics planned after launch leaves gaps that can't be backfilled. A good analytics plan turns every feature into a learning opportunity.

## Process

1. **Define the questions.** What decisions will this data inform? Work backwards from decisions to metrics.
2. **Design the event taxonomy.** What user actions need to be tracked? Naming convention.
3. **Write the tracking spec.** For each event: name, trigger, properties, and example payload.
4. **Design the dashboard.** What charts answer which questions? Mock it before building.
5. **Write the analysis playbook.** How will you interpret the data after launch? What would "success" look like?
6. **Review with data team.** Catch gaps before engineering implements.
7. **QA the tracking.** Verify events fire correctly in staging before launch.

## Analytics Plan Template

```markdown
# Analytics Plan: Team Templates Feature

**Author:** @pm-name  
**Feature:** Team Templates  
**Launch date:** 2024-04-15  
**Data stack:** Segment → BigQuery → Amplitude + Looker

---

## 1. Questions This Analytics Plan Answers

Business questions → Metrics → Events needed

| Question | Metric | Primary Event(s) |
|----------|--------|-----------------|
| Is the feature being adopted? | % teams with ≥1 template published | template_published |
| Is it delivering value? | % users using template vs building from scratch | template_used, workflow_created |
| Where do users drop off in the flow? | Funnel: discover → preview → use → publish | template_library_viewed, template_previewed, template_copied |
| What types of templates are most popular? | Copies per template, by category | template_copied (with category prop) |
| Does using templates improve activation? | Activation rate: template users vs non-template users | template_copied + existing activation events |
| Are admins publishing quality templates? | Template copy → published ratio | template_copied, workflow_published |

---

## 2. Event Taxonomy

### Naming convention
`{object}_{action}` — past tense verbs
Examples: template_published, template_copied, template_library_viewed

### Event inventory

| Event | Trigger | Properties |
|-------|---------|-----------|
| template_library_viewed | User opens template library tab | session_id, source (sidebar, onboarding, empty_state) |
| template_searched | User types in search box | search_term, results_count |
| template_previewed | User clicks a template card | template_id, template_name, category, position_in_list |
| template_copied | User clicks "Use this template" | template_id, template_name, category, author_id |
| template_published | Admin publishes a workflow as template | template_id, template_name, category, step_count |
| template_unpublished | Admin unpublishes a template | template_id, reason (optional) |
| template_library_searched_no_results | Search returns 0 results | search_term |

---

## 3. Tracking Spec (Full)

### Event: template_copied

**Description:** Fires when a user creates a copy of a team template in their workspace.

**Trigger:** User clicks "Use this template" button in template library and copy creation succeeds.

**Properties:**

| Property | Type | Required | Example | Notes |
|----------|------|----------|---------|-------|
| template_id | string | yes | "tmpl_abc123" | UUID |
| template_name | string | yes | "Monthly Report Template" | |
| category | string | no | "reporting" | May be null if uncategorised |
| author_team_member_id | string | yes | "user_xyz789" | Who published the template |
| source | string | yes | "search_results" | Where user found it: "browse", "search_results", "featured" |
| position_in_list | integer | no | 3 | Position in list/search results |
| search_term | string | no | "report" | If copied from search results |
| session_id | string | yes | "sess_def456" | For funnel analysis |

**Example payload:**
```json
{
  "event": "template_copied",
  "userId": "user_789",
  "properties": {
    "template_id": "tmpl_abc123",
    "template_name": "Monthly Report Template",
    "category": "reporting",
    "author_team_member_id": "user_xyz789",
    "source": "search_results",
    "position_in_list": 3,
    "search_term": "report",
    "session_id": "sess_def456"
  }
}
```

**Implementation note:** Fire after successful API response (`POST /templates/{id}/copy` returns 201).
Do NOT fire on click (before API call) — only on success.
```

## 4. Dashboard Design

```markdown
## Template Analytics Dashboard (Looker)

### Panel 1: Adoption Overview
- Time series: # templates published per week
- Time series: # templates copied per week
- Single stat: % teams with ≥1 template (30-day)
- Single stat: Avg copies per template

### Panel 2: Discovery Funnel
Funnel chart (Amplitude):
  library_viewed → template_previewed → template_copied
  Show conversion rate at each step
  Segment by source (browse, search, featured)

### Panel 3: Template Performance
Table: Top 20 templates by copies in last 30 days
Columns: template_name, category, copies, publish_date, author

### Panel 4: Search Analysis
- Top 10 search terms
- Search terms with no results (template gap discovery)
- Search → copy conversion rate

### Panel 5: Impact Analysis
Comparison chart:
  Users who copied a template vs users who didn't
  Metrics: activation rate, day-7 retention, trial→paid conversion
```

## 5. Analysis Playbook

```markdown
## What to Look For Post-Launch

### Week 1 (sanity checks)
- Verify events are firing (check Segment debugger)
- Verify funnel looks reasonable (no step has >100% conversion)
- Check for event spikes or gaps

### Week 2-4 (early signals)
- Library viewed → template copied conversion: expect >15%
- "No results" searches: identify top missing categories
- If library viewed but not previewed: thumbnail/card design issue
- If previewed but not copied: description quality issue, or template irrelevant

### Month 1 review (success assessment)
- Primary: % teams with ≥1 template published ≥ 25%?
- Primary: % users using template in first 30 days ≥ 15%?
- If adoption low: investigate via session recordings + qualitative interviews
- Compare activation: template users vs non-template users

### Segment analysis
- New accounts: Are templates accelerating activation?
- Enterprise accounts: Different templates used vs SMB?
- Industry breakdown: Which industries publish most?

### Decision triggers
- Template adoption <5% after 6 weeks → qualitative research before further investment
- Search no-results >30% of searches → create templates for top missing categories
- Template copies but low workflow published rate → investigate where users drop off
```

## 6. QA Checklist

```markdown
## Event Tracking QA

Before launch, verify each event:

[ ] template_library_viewed fires when: tab clicked, sidebar link, onboarding prompt
[ ] template_copied fires after API success (not on click)
[ ] template_copied does NOT fire on API error
[ ] All required properties present on every event
[ ] template_id is UUID format (not null, not "undefined")
[ ] source property correctly set for each entry point
[ ] position_in_list correct (starts at 1, not 0)

Test scenarios:
[ ] Browse → preview → copy (check full funnel fires)
[ ] Search → result → copy (check search_term prop present)
[ ] Copy fails (API error) → event does NOT fire
[ ] Admin publishes → template appears in library → member copies

QA environment: use Segment's live debugger to inspect events in real-time
Sign-off: @data-analyst reviews event stream before launching to 100%
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Tracking everything** | Data lake with no actionable insights | Start with questions; track what answers them |
| **Event on click (before API)** | Counts attempts not completions | Fire events on successful API response |
| **Generic event names** | `button_clicked` with no context | Specific: `template_copied`, not `button_clicked` |
| **No properties** | Can't slice the data | Every event needs context properties |
| **No QA before launch** | Gaps discovered post-launch; unbackfillable | Tracking QA in staging before every launch |
| **Dashboard without decisions** | Vanity dashboard; nobody acts on it | Each panel answers a specific decision-relevant question |
| **Analytics plan as afterthought** | Engineers implement without tracking spec | Plan written before engineering starts |

## 10 Rules

1. Define questions before designing events — work backwards from decisions to data.
2. Events fire on API success, not on user click — measure completions, not intentions.
3. Every event has a precise naming convention — `object_action` in past tense.
4. Every event property is documented with type, example, and notes.
5. QA the tracking in staging before launch — post-launch gaps can't be backfilled.
6. The dashboard is mocked before it is built — agree on what you'll look at.
7. The analysis playbook is written before launch — define what "good" and "bad" look like.
8. Track "no results" in search — it's a backlog of needed features.
9. Compare feature users vs non-users — cohort analysis reveals true impact.
10. Analytics plan is reviewed by the data team before engineering implements — they catch gaps.
