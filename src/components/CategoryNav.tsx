import type { Category } from "@/types/skills.types";
import {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
};

interface CategoryNavProps {
  categories: Category[];
  activeId: string | null;
  loadedIds: Set<string>;
  onSelect: (id: string) => void;
}

export function CategoryNav({ categories, activeId, loadedIds, onSelect }: CategoryNavProps) {
  return (
    <nav className="space-y-0.5">
      {categories.map((cat) => {
        const Icon = iconMap[cat.icon] || Zap;
        const active = activeId === cat.id;
        const loaded = loadedIds.has(cat.id);
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs tracking-wide transition-colors focus-ring ${
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{cat.label}</span>
            {loaded && !active && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
