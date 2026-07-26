---
name: cio-vendor-portfolio-rationalisation
description: Reduce SaaS/IT vendor sprawl. Outputs vendor inventory, overlap map, consolidation waves, negotiation levers, and 12-month savings plan with ownership.
argument-hint: [vendor list, spend data, contract expiry, business criticality]
allowed-tools: Read, Write
audience: CIO
---

# IT Vendor & SaaS Rationalisation

A decision-grade playbook for the **CIO** and executive peers. Use it to move from ambiguous business context to a clear, defensible narrative that a board, exec committee, or investment committee can act on within one working session.

The goal is not a long document — it is a **short, sharp, source-cited artefact** that survives challenge from a CFO, a CRO, a regulator, and a sceptical non-executive director in the same room.

## When to invoke

- Preparing a board or exec-committee paper where the recommendation must land in ≤ 5 minutes of reading.
- Framing a major bet (platform, AI, M&A, transformation) where capital, org change, and risk trade off against each other.
- Responding to an activist question ("Why are we spending £X on this?") with a numerate, honest answer.
- Aligning C-suite peers before a decision is escalated — pre-wire the room, not surprise it.
- Refreshing a strategy that has drifted from current market, technology, or regulatory reality.

## Inputs to gather

Ask for these before drafting. If any are missing, state the assumption explicitly in the output — never fabricate a number.

- **Business context** — strategy on a page, top 3 enterprise OKRs, current financial trajectory.
- **Scope** — which business units, geographies, product lines, customer segments are in and out.
- **Constraints** — capital envelope, headcount cap, regulatory obligations, board-imposed guardrails.
- **Time horizon** — decision window, delivery horizon, first value milestone.
- **Stakeholders** — decision-maker, approvers, informed parties, known dissenters.
- **Prior art** — previous attempts, why they succeeded or failed, sunk-cost baggage.
- **Success signals** — the 3-5 metrics the board will actually track quarterly.

## Procedure

1. **Frame the decision.** Write the one-sentence question the paper answers. If the question is fuzzy, stop and sharpen it with the sponsor.
2. **State the recommendation up front.** Executive readers decide in the first paragraph; the rest is evidence.
3. **Anchor to enterprise value.** Tie the recommendation to revenue, cost, risk, or strategic optionality — never to activity metrics.
4. **Show the alternatives you rejected.** Two or three, with the reason each lost. This is the single strongest credibility signal.
5. **Quantify honestly.** Point estimate, range, and the two assumptions that drive it. Use sensitivity, not false precision.
6. **Surface the risks.** Top 5 risks with probability, impact, owner, and mitigation. Include the one risk you cannot mitigate.
7. **Sequence the plan.** 30 / 90 / 180 / 365-day milestones with named owner and exit criteria per stage.
8. **Define the kill switch.** The conditions under which the programme is stopped, not just slowed.
9. **Pre-wire dissent.** List the two objections you expect and the pre-agreed response.
10. **Close with the ask.** Money, people, decisions, and dates — explicit, not implied.

## Output format

### 1. One-page executive summary

- **Question:** The decision this paper answers.
- **Recommendation:** One sentence, active voice.
- **Why now:** The market, technology, or regulatory trigger.
- **Value:** Range with base / low / high case.
- **Ask:** Capital, headcount, decisions, dates.

### 2. Strategic context (½ page)

Where the enterprise is today, where it needs to be, and the gap this decision closes. Reference the enterprise strategy explicitly.

### 3. Options considered

| Option | Description | Value | Cost | Risk | Verdict |
|---|---|---|---|---|---|
| A | Status quo | £ | £ | Medium | Rejected — insufficient pace |
| B | Recommended | £ | £ | Medium | **Selected** |
| C | Alternative | £ | £ | High | Rejected — execution risk |

### 4. Financial case

- NPV, IRR, payback, TCO over the horizon.
- Sensitivity on the two assumptions that move the answer most.
- Cash profile by year, capex vs. opex split.

### 5. Delivery plan

- Waves with entry and exit criteria.
- Owner per wave, RACI at the exec level.
- Dependencies on other programmes, vendors, or hires.

### 6. Risk & governance

- Top 5 risks with probability × impact heat and owner.
- Governance cadence — who meets, how often, what they decide.
- Reporting metrics and cadence to board.

### 7. Change & communications

- Impact on org, roles, and ways of working.
- Comms plan for employees, customers, regulators, investors.

### 8. Appendix

- Assumptions log with source and confidence.
- Benchmarks and comparable programmes.
- Detailed models and working papers.

## Anti-patterns to avoid

| Anti-pattern | Why it fails | Replace with |
|---|---|---|
| Activity metrics dressed as value | Board sees through it in minutes | Revenue, cost, risk, optionality |
| Single-point ROI with 3-decimal precision | Signals false confidence | Range with sensitivity |
| Hiding the risk that killed prior attempts | Erodes trust when discovered | Name it, own it, mitigate it |
| One-option paper | Reads as advocacy, not analysis | Show the alternatives you rejected |
| Endless appendix, thin summary | Executives read the summary only | 1-page summary carries the paper |
| Passive language ("it is recommended…") | Nobody owns the outcome | Active voice, named accountable exec |
| Boiling-the-ocean scope | Guarantees dilution and delay | Explicit in-scope / out-of-scope list |
| Missing kill-switch | Programmes zombie-walk for years | Pre-agreed exit criteria at each stage |
| No pre-wire with dissenters | Ambush in the room | Meet the sceptics 1:1 before the paper |
| Vendor slideware embedded verbatim | Reads as procurement, not strategy | Independent, source-cited analysis |

## Rules

1. State the recommendation in the first sentence — never bury the lede.
2. Anchor every claim to enterprise value, not activity.
3. Show at least two rejected options with reasons.
4. Quantify with ranges and sensitivity, never false precision.
5. Name the accountable executive on every commitment.
6. Include a kill switch with objective exit criteria.
7. Pre-wire the two expected objections and the response.
8. Cite every external benchmark with source and date.
9. Keep the executive summary to one page — always.
10. If an input is missing, state the assumption; never fabricate.

## Worked example — condensed

**Context.** A £2B financial services group with a fragmented data estate, six analytical platforms, and rising regulatory demand under DORA and Consumer Duty. The CIO has been asked to bring a decision to the December board.

**Question.** Should we consolidate to a single lakehouse platform over 24 months, or continue federated with tighter governance?

**Recommendation.** Consolidate to a single lakehouse under a federated governance model, sequenced in three waves, with a hard kill-switch at Wave 1 exit if unit economics miss target by more than 15%.

**Value.** Base case £42m NPV over 5 years (range £28m–£61m). Primary drivers: 38% reduction in duplicative platform cost, 22% faster regulatory reporting cycle, and unlock of cross-domain AI use-cases valued at £11m.

**Ask.** £14m capex over 24 months, 42 FTE peak (28 internal, 14 partner), board decision by 15 December, first value milestone 30 June.

**Kill switch.** If Wave 1 (foundational domains) does not deliver the target 20% reporting-cycle improvement and £3m run-cost reduction by month 9, the programme is paused and re-scoped before Wave 2 capital is released.

**Top risks.** Talent scarcity in platform engineering (mitigation: partner-led ramp with knowledge-transfer gates); data-quality debt in legacy domains (mitigation: remediation budget ring-fenced per domain); change-fatigue in analytics community (mitigation: change network with named champions per BU).

**Governance.** Monthly steering chaired by the CIO, quarterly board update, independent assurance review at each wave exit.

## Extension prompts

- "Draft the board slide version of this recommendation in exactly 6 slides."
- "Generate the sensitivity table for the top three financial assumptions."
- "Write the response to the objection that we should defer this by 12 months."
- "Produce the 90-day mobilisation plan with named workstream leads."
- "Draft the kill-switch criteria as an assurance checklist."

## Companion skills

- executive-briefs — for the shorter decision-memo format.
- cto-technology-strategy — when the decision is architecture-led.
- cio-digital-transformation-roadmap — for enterprise-wide programmes.
- cfo-technology-investment-case — for the deep financial appendix.
- cxo-ai-governance-council — when the decision touches AI risk.
