import type { Skill } from "@/types/skills.types";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

const difficultyStyles: Record<string, string> = {
  beginner: "bg-success/15 text-success border-success/30",
  intermediate: "bg-warning/15 text-warning border-warning/30",
  advanced: "bg-destructive/15 text-destructive border-destructive/30",
};

interface SkillCardProps {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border border-border/50 bg-card rounded-lg card-hover focus-ring"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-card-foreground leading-snug">{skill.name}</h3>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
          {skill.difficulty}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{skill.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {skill.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-medium text-primary uppercase tracking-wide">
        View Prompt →
      </p>
    </button>
  );
}

interface SkillModalProps {
  skill: Skill;
  onClose: () => void;
}

export function SkillModal({ skill, onClose }: SkillModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(skill.promptPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const githubUrl = `https://github.com/kalilurrahman/kr-claudiator-skills/blob/main/${skill.githubPath}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-xl animate-slide-up md:animate-fade-in max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-semibold text-card-foreground">{skill.name}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded focus-ring">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Use case</span>
            <p className="text-sm text-foreground mt-0.5">{skill.useCase}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
              {skill.difficulty}
            </span>
            {skill.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Prompt preview</span>
            <pre className="mt-1.5 p-3 bg-muted rounded-lg text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed border border-border/50">
              {skill.promptPreview}
            </pre>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-ring"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Prompt"}
            </button>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded border border-primary/40 px-4 py-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10 focus-ring"
            >
              View on GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
