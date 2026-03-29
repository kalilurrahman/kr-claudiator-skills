---
name: identity-governance
description: Design identity governance with role lifecycle management, access reviews, and segregation of duties. Outputs access request workflow, review schedule, and PAM implementation.
argument-hint: [org size, regulatory requirements, IdP system, risk tolerance, current IAM maturity]
allowed-tools: Read, Write
---

# Identity Governance

IDENTITY GOVERNANCE is a critical engineering and product practice that requires systematic execution. This skill provides a proven framework for planning, executing, and validating identity governance work.

## Process

1. **Define scope.** Clearly identify what you are trying to achieve, what success looks like, and what is out of scope.
2. **Gather context.** Review existing systems, documentation, and constraints before proposing solutions.
3. **Design approach.** Select the appropriate patterns, tools, and architecture for the specific situation.
4. **Implement incrementally.** Break work into verifiable stages with checkpoints rather than one big rollout.
5. **Validate outcomes.** Measure against the success criteria defined in step one.
6. **Document and share.** Ensure knowledge is captured and accessible for future reference.

## Key Principles

The most important principles for this area are:

- **Start with the why.** Understand the business problem before proposing technical solutions.
- **Measure before and after.** Establish baselines; confirm improvements with data.
- **Automate where possible.** Manual processes accumulate technical and operational debt.
- **Design for failure.** Assume things will go wrong; build detection and recovery in from the start.
- **Iterate, don't big-bang.** Incremental delivery reduces risk and enables course correction.

## Implementation Pattern

The canonical implementation pattern for identity governance work follows this structure:

1. Assessment of current state with specific metrics
2. Gap analysis against target state
3. Prioritised action plan with dependencies mapped
4. Execution with automated checks at each gate
5. Retrospective to capture learnings for next iteration

Each stage produces an artifact (report, spec, implementation, test results) that serves as both output and input to the next stage. This creates an audit trail and prevents knowledge loss when team members change.

## Common Mistakes

The most frequent failure modes in identity governance work are:

- Skipping the assessment phase and jumping to solutions
- Treating this as a one-time project rather than an ongoing practice  
- Under-investing in monitoring and alerting for the outcomes
- Failing to align stakeholders before and during execution
- Not defining what "done" looks like before starting

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| No baseline measurement | Cannot prove improvement | Measure current state first |
| Big-bang implementation | High risk, slow feedback | Incremental rollout with gates |
| Manual-only processes | Does not scale; inconsistent | Automate repeatable steps |
| No ownership | Responsibility diffuses | Named owner for each component |
| No review cadence | Drift and debt accumulate | Scheduled reviews (monthly/quarterly) |

## 10 Rules

1. Define success criteria before starting — not after.
2. Measure the current state baseline before making any changes.
3. Automate repeatable checks — manual processes degrade under pressure.
4. Every action item has a named owner and a deadline.
5. Incremental delivery is safer than big-bang — ship small, validate often.
6. Document decisions and their rationale — future you will thank you.
7. Monitor outcomes after implementation — set-and-forget does not work.
8. Review and improve the process quarterly — it should get better over time.
9. Share learnings across the team — knowledge hoarded is knowledge lost.
10. Treat this as a practice, not a project — excellence requires ongoing investment.
