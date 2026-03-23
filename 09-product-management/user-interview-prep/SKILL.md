---
name: user-interview-prep
description: Prepare a complete user interview guide including screener, discussion guide, objectives, warm-up questions, and synthesis framework. Outputs interview materials ready to run.
argument-hint: [research question, user type to interview, product stage, what decisions the research will inform]
allowed-tools: Read, Write
---

# User Interview Prep

A user interview is only as good as its preparation. Poorly designed questions produce validation-seeking answers. Well-designed guides surface genuine behavior and unmet needs. This generates a complete interview package — screener, discussion guide, and synthesis framework.

## Process

1. **Define the research question** — what specific question does this research need to answer? Not a topic — a question.
2. **Identify the right participants** — who has the behavior or experience you need to understand?
3. **Write the screener** — criteria to include and exclude the right participants.
4. **Build the discussion guide** — open questions that surface behavior, not opinions.
5. **Plan synthesis** — how will you analyze findings across multiple interviews?
6. **Prepare logistics** — recording, notes, time allocation.

## Output Format

```markdown
# User Interview Guide: [Research Question]

**Research question:** [Specific question this research will answer — e.g., "Why do users abandon the onboarding flow before connecting their first integration?"]  
**Decisions informed:** [What product or roadmap decision will this research support?]  
**Target interviews:** [N sessions — enough for pattern recognition without over-investment]  
**Interview format:** [Remote video / in-person / contextual inquiry]  
**Duration:** [45–60 minutes recommended]  
**Prepared by:** [Name]  
**Date:** [Date]

---

## Screener

*Send to potential participants before scheduling. Recruit people who have the behavior, not just the profile.*

**Include if:**
- [ ] [Behavior criterion — e.g., "Currently uses a tool in the [category] space, at least 3x/week"]
- [ ] [Role criterion — e.g., "Responsible for [job function] at their company"]
- [ ] [Company size — e.g., "Works at a company with 25–500 employees"]
- [ ] [Recent experience — e.g., "Has evaluated or switched tools in this category in the last 12 months"]

**Exclude if:**
- [ ] [Works at a competitor]
- [ ] [Already a customer of your product — interview separately]
- [ ] [Has not personally experienced the workflow you are researching]
- [ ] [Decision-maker only, no hands-on usage of the product]

**Screener questions:**
1. [Question to confirm inclusion criterion 1]
2. [Question to confirm inclusion criterion 2]
3. [Open question: "Briefly describe how your team currently handles [workflow]"]

---

## Discussion Guide

### Before the interview (your notes)

**Hypotheses to test:** [List 2–3 hypotheses you have going in — so you notice when evidence supports or refutes them]
- Hypothesis 1: [e.g., "Users abandon because they cannot find the API key in their other tool"]
- Hypothesis 2: [e.g., "Users are confused about which integration to connect first"]

**Behaviors to observe:** [What to watch for beyond just answers]
- [Observable signal 1 — e.g., "Do they say 'I' or 'we' when describing the workflow — individual or team behavior?"]
- [Observable signal 2]

---

### Opening (5 min)

*Build rapport; set expectations for the session.*

1. "Thank you for making time. Before we start, a few things: there are no right or wrong answers — I am trying to understand your experience, not test you. I will be taking notes, and with your permission, I will record the session. Is that okay?"

2. "Can you start by telling me a bit about your role and what your day-to-day looks like?"
   *(Listen for: what they prioritize, what tools they mention, where [your product category] fits in their workflow)*

3. "How long have you been in this role, and what brought you to it?"

---

### Context (10 min)

*Understand their world before diving into the specific workflow.*

4. "Walk me through a typical week when it comes to [the workflow area you are researching]. What does that actually look like?"  
   *(Probe: "Then what happens?" "Who else is involved?" "How often does this happen?")*

5. "What tools do you use for [workflow]? How did you end up using those?"  
   *(Listen for: evaluation process, switching moments, what they tolerate)*

6. "Can you show me — or describe in detail — how you [do the specific task]? Walk me through the last time you did it."  
   *(The best user research is behavioral, not attitudinal. Get them to describe a specific instance.)*

---

### Core Topic (25 min)

*Dig into the specific behavior or experience that answers your research question.*

7. "Tell me about the last time you [specific behavior related to research question]. What prompted it? What did you do?"  
   *(Do not lead. Let them tell the story in their own order.)*

8. "What was the hardest part of that? What slowed you down?"  
   *(Probe: "How did you eventually solve it?" "Is there a workaround you use?")*

9. "What have you tried that did not work? What did you give up on?"  
   *(The attempts before the workaround reveal what they actually want)*

10. "When things go well with [workflow], what does that look like? What made the difference?"  
    *(Success stories reveal the conditions users need — and often what they do not have)*

11. "If you could change one thing about how you do [workflow] today, what would it be?"  
    *(Open, not product-specific. Listen for the underlying need, not the proposed solution.)*

12. "Have you looked at other tools for this? What made you choose / not switch?"  
    *(Evaluation criteria — what actually matters to them in a buying decision)*

---

### Product Exposure (if applicable) (10 min)

*Only if you are testing a specific concept or prototype — skip for pure discovery research.*

13. "I want to show you something and get your honest reaction. This is early and nothing is final."  
    *(Show prototype / concept)*

14. "What is your first impression? What do you think this is for?"

15. "Walk me through what you would do if you were using this for [their specific use case]."  
    *(Watch behavior, not just words. Note where they hesitate, click wrong, or express confusion.)*

16. "What would need to be true for you to actually use this?"

---

### Wrap-Up (5 min)

17. "Is there anything important about [topic] that I have not asked about — something you think I should understand?"

18. "If you were advising a company building a product for [your target user], what would you tell them not to miss?"

19. "Is there anyone else you think I should talk to?"

*Thank them. Confirm incentive delivery.*

---

## Synthesis Framework

### Per-interview notes template

```
Participant: [Code — do not use real names in notes]
Date:
Duration:
Segment: [Role / company size / user type]

KEY QUOTES (verbatim — preserve their words):
- "[Quote]"
- "[Quote]"

BEHAVIORS OBSERVED (what they do, not what they say):
- [Behavior 1]
- [Behavior 2]

PAIN POINTS:
- [Pain] — [Evidence / quote]

WORKAROUNDS:
- [What they do instead of a good solution]

SURPRISES (things you did not expect):
- [Surprise]

HYPOTHESES SUPPORTED/REFUTED:
- H1: [Supported / Refuted / Inconclusive] — [Evidence]
- H2: [Supported / Refuted / Inconclusive] — [Evidence]
```

### Cross-interview synthesis

After [N] interviews, look for:

1. **Patterns** — what appears in 3+ interviews?  
2. **Outliers** — what appears in only one but is striking?  
3. **Hypotheses tested** — what did the research confirm, challenge, or complicate?  
4. **Jobs to be done** — what underlying need are all the surface behaviors pointing toward?  
5. **Quotes to anchor the report** — 3–5 verbatim quotes that capture the core finding  

---

## Interview Logistics

- **Recording:** [Tool — Zoom / Otter / Rev.ai] — always get consent first
- **Note-taker:** [If using a second person — describe their role]
- **Incentive:** [$X gift card / professional acknowledgment] — send within 48h
- **Schedule buffer:** 15 min after each session to write notes while fresh
- **Report format:** [When and how findings will be shared]
```

## Do's and Don'ts

| Do | Don't |
|----|-------|
| Ask about past behavior ("last time you...") | Ask about hypothetical behavior ("would you ever...") |
| Follow the interesting answer, not just the guide | Read questions verbatim and move on |
| Probe with "then what?" and "tell me more" | Accept the first answer to a vague question |
| Note verbatim quotes immediately | Paraphrase quotes from memory after |
| Start with context, end with product | Start by showing the product |
| Invite them to show you (screen share) | Rely on verbal descriptions of behavior |
| Say "that's interesting, tell me more" | Nod and say "that's great!" (primes them) |
| Ask one question at a time | Bundle 2 questions in one turn |

## Rules

- **Research question before interview guide** — the guide exists to answer a specific question.
- **Past behavior over future intention** — "what would you do" answers are unreliable; "what did you do" is evidence.
- **Open questions only in the guide** — yes/no questions produce yes/no answers.
- **Silence is a tool** — uncomfortable silence prompts elaboration. Do not fill it.
- **Listen for workarounds** — they reveal the gap between what users need and what exists.
- **Do not show the product until you understand the problem** — early product exposure primes users to give feedback on your solution instead of describing their actual need.
- **N=5 reveals most patterns** — you do not need 30 interviews for qualitative research; 5–8 done well reveals the major patterns.
- **Separate observation from interpretation** — note what they said and did, separately from what you conclude.
- **Share raw notes with the team** — it builds shared understanding that a report cannot.
- **Act on the research** — user interviews that never influence a decision were a waste of the participant's time.
