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
