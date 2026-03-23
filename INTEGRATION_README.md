# Claudiator v2 — Integration Guide
**Produced by:** Claude for Kalilur Rahman  
**Date:** 2026-03

---

## What's changed vs v1

| File | Status | Change summary |
|---|---|---|
| `src/types/skills.types.ts` | **UPDATED** | Unified type supports both bundled and legacy JSON; new `BundledData` type |
| `src/data/categoryMeta.ts` | **NEW** | Single source of truth for emoji icons, dot colours, bg/border tints, Lucide icon names |
| `src/hooks/useTheme.ts` | **NEW** | Dark/light toggle with localStorage persistence + system-pref detection |
| `src/components/SkillCard.tsx` | **UPDATED** | Emoji icon, line count, tool pills, argumentHint, animated accent top bar |
| `src/components/SkillModal.tsx` | **NEW** | 3-button copy (Full / Claude XML / Frontmatter), embedded content (no GitHub fetch), meta pills, toast |
| `src/components/CategoryNav.tsx` | **UPDATED** | Emoji icons from categoryMeta, per-category count badges, coloured active state |
| `src/components/Header.tsx` | **UPDATED** | Dark mode toggle (Sun/Moon), mobile theme toggle |
| `src/pages/SkillsBrowser.tsx` | **UPDATED** | Dual data-mode (bundled first, split fallback), tool filter chips, clear search X, grid header count |
| `src/pages/Index.tsx` | **UPDATED** | Loads from bundled JSON, emoji category grid with counts, feature highlights section, GitHub CTA |
| `src/index.css` | **EXTENDED** | Dark mode colour-scheme, progressFill keyframe, font-mono helper |

All `src/components/ui/*` files are **UNCHANGED**.  
`App.tsx`, `main.tsx`, `Footer.tsx`, `GitHubBanner.tsx`, `MobileBottomNav.tsx`, `SkillsProgressBar.tsx` are **UNCHANGED**.

---

## Integration steps

### Option A — GitHub sync (recommended)

1. Clone your Lovable project repo locally (or open Lovable GitHub sync).
2. Replace the `src/` folder contents with the files from this package.
3. Add `skills-data.json` to `public/data/skills-data.json`.
4. Push. Lovable will auto-deploy.

### Option B — Paste into Lovable chat

For each **new/updated** file, paste the message:

```
Replace the contents of [filepath] with the following code:
[paste full file content]
```

Start with: `src/types/skills.types.ts` → `src/data/categoryMeta.ts` → `src/hooks/useTheme.ts`  
Then: `SkillCard.tsx` → `SkillModal.tsx` → `CategoryNav.tsx` → `Header.tsx`  
Then: `SkillsBrowser.tsx` → `Index.tsx` → `index.css`

---

## Data setup

The new app tries `/data/skills-data.json` first (bundled), then falls back to `/data/skills-index.json` (split).

**For bundled mode (recommended — all 129 skills, no GitHub fetch):**
```
public/
  data/
    skills-data.json          ← from your skills-data.json file
    skills-data_min.json      ← optional minified version
```

**For legacy split mode (keep existing structure):**
```
public/
  data/
    skills-index.json
    01-software-dev.json
    02-devops.json
    … etc
```

---

## New features at a glance

### 1. Embedded skill content
Skills in `skills-data.json` carry their full SKILL.md content inline. The modal renders it immediately — no GitHub API call, no loading spinner for content, no rate-limit risk.

### 2. Three-button copy
- **Copy Full Skill** — the complete SKILL.md (use this to install a skill in your Claude setup)
- **Copy as Claude Tool** — generates the `<skill>` XML snippet for Claude system prompts
- **Copy Frontmatter** — just the YAML `--- ... ---` block

### 3. Tool filter
The Skills Browser has a **Filter** button (SlidersHorizontal icon) that opens a chip panel. Filter by `Read`, `Write`, or `Bash` to find skills by their Claude tool requirements.

### 4. Dark mode
Header includes a Sun/Moon toggle. Preference persists in localStorage. Defaults to system OS preference on first visit.

### 5. Category emoji icons + colour accents
Each category now has: emoji icon, branded dot colour, translucent bg/border, and coloured active state in sidebar and cards.

### 6. Search improvements
- Searches `argumentHint` field in addition to name/description/tags
- Clear (X) button appears when search is non-empty
- Shows total results count above grid
- Works across all 129 skills immediately (no need to click each category first)

---

## Fine-tuning

See `LOVABLE_FINETUNING_PROMPTS.md` for 20+ credit-efficient prompts grouped into modules:  
**A** Data wiring · **B** Visual polish · **C** UX improvements · **D** Modal enhancements · **E** Homepage · **F** Theme · **G** Performance · **H** Copy/export

---

## Dependency notes

No new npm packages are required. All functionality uses:
- `react-markdown` + `remark-gfm` (already in project)
- `lucide-react` (already in project)
- `@/components/ui/scroll-area` (already in project)
- Native `navigator.clipboard` API
