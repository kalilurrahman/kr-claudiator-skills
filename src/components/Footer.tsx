import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="container max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          © 2026 Kalilur Rahman. Open Source. Built for the Claude Community.
        </p>
        <div className="flex flex-wrap items-center gap-4 justify-center">
          <a
            href="https://kalilur-portfolio.lovable.app"
            className="text-xs font-medium text-primary hover:text-accent transition-colors"
          >
            All KR apps →
          </a>
          <span className="text-muted-foreground opacity-50 hidden md:inline">|</span>
          <a
            href="https://github.com/kalilurrahman/kr-claudiator-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href="https://www.linkedin.com/in/kalilurrahman/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            LinkedIn
          </a>
          <a
            href="https://kalilurrahman.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Portfolio
          </a>
        </div>
      </div>
    </footer>
  );
}
