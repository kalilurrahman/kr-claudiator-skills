import { Link, useLocation } from "react-router-dom";
import { Home, Search, Heart, Github } from "lucide-react";

interface MobileBottomNavProps {
  onSearchFocus?: () => void;
}

export function MobileBottomNav({ onSearchFocus }: MobileBottomNavProps) {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden">
      <div className="flex items-center justify-around h-14">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-colors ${
            location.pathname === "/" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px]">Home</span>
        </Link>
        <Link
          to="/skills"
          className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-colors ${
            location.pathname === "/skills" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px]">Skills</span>
        </Link>
        <Link
          to="/favourites"
          className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-colors ${
            location.pathname === "/favourites" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[9px]">Favs</span>
        </Link>
        <a
          href="https://github.com/kalilurrahman/kr-claudiator-skills"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg text-muted-foreground hover:text-primary transition-colors"
        >
          <Github className="w-5 h-5" />
          <span className="text-[9px]">GitHub</span>
        </a>
      </div>
    </nav>
  );
}
