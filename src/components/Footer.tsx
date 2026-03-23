import { ExternalLink, Github, Linkedin, Globe } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-primary/10 bg-card/50">
      <div className="container max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1: App info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 gradient-hero flex items-center justify-center rounded-lg">
                <span className="font-sans text-[10px] text-primary-foreground font-bold">KR</span>
              </div>
              <span className="text-sm font-bold text-gradient-brand">KR Claudiator Skills</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI Prompt Engineering for Enterprise Teams. Curated productivity skills for Claude Code and Claude CoWork.
            </p>
          </div>

          {/* Column 2: Quick links */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-3">Quick links</h3>
            <div className="space-y-2">
              {[
                { label: "Home", to: "/" },
                { label: "Skills Library", to: "/skills" },
                { label: "Favourites", to: "/favourites" },
                { label: "Feedback", to: "/feedback" },
                { label: "About", to: "/about" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://github.com/kalilurrahman/kr-claudiator-skills"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Column 3: Creator credit */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-3">
              Built &amp; shared for free by
            </h3>
            <a
              href="https://kalilurrahman.lovable.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:text-accent transition-colors"
            >
              Kalilur Rahman
            </a>
            <p className="text-[10px] text-muted-foreground mt-1">
              Global IT Executive · AI Thought Leader · Kaggle Legacy Grandmaster
            </p>
            <div className="flex items-center gap-3 mt-3">
              <a
                href="https://www.linkedin.com/in/kalilurrahman/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/kalilurrahman"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://www.thinkers360.com/tl/kalilurrahman"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Thinkers360"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-muted-foreground">
              © 2026 Kalilur Rahman. All rights reserved. | AI outcomes are at owner's risk.
            </p>
            <p className="text-[10px] text-muted-foreground/60 max-w-md text-center md:text-right">
              ⚠️ These AI prompts are provided for guidance only. Outcomes are entirely at the user's own risk.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
