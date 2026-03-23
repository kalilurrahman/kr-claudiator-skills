import type { Category } from "@/types/skills.types";
import { getCategoryMeta } from "@/data/categoryMeta";
import {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const lucideMap: Record<string, LucideIcon> = {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug, Zap,
};

interface CategoryNavProps {
  categories: Category[];
  activeId: string | null;
  loadedIds: Set<string>;
  onSelect: (id: string) => void;
  /** If true, show emoji icons; if false, use Lucide icons (legacy) */
  useEmoji?: boolean;
}

export function CategoryNav({
  categories, activeId, loadedIds, onSelect, useEmoji = true,
}: CategoryNavProps) {
  return (
    <nav className="space-y-0.5">
      {categories.map((cat) => {
        const meta = getCategoryMeta(cat.label);
        const LucideIcon = lucideMap[meta.lucideIcon] ?? Zap;
        const active = activeId === cat.id;
        const loaded = loadedIds.has(cat.id);

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs tracking-wide transition-all focus-ring ${
              active
                ? "font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            style={active ? { background: `${meta.dot}15`, color: meta.dot } : undefined}
          >
            {/* Icon */}
            {useEmoji ? (
              <span
                className="w-5 h-5 flex items-center justify-center text-sm leading-none shrink-0"
              >
                {meta.emoji}
              </span>
            ) : (
              <LucideIcon className="w-3.5 h-3.5 shrink-0" />
            )}

            {/* Label */}
            <span className="truncate flex-1 text-left">{cat.label}</span>

            {/* Count badge */}
            {cat.count != null && (
              <span
                className="font-mono text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                style={
                  active
                    ? { background: `${meta.dot}25`, color: meta.dot }
                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {cat.count}
              </span>
            )}

            {/* Loaded indicator (legacy split-JSON mode) */}
            {loaded && !active && cat.count == null && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
