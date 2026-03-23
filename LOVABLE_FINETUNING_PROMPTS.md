# Claudiator v2 — Lovable Fine-Tuning Prompt Sheet
**Author:** Kalilur Rahman  
**Purpose:** Credit-efficient prompts for incremental adjustments after the initial src upload.  
Each prompt below is self-contained: paste exactly as-is into the Lovable chat. One prompt = one credit-sized change.

---

## How to use this sheet

1. Push the new `src/` folder to your Lovable project via GitHub sync or the "Replace files" flow.
2. Verify the app builds and runs correctly.
3. Use the prompts below **only for delta tuning** — do NOT re-describe the whole app.

> **Credit rule of thumb:** Each prompt below targets ≤ 3 files. If Lovable can do it in one edit, it costs ~1 credit.

---

## MODULE A — Data wiring (do first, once)

### A1 — Point the app at skills-data.json
```
In public/data/ I have skills-data.json (bundled, with embedded skill content).
In SkillsBrowser.tsx the BUNDLED_URL constant is already "/data/skills-data.json".
Please confirm the public/data/ folder is served correctly by checking
vite.config.ts and ensuring no rewrites block /data/*.json.
No component changes needed.
```

### A2 — Seed the data folder (if skills-data.json is not yet in public/)
```
Copy the file skills-data.json from the repo root into public/data/skills-data.json
so the React app can fetch it at /data/skills-data.json.
Also copy skills-data_min.json → public/data/skills-data_min.json.
No component changes needed.
```

---

## MODULE B — Visual polish

### B1 — Rounded card corners to match POC
```
In src/components/SkillCard.tsx change the card container's rounded class
from "rounded-lg" to "rounded-xl" to match the dark POC aesthetic.
Touch only SkillCard.tsx.
```

### B2 — Darker code blocks in markdown (POC style)
```
In src/components/SkillModal.tsx, inside the prose div's className,
replace: prose-pre:bg-card
with:    prose-pre:bg-[#0d0d14] dark:prose-pre:bg-[#0d0d14]
This matches the near-black code block background from the POC.
Touch only SkillModal.tsx.
```

### B3 — Card hover accent bar colour matches category dot
```
The SkillCard already renders a coloured top bar using inline style with meta.dot.
If the bar is not visible on hover, ensure the parent div has "group" and the span
uses "group-hover:opacity-100 opacity-0 transition-opacity duration-200".
Touch only SkillCard.tsx.
```

### B4 — Hero gradient matches KR palette (navy → indigo)
```
In src/index.css, update the .gradient-hero class to use the KR navy/indigo gradient:
background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
This gives the deep navy-to-indigo hero consistent with the KR brand.
Touch only index.css.
```

### B5 — Category nav: wider sidebar for long labels
```
In src/pages/SkillsBrowser.tsx change the aside width class from "w-56" to "w-64"
so "DevOps & Infrastructure" and "Product Management" labels don't truncate.
Touch only SkillsBrowser.tsx.
```

---

## MODULE C — UX improvements

### C1 — Keyboard shortcut: "/" focuses search
```
In src/pages/SkillsBrowser.tsx add a useEffect that listens for keydown.
When the pressed key is "/" and the active element is NOT an input or textarea,
call searchRef.current?.focus() and e.preventDefault().
Add a tiny "/" kbd hint inside the search box placeholder or to the right of the input.
Touch only SkillsBrowser.tsx.
```

### C2 — Skill count badge on mobile tab strip
```
In src/pages/SkillsBrowser.tsx, inside the mobile tab strip map,
the button already shows cat.label. After the label text, add:
  {cat.count != null && <span className="ml-1 opacity-50 text-[9px]">{cat.count}</span>}
Touch only SkillsBrowser.tsx.
```

### C3 — "All Skills" virtual category in sidebar
```
In src/pages/SkillsBrowser.tsx, before the <CategoryNav> in the desktop aside,
add a button for "All Skills" that sets activeCategory to null and clears searchQuery.
Style it to match CategoryNav items: same padding, same font-size, active = bg-primary/10.
When activeCategory is null the displaySkills should return allSkills (cap at 100 for perf).
Touch only SkillsBrowser.tsx.
```

### C4 — Persist last-visited category in sessionStorage
```
In src/pages/SkillsBrowser.tsx:
1. On handleSelectCategory, also write sessionStorage.setItem("claudiator_cat", id).
2. On initial load (after index is set), read sessionStorage.getItem("claudiator_cat")
   and use it as the initial active category if the URL param is absent.
Touch only SkillsBrowser.tsx.
```

### C5 — Empty state with suggested skills
```
In src/pages/SkillsBrowser.tsx, when displaySkills.length === 0 and searchQuery is set,
show 3 random skills from allSkills as "You might like" cards below the empty state message.
Render them using <SkillCard> with the same onClick handler.
Touch only SkillsBrowser.tsx.
```

---

## MODULE D — Modal enhancements

### D1 — Argument hint input helper in modal
```
In src/components/SkillModal.tsx, below the meta pills and above the action buttons,
if skill.argumentHint is set, add a small labelled text input:
  label: "Fill in arguments"
  placeholder: skill.argumentHint (the bracket text, e.g. [resource names, auth method])
  When the user types, update a local state argsValue.
Add a 4th copy button "Copy with Args" that, when clicked, replaces the first occurrence
of skill.argumentHint in skill.content with the argsValue before copying.
Touch only SkillModal.tsx.
```

### D2 — Modal: close on browser back (popstate)
```
In src/components/SkillModal.tsx, add a useEffect that:
1. On mount: history.pushState(null, "", window.location.href)
2. Listens for "popstate" event → calls onClose()
3. On unmount: removes the listener
This enables the Android/iOS hardware back button to close the modal.
Touch only SkillModal.tsx.
```

### D3 — Modal: line count progress bar
```
In src/components/SkillModal.tsx, if skill.lines is set, add a thin horizontal progress
bar below the meta pills (before action buttons). Max is the largest skill line count
in the same category (if available) or a fixed max of 600. Colour uses meta.dot.
Label: "Skill complexity" on the left, "{skill.lines} lines" on the right, text-[10px].
Touch only SkillModal.tsx.
```

---

## MODULE E — Home page

### E1 — "Latest skills" row on homepage
```
In src/pages/Index.tsx, after the category grid section, add a new section
"Recently added skills". Fetch the last 6 skills from skills-data.json
(tail of the skills array). Render them as a 3-column grid of compact SkillCard items
with onClick navigating to /skills?category=<categoryId>.
Import SkillCard from @/components/SkillCard.
Touch only src/pages/Index.tsx.
```

### E2 — Hero: animated skill count ticker
```
In src/pages/Index.tsx, wrap the {data.totalSkills} display in the hero with a counter
animation: count from 0 → totalSkills over 1.2 seconds using requestAnimationFrame.
Use a useRef for the frame ID and clear it on unmount.
Touch only src/pages/Index.tsx.
```

---

## MODULE F — Theme

### F1 — System-preference auto dark mode on first visit
```
In src/hooks/useTheme.ts, the initial state already checks prefers-color-scheme.
Confirm the logic: if no localStorage value, use window.matchMedia('(prefers-color-scheme: dark)').matches.
No change needed unless the current logic defaults to "light" regardless.
Touch only useTheme.ts if a fix is needed.
```

### F2 — Dark mode: card background slightly lighter for contrast
```
In src/index.css, inside the .dark block, change --card from 220 18% 10% to 220 18% 12%
so skill cards are subtly distinct from the page background in dark mode.
Touch only index.css.
```

---

## MODULE G — Performance

### G1 — Virtualise the skill grid for large lists
```
The grid can show 100+ cards. Add simple windowing:
In src/pages/SkillsBrowser.tsx, cap displaySkills to the first 60 items and
add a "Load more" button that increments the visible count by 30.
Show "Showing X of Y skills" above the grid.
No external library needed. Touch only SkillsBrowser.tsx.
```

### G2 — Debounce search input (16ms)
```
In src/pages/SkillsBrowser.tsx, wrap the setSearchQuery call in the search input's
onChange with a 180ms debounce using useRef + setTimeout.
Clear the timeout on each new keystroke.
Touch only SkillsBrowser.tsx.
```

---

## MODULE H — Copy & export additions

### H1 — Download skill as .md file
```
In src/components/SkillModal.tsx, add a 5th action: "Download .md"
as a ghost button. On click, create a Blob from skill.content ?? markdown,
create an object URL, trigger a programmatic <a> download with
filename = skill.name + ".md", then revoke the URL.
No new libraries. Touch only SkillModal.tsx.
```

### H2 — Share button (Web Share API with clipboard fallback)
```
In src/components/SkillModal.tsx, add a "Share" icon button (ShareIcon from lucide-react)
in the modal header row (next to the X close button).
On click: if navigator.share is available, call it with {title: skill.name, text: skill.description}.
Otherwise, copy window.location.href + "?skill=" + skill.id to clipboard and show the toast.
Touch only SkillModal.tsx.
```

---

## Notes

- Always test in **Preview** before committing.
- Modules A → F → G → H is the recommended order.
- If Lovable rolls back a change, paste the prompt again with: "Retry: " prepended.
- For any prompt touching more than 3 files, split into two separate messages.
