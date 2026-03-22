import type { Skill } from "@/types/skills.types";

interface SkillCardProps {
  skill: Skill;
}

export function SkillCard({ skill }: SkillCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="font-semibold text-card-foreground">{skill.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{skill.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skill.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
