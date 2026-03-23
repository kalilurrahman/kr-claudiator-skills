import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check, ExternalLink, Loader2, Code2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Skill } from "@/types/skills.types";
import { getCategoryMeta } from "@/data/categoryMeta";

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/kalilurrahman/kr-claudiator-skills/main";

const difficultyStyles: Record<string, string> = {
  beginner:     "bg-success/15 text-success border-success/30",
  intermediate: "bg-warning/15 text-warning border-warning/30",
  advanced:     "bg-destructive/15 text-destructive border-destructive/30",
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-lg border
        bg-card text-card-foreground text-xs font-mono shadow-xl transition-all duration-200
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
      style={{ borderColor: "var(--success)" }}
    >
      <Check className="w-3.5 h-3.5 text-success" />
      {message}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
interface CopyBtnProps {
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onCopy: () => string | undefined;
  onDone: (label: string) => void;
}

function CopyBtn({ label, icon, variant = "secondary", onCopy, onDone }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const text = onCopy();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    onDone(label);
    setTimeout(() => setCopied(false), 2000);
  };

  const base = "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold transition-all focus-ring whitespace-nowrap";
  const styles = {
    primary:   `${base} bg-primary text-primary-foreground hover:bg-primary/90`,
    secondary: `${base} border border-primary/40 text-primary hover:bg-primary/10`,
    ghost:     `${base} border border-border text-muted-foreground hover:text-foreground hover:border-border/80`,
  };

  return (
    <button onClick={handleClick} className={styles[variant]}>
      {copied ? <Check className="w-3 h-3" /> : icon}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface SkillModalProps {
  skill: Skill;
  onClose: () => void;
}

export function SkillModal({ skill, onClose }: SkillModalProps) {
  const [markdown, setMarkdown] = useState<string | null>(skill.content ?? null);
  const [loading, setLoading] = useState(!skill.content);
  const [error, setError] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const meta = getCategoryMeta(skill.category);

  // Fetch from GitHub only if embedded content is unavailable
  useEffect(() => {
    if (skill.content) {
      // Strip YAML frontmatter for display
      setMarkdown(skill.content.replace(/^---[\s\S]*?---\n*/, ""));
      setLoading(false);
      return;
    }
    if (!skill.githubPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`${GITHUB_RAW_BASE}/${skill.githubPath}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.text();
      })
      .then((text) => setMarkdown(text.replace(/^---[\s\S]*?---\n*/, "")))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [skill.content, skill.githubPath]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const showToast = useCallback((label: string) => {
    setToastMsg(`✓ ${label} copied`);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ── Copy helpers ──
  const getFullContent = () => skill.content ?? markdown ?? skill.promptPreview ?? undefined;

  const getClaudeToolSnippet = () => {
    const slug = skill.categorySlug ?? "skills";
    const name = skill.name;
    return `<skill>\n<n>${name}</n>\n<description>${skill.description}</description>\n<location>/mnt/skills/${slug}/${name}/SKILL.md</location>\n</skill>`;
  };

  const getFrontmatter = () => {
    const raw = skill.content ?? "";
    const m = raw.match(/^(---[\s\S]*?---)/);
    return m?.[1] ?? undefined;
  };

  const tools = skill.allowedTools
    ? skill.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const hint = skill.argumentHint?.replace(/^\[|\]$/g, "");
  const githubUrl = skill.githubPath
    ? `https://github.com/kalilurrahman/kr-claudiator-skills/blob/main/${skill.githubPath}`
    : `https://github.com/kalilurrahman/kr-claudiator-skills`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full sm:max-w-2xl bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh]">

          {/* Header */}
          <div className="shrink-0 bg-card border-b border-border p-3 sm:p-4 flex items-start gap-3 rounded-t-2xl">
            <span
              className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-xl flex items-center justify-center text-xl sm:text-2xl"
              style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
            >
              {meta.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-mono font-semibold text-card-foreground">{skill.name}</h2>
                {skill.difficulty && (
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${difficultyStyles[skill.difficulty]}`}>{skill.difficulty}</span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md shrink-0" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Meta pills */}
          <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-border flex flex-wrap gap-1.5">
            {skill.category && <Pill label="category" value={skill.category} dot={meta.dot} />}
            {skill.lines != null && <Pill label="lines" value={String(skill.lines)} green />}
            {tools.map((t) => <Pill key={t} label="tool" value={t} />)}
            {hint && <Pill label="args" value={hint} />}
            {skill.useCase && <Pill label="use case" value={skill.useCase} />}
          </div>

          {/* Action buttons */}
          <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-border flex flex-wrap gap-1.5">
            <CopyBtn label="Copy Full Skill" icon={<Copy className="w-3 h-3" />} variant="primary" onCopy={getFullContent} onDone={showToast} />
            <CopyBtn label="Claude Tool" icon={<Code2 className="w-3 h-3" />} variant="secondary" onCopy={getClaudeToolSnippet} onDone={showToast} />
            {skill.content && <CopyBtn label="Frontmatter" icon={<FileText className="w-3 h-3" />} variant="ghost" onCopy={getFrontmatter} onDone={showToast} />}
            <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all">
              <ExternalLink className="w-3 h-3" /> GitHub
            </a>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-4 sm:p-5 pb-8">
              {loading && (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Loading skill…</span>
                </div>
              )}
              {error && (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">Could not load from GitHub.</p>
                  {skill.promptPreview && (
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{skill.promptPreview}</pre>
                  )}
                </div>
              )}
              {markdown && (
                <div className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:text-foreground prose-headings:font-semibold
                  prose-p:text-foreground/85 prose-p:leading-relaxed
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-card prose-pre:border prose-pre:border-border/50 prose-pre:text-xs prose-pre:rounded-lg prose-pre:overflow-x-auto
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-li:text-foreground/85
                  prose-table:text-xs prose-th:text-foreground/90 prose-th:font-semibold prose-td:text-foreground/75
                  prose-th:border-border prose-td:border-border
                  prose-blockquote:border-primary prose-blockquote:text-muted-foreground
                  prose-hr:border-border
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}

// ─── Pill component ───────────────────────────────────────────────────────────
function Pill({
  label, value, dot, green,
}: {
  label: string; value: string; dot?: string; green?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] bg-muted border border-border rounded px-2 py-0.5">
      <span className="text-muted-foreground/60">{label}</span>
      <span
        style={dot ? { color: dot } : undefined}
        className={!dot ? (green ? "text-success" : "text-foreground/90") : undefined}
      >
        {value}
      </span>
    </span>
  );
}
