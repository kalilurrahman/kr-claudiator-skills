// ─────────────────────────────────────────────────────────────────────────────
// categoryMeta.ts — Single source of truth for category visual identity
// Combines emoji icons (POC) + Lucide icon names (legacy app) + dot colors
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryMeta {
  emoji: string;       // Displayed in cards + modal header
  dot: string;         // Dot / accent colour (hex)
  bg: string;          // Translucent background (hex + alpha suffix)
  border: string;      // Translucent border (hex + alpha suffix)
  lucideIcon: string;  // Lucide icon name (used in desktop category nav)
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "Software Development": {
    emoji: "⚙️", dot: "#7c6aff", bg: "#7c6aff18", border: "#7c6aff30", lucideIcon: "Code2",
  },
  "DevOps & Infrastructure": {
    emoji: "🚀", dot: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b30", lucideIcon: "Server",
  },
  "Data & Analytics": {
    emoji: "📊", dot: "#06b6d4", bg: "#06b6d418", border: "#06b6d430", lucideIcon: "BarChart2",
  },
  "AI / ML": {
    emoji: "🧠", dot: "#a78bfa", bg: "#a78bfa18", border: "#a78bfa30", lucideIcon: "Brain",
  },
  "Security": {
    emoji: "🔐", dot: "#ef4444", bg: "#ef444418", border: "#ef444430", lucideIcon: "Shield",
  },
  "System Design": {
    emoji: "🏗️", dot: "#10b981", bg: "#10b98118", border: "#10b98130", lucideIcon: "Layers",
  },
  "Testing & Quality": {
    emoji: "✅", dot: "#f97316", bg: "#f9731618", border: "#f9731630", lucideIcon: "CheckCircle2",
  },
  "API & Integration": {
    emoji: "🔗", dot: "#ec4899", bg: "#ec489918", border: "#ec489930", lucideIcon: "Plug",
  },
  "Product Management": {
    emoji: "🎯", dot: "#84cc16", bg: "#84cc1618", border: "#84cc1630", lucideIcon: "BarChart2",
  },
};

/** Fallback meta for unknown categories */
export const DEFAULT_META: CategoryMeta = {
  emoji: "📄", dot: "#888899", bg: "#88889918", border: "#88889930", lucideIcon: "Zap",
};

export function getCategoryMeta(category?: string): CategoryMeta {
  if (!category) return DEFAULT_META;
  return CATEGORY_META[category] ?? DEFAULT_META;
}
