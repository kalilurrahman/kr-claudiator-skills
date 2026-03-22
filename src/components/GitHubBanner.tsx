import { useState, useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

export function GitHubBanner({ lastUpdated }: { lastUpdated: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const v = localStorage.getItem("claudiator_banner_dismissed");
    if (!v) setDismissed(false);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("claudiator_banner_dismissed", "true");
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 md:bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg animate-slide-up">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground flex-1">
          📦 Skills source:{" "}
          <a
            href="https://github.com/kalilurrahman/kr-claudiator-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            github.com/kalilurrahman/kr-claudiator-skills
          </a>{" "}
          · Last synced: {lastUpdated} · ⭐ Star on GitHub
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://github.com/kalilurrahman/kr-claudiator-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium bg-primary text-primary-foreground rounded transition-colors hover:bg-primary/90"
          >
            View on GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded focus-ring"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
