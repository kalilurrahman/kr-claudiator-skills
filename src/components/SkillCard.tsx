import type { Skill } from "@/types/skills.types";
<<<<<<< HEAD
import { getCategoryMeta } from "@/data/categoryMeta";
=======
import { X, Copy, Check, ExternalLink, Loader2, Download, FileText, FileDown, Heart } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { downloadMarkdown, downloadText, downloadPdf } from "@/lib/downloads";
import { isFavourite, toggleFavourite } from "@/lib/favourites";
import { toast } from "sonner";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/kalilurrahman/kr-claudiator-skills/main";
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8

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
<<<<<<< HEAD
  const meta = getCategoryMeta(skill.category);

  // Parse allowedTools into individual pill strings
  const tools = skill.allowedTools
    ? skill.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  // Argument hint — strip square brackets for display
  const hint = skill.argumentHint?.replace(/^\[|\]$/g, "");
=======
  const [fav, setFav] = useState(() => isFavourite(skill.id));

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleFavourite(skill.id);
    setFav(added);
    toast(added ? "Added to favourites ♥" : "Removed from favourites");
  };
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8

  return (
    <button
      onClick={onClick}
<<<<<<< HEAD
      className="group w-full text-left p-4 border border-border/50 bg-card rounded-lg card-hover focus-ring flex flex-col gap-2.5 relative overflow-hidden transition-all"
    >
      {/* Accent top bar — appears on hover */}
      <span className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(90deg, ${meta.dot}, ${meta.dot}80)` }} />

      {/* Top row: icon + name + line count */}
      <div className="flex items-start gap-2.5">
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base leading-none"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          {meta.emoji}
=======
      className="w-full text-left p-4 border border-border/50 bg-card rounded-xl card-hover glow-on-hover focus-ring group relative"
    >
      <button
        onClick={handleFav}
        className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive focus-ring"
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart className={`w-3.5 h-3.5 ${fav ? "fill-destructive text-destructive" : ""}`} />
      </button>
      <div className="flex items-start justify-between gap-2 mb-1.5 pr-6">
        <h3 className="text-sm font-semibold text-card-foreground leading-snug">{skill.name}</h3>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
          {skill.difficulty}
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-card-foreground leading-tight truncate">
            {skill.name}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {skill.category ?? "Skill"}
          </p>
        </div>

        {/* Line count (from bundled JSON) OR difficulty badge (legacy) */}
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
            <span key={t}
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
<<<<<<< HEAD
=======

interface SkillModalProps {
  skill: Skill;
  onClose: () => void;
}

export function SkillModal({ skill, onClose }: SkillModalProps) {
  const [copied, setCopied] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

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
        const stripped = text.replace(/^---[\s\S]*?---\n*/, "");
        setMarkdown(stripped);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [skill.githubPath]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleCopy = async () => {
    const textToCopy = markdown ?? skill.promptPreview;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = useCallback(async (format: "md" | "txt" | "pdf") => {
    const content = markdown ?? skill.promptPreview;
    setDownloading(format);
    try {
      let filename: string;
      if (format === "md") filename = downloadMarkdown(skill.name, content);
      else if (format === "txt") filename = downloadText(skill.name, content);
      else filename = await downloadPdf(skill.name, content);
      toast.success(`✓ ${filename} downloaded successfully`);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }, [markdown, skill.name, skill.promptPreview]);

  const githubUrl = `https://github.com/kalilurrahman/kr-claudiator-skills/blob/main/${skill.githubPath}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-xl animate-slide-up md:animate-fade-in max-h-[90vh] flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-card-foreground truncate">{skill.name}</h2>
            <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>
              {skill.difficulty}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg focus-ring">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0 custom-scrollbar">
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
              <div className="mt-1.5 p-4 bg-muted/50 rounded-xl border border-border/50">
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
          </div>
        </ScrollArea>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 bg-card border-t border-border p-3 rounded-b-2xl z-10 download-buttons">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-ring"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => handleDownload("md")}
              disabled={downloading === "md"}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-[11px] font-semibold text-primary transition-all hover:bg-primary/10 focus-ring disabled:opacity-50"
            >
              {downloading === "md" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              .MD
            </button>
            <button
              onClick={() => handleDownload("pdf")}
              disabled={downloading === "pdf"}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-[11px] font-semibold text-primary transition-all hover:bg-primary/10 focus-ring disabled:opacity-50"
            >
              {downloading === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
              .PDF
            </button>
            <button
              onClick={() => handleDownload("txt")}
              disabled={downloading === "txt"}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-[11px] font-semibold text-primary transition-all hover:bg-primary/10 focus-ring disabled:opacity-50"
            >
              {downloading === "txt" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              .TXT
            </button>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-all hover:text-primary hover:border-primary/40 focus-ring"
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
