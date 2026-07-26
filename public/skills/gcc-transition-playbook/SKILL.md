# GCC Transition Playbook

## What this skill does
Guides work transition into a GCC including KT, shadow-support, stabilization, and governance checkpoints.

## When to use
- Example use case one.
- Example use case two.

## Inputs needed
- Business context.
- Constraints.
- Desired output format.

## Outputs
- Structured analysis.
- Action plan.
- Example deliverable.

## Starter prompts
1. Use this skill to generate a tailored output.
2. Use this skill to critique and improve an existing artifact.

## Companion skills
- Related skill A.
- Related skill B.

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Gcc Transition Playbook** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Guides work transition into a GCC including KT, shadow-support, stabilization, and governance checkpoints.
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.

### Extended rules of engagement

1. Treat the first draft as a hypothesis, not an answer.
2. Name the assumption that, if wrong, breaks the recommendation.
3. Pre-mortem every plan: imagine it failed and ask why.
4. Separate the decision from the decision-maker; surface both.
5. Time-box analysis to the value of the decision, not the curiosity of the analyst.
6. Distinguish reversible from irreversible moves; spend less time on the reversible ones.
7. Prefer small, frequent course-corrections over big, rare resets.
8. Make dissent cheap; make silence expensive.
9. Document the decision the moment it is made, not weeks later.
10. Re-read the artifact 24 hours later and cut anything that no longer earns its place.

### Stakeholder choreography

- **Sponsor:** owns the outcome and the budget; briefed weekly in five lines or less.
- **Driver:** owns the day-to-day execution; meets the team daily during active delivery.
- **Contributors:** named individuals with named deliverables and named dates.
- **Reviewers:** consulted on draft, not surprised at sign-off.
- **Informed:** receive a one-paragraph summary at each milestone.

### Failure modes to watch for

- Scope creep dressed up as "just one more thing".
- Analysis paralysis dressed up as "due diligence".
- Consensus theatre dressed up as "alignment".
- Vanity metrics dressed up as "progress".
- Heroics dressed up as "delivery".

### Cadence checklist

- Day 0: kickoff, write the brief, lock the success metric.
- Day 7: first artifact in front of the sponsor.
- Day 14: mid-point review, cut or extend scope.
- Day 30: leading indicator read; decide continue, pivot, or stop.
- Day 60: course-correction or scale-up plan.
- Day 90: outcome review against the original success metric.

### Quick-reference one-liners

- "What decision does this unblock?" — kills meetings that should be emails.
- "Who owns this by Friday?" — kills tasks that have no owner.
- "How will we know it worked?" — kills features that have no metric.
- "What would have to be true for this to fail?" — kills plans with no pre-mortem.
- "What is the smallest version we can ship this week?" — kills boil-the-ocean scope.

### Extended rules of engagement

1. Treat the first draft as a hypothesis, not an answer.
2. Name the assumption that, if wrong, breaks the recommendation.
3. Pre-mortem every plan: imagine it failed and ask why.
4. Separate the decision from the decision-maker; surface both.
5. Time-box analysis to the value of the decision, not the curiosity of the analyst.
6. Distinguish reversible from irreversible moves; spend less time on the reversible ones.
7. Prefer small, frequent course-corrections over big, rare resets.
8. Make dissent cheap; make silence expensive.
9. Document the decision the moment it is made, not weeks later.
10. Re-read the artifact 24 hours later and cut anything that no longer earns its place.

### Stakeholder choreography

- **Sponsor:** owns the outcome and the budget; briefed weekly in five lines or less.
- **Driver:** owns the day-to-day execution; meets the team daily during active delivery.
- **Contributors:** named individuals with named deliverables and named dates.
- **Reviewers:** consulted on draft, not surprised at sign-off.
- **Informed:** receive a one-paragraph summary at each milestone.

### Failure modes to watch for

- Scope creep dressed up as "just one more thing".
- Analysis paralysis dressed up as "due diligence".
- Consensus theatre dressed up as "alignment".
- Vanity metrics dressed up as "progress".
- Heroics dressed up as "delivery".

### Cadence checklist

- Day 0: kickoff, write the brief, lock the success metric.
- Day 7: first artifact in front of the sponsor.
- Day 14: mid-point review, cut or extend scope.
- Day 30: leading indicator read; decide continue, pivot, or stop.
- Day 60: course-correction or scale-up plan.
- Day 90: outcome review against the original success metric.

### Quick-reference one-liners

- "What decision does this unblock?" — kills meetings that should be emails.
- "Who owns this by Friday?" — kills tasks that have no owner.
- "How will we know it worked?" — kills features that have no metric.
- "What would have to be true for this to fail?" — kills plans with no pre-mortem.
- "What is the smallest version we can ship this week?" — kills boil-the-ocean scope.
