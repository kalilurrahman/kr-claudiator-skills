import { Link, useLocation } from "react-router-dom";
import { Home, Search, Github, ExternalLink } from "lucide-react";

interface MobileBottomNavProps {
  onSearchFocus?: () => void;
}

export function MobileBottomNav({ onSearchFocus }: MobileBottomNavProps) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-14">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded transition-colors ${
            location.pathname === "/" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px]">Home</span>
        </Link>
        <Link
          to="/skills"
          className={`flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded transition-colors ${
            location.pathname === "/skills" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px]">Browse</span>
        </Link>
        <button
          onClick={onSearchFocus}
          className="flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded text-muted-foreground hover:text-primary transition-colors"
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px]">Search</span>
        </button>
        <a
          href="https://github.com/kalilurrahman/kr-claudiator-skills"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded text-muted-foreground hover:text-primary transition-colors"
        >
          <Github className="w-5 h-5" />
          <span className="text-[9px]">GitHub</span>
        </a>
      </div>
    </nav>
  );
}
