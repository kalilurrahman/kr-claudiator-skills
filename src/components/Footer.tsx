import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="font-semibold text-primary-foreground mb-3">About</h3>
            <p className="text-sm leading-relaxed">
              Claudiator is an open-source directory of productivity skills for Claude Code and Claude CoWork, organised by domain.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-primary-foreground mb-3">Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/kalilurrahman/kr-claudiator-skills" target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground transition-colors inline-flex items-center gap-1">
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="https://kalilurrahman.lovable.app" target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground transition-colors inline-flex items-center gap-1">
                  Portfolio <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/in/kalilurrahman" target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground transition-colors inline-flex items-center gap-1">
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-primary-foreground mb-3">Legal</h3>
            <p className="text-sm">Open source under MIT licence. Use freely.</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-footer-foreground/20 text-center text-xs">
          © 2026 Kalilur Rahman. Open Source. Built for the Claude Community.
        </div>
      </div>
    </footer>
  );
}
