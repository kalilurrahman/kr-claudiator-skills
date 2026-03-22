import type { Skill } from "@/types/skills.types";
import { X, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/kalilurrahman/kr-claudiator-skills/main";

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
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setMarkdown(null);

    const url = `${GITHUB_RAW_BASE}/${skill.githubPath}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.text();
      })
      .then((text) => {
        // Strip YAML frontmatter (---...---)
        const stripped = text.replace(/^---[\s\S]*?---\n*/, "");
        setMarkdown(stripped);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [skill.githubPath]);

  const handleCopy = async () => {
    const textToCopy = markdown ?? skill.promptPreview;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const githubUrl = `https://github.com/kalilurrahman/kr-claudiator-skills/blob/main/${skill.githubPath}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-xl animate-slide-up md:animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-card-foreground truncate">{skill.name}</h2>
            <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
              {skill.difficulty}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded focus-ring">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Use case */}
            <div>
              <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Use case</span>
              <p className="text-sm text-foreground mt-0.5">{skill.useCase}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {skill.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>

            {/* Full skill markdown */}
            <div>
              <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold">
                Full skill prompt
              </span>
              <div className="mt-1.5 p-4 bg-muted rounded-lg border border-border/50">
                {loading && (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading skill from GitHub…</span>
                  </div>
                )}
                {error && (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">Could not load the full skill from GitHub.</p>
                    <p className="text-[10px] text-muted-foreground">Showing preview instead:</p>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {skill.promptPreview}
                    </pre>
                  </div>
                )}
                {markdown && (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-background prose-pre:border prose-pre:border-border/50 prose-pre:text-xs prose-a:text-primary prose-li:text-foreground/90 prose-table:text-xs prose-th:text-foreground prose-td:text-foreground/80 prose-th:border-border prose-td:border-border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-ring"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Full Prompt"}
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
        </ScrollArea>
      </div>
    </div>
  );
}
