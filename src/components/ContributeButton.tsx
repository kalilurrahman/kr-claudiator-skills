import { useState } from "react";
import { Github, X, GitPullRequest } from "lucide-react";

export function ContributeButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-semibold transition-colors ${
          compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[11px]"
        }`}
      >
        <GitPullRequest className="w-3.5 h-3.5" />
        Contribute
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 animate-fade-in">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Github className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-foreground">
                Contribute a Skill
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Submit your own <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-primary">SKILL.md</code> to the library.
            </p>
            <ol className="text-sm text-foreground/85 space-y-1.5 mb-5 list-decimal pl-5">
              <li>Fork the repository</li>
              <li>Add your skill under the right category</li>
              <li>Open a pull request</li>
            </ol>
            <a
              href="https://github.com/kalilurrahman/kr-claudiator-skills"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg gradient-hero px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow glow-on-hover transition-all no-underline"
            >
              <Github className="w-4 h-4" />
              Open on GitHub
            </a>
          </div>
        </div>
      )}
    </>
  );
}
