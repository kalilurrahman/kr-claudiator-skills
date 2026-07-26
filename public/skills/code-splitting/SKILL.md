---
name: code-splitting
description: Implement code splitting to reduce initial bundle size and improve web application load time. Outputs splitting strategy, lazy loading patterns, preloading rules, and performance measurement approach.
argument-hint: [framework, current bundle size, performance targets, route structure]
allowed-tools: Read, Write, Bash
---

# Code Splitting

Code splitting breaks a large JavaScript bundle into smaller chunks loaded on demand. Instead of loading everything at startup, the browser loads only what's needed for the current view. The result is faster initial load, better Time to Interactive (TTI), and lower data usage.

## Process

1. **Measure first.** Analyse the current bundle with webpack-bundle-analyzer or similar. Find the biggest chunks.
2. **Split at route boundaries.** Each route loaded lazily is the highest-impact split.
3. **Split large third-party libraries.** Chart libraries, date pickers, editors — load only when used.
4. **Add preloading for likely next routes.** `<link rel="prefetch">` or React.lazy with prefetch.
5. **Set performance budgets.** Max bundle size per chunk. Fail CI if budgets are exceeded.
6. **Measure improvement.** Before/after Lighthouse scores, Core Web Vitals.

## React Route-Based Splitting

```tsx
// App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { LoadingSpinner } from "./components/LoadingSpinner";

// Each route loaded only when navigated to
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Orders       = lazy(() => import("./pages/Orders"));
const Analytics    = lazy(() => import("./pages/Analytics"));
const Settings     = lazy(() => import("./pages/Settings"));

// Heavy editor — loaded only when used
const RichTextEditor = lazy(() =>
  import("./components/RichTextEditor").then(m => ({ default: m.RichTextEditor }))
);

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/orders/*"   element={<Orders />} />
        <Route path="/analytics"  element={<Analytics />} />
        <Route path="/settings"   element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Preload on hover — load before user clicks
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const preload = () => {
    // Trigger the lazy import to start loading
    if (to === "/analytics") import("./pages/Analytics");
    if (to === "/orders")    import("./pages/Orders");
  };

  return (
    <Link to={to} onMouseEnter={preload} onFocus={preload}>
      {children}
    </Link>
  );
}
```

## Vite / Webpack Bundle Analysis

```bash
# Vite — visualise bundle
npm install -D rollup-plugin-visualizer
# vite.config.ts:
# plugins: [visualizer({ open: true, gzipSize: true })]
vite build

# Webpack Bundle Analyzer
npm install -D webpack-bundle-analyzer
# webpack.config.js: plugins: [new BundleAnalyzerPlugin()]
webpack --analyze

# What to look for:
# 1. Large vendor chunks (chart.js, moment.js, lodash)
# 2. Duplicated dependencies (same library, multiple versions)
# 3. Unexpectedly large page chunks
```

## Dynamic Imports for Heavy Libraries

```typescript
// Don't import chart libraries at the top of the file
// BAD:
import { Chart } from "chart.js";
import "chart.js/auto";

// GOOD: Load only when the chart is needed
async function renderChart(canvas: HTMLCanvasElement, data: ChartData) {
  const { Chart } = await import("chart.js/auto");
  return new Chart(canvas, { type: "bar", data });
}

// React hook for lazy-loaded feature
function useChartJs() {
  const [ChartJs, setChartJs] = React.useState<typeof import("chart.js") | null>(null);

  React.useEffect(() => {
    import("chart.js/auto").then(setChartJs);
  }, []);

  return ChartJs;
}
```

## Performance Budget (CI Gate)

```javascript
// bundlesize.config.js
module.exports = {
  files: [
    { path: "dist/assets/index-*.js",      maxSize: "150kb" },
    { path: "dist/assets/vendor-*.js",     maxSize: "200kb" },
    { path: "dist/assets/Dashboard-*.js",  maxSize: "80kb"  },
    { path: "dist/assets/Analytics-*.js",  maxSize: "120kb" },
  ],
};
// Run: bundlesize — fails CI if any chunk exceeds limit
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Splitting every component** | Too many small chunks; HTTP overhead | Split at route or feature boundaries |
| **No Suspense boundary** | Lazy component errors crash the app | Wrap every lazy component in Suspense |
| **Loading without preloading** | Users wait on navigation | Preload on hover/focus for predictable next routes |
| **Splitting without measuring** | Random splits may not help | Analyse bundle first; split biggest chunks |
| **No loading states** | Layout shift when chunk loads | Skeleton screens or spinners for lazy sections |

## 10 Rules

1. Measure before splitting — bundle analyser reveals actual bottlenecks.
2. Route-based splitting is the highest-impact first step.
3. Heavy third-party libraries (charts, editors, date pickers) are split separately.
4. Every `React.lazy()` has a `<Suspense>` boundary with a loading fallback.
5. Preload likely next routes on hover — eliminates perceived loading delay.
6. Set performance budgets and enforce them in CI — chunks grow without gates.
7. Prefer named exports from split chunks — tree-shaking works better.
8. Prefetch on network idle for routes users haven't visited but likely will.
9. Test on throttled connections — 3G simulation reveals real-world impact.
10. Core Web Vitals (LCP, TTI) are the outcome metrics — bundle size is a proxy.

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

The canonical workflow for **Code Splitting** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement code splitting to reduce initial bundle size and improve web application load time. Outputs splitting strategy, lazy loading patterns, preloading rule
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
