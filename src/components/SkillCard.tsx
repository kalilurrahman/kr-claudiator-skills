import type { Skill } from "@/types/skills.types";
import { getCategoryMeta } from "@/data/categoryMeta";
import { Heart } from "lucide-react";
import { useState } from "react";
import { isFavourite, toggleFavourite } from "@/lib/favourites";
import { toast } from "sonner";

const difficultyStyles: Record<string, string> = {
  beginner:     "bg-success/15 text-success border-success/30",
  intermediate: "bg-warning/15 text-warning border-warning/30",
  advanced:     "bg-destructive/15 text-destructive border-destructive/30",
};

interface SkillCardProps {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
  const meta = getCategoryMeta(skill.category);
  const [fav, setFav] = useState(() => isFavourite(skill.id));

  const tools = skill.allowedTools
    ? skill.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const hint = skill.argumentHint?.replace(/^\[|\]$/g, "");

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleFavourite(skill.id);
    setFav(added);
    toast(added ? "Added to favourites ♥" : "Removed from favourites");
  };

  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-4 border border-border/50 bg-card rounded-xl card-hover glow-on-hover focus-ring flex flex-col gap-2.5 relative overflow-hidden transition-all"
    >
      {/* Favourite button */}
      <button
        onClick={handleFav}
        className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive focus-ring z-10"
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart className={`w-3.5 h-3.5 ${fav ? "fill-destructive text-destructive" : ""}`} />
      </button>

      {/* Accent top bar */}
      <span
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: `linear-gradient(90deg, ${meta.dot}, ${meta.dot}80)` }}
      />

      {/* Top row */}
      <div className="flex items-start gap-2.5 pr-6">
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base leading-none"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          {meta.emoji}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-card-foreground leading-tight truncate">
            {skill.name}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {skill.category ?? "Skill"}
          </p>
        </div>

        {skill.lines != null ? (
          <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70 mt-0.5">
            {skill.lines}L
          </span>
        ) : skill.difficulty ? (
          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
            {skill.difficulty}
          </span>
        ) : null}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {skill.description}
      </p>

      {/* Footer: tool pills + hint OR tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tools.length > 0 ? (
          tools.map((t) => (
            <span
              key={t}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded border"
              style={{ background: `${meta.dot}10`, color: meta.dot, borderColor: `${meta.dot}30` }}
            >
              {t}
            </span>
          ))
        ) : (
          skill.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {tag}
            </span>
          ))
        )}

        {hint && (
          <span className="font-mono text-[9px] text-muted-foreground/60 truncate max-w-[140px]">
            {hint}
          </span>
        )}
      </div>

      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mt-0.5">
        View Skill →
      </p>
    </button>
  );
}
