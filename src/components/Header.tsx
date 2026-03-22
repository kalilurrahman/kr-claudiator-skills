import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-hero text-primary-foreground font-bold text-sm">
            KR
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight">Claudiator</span>
            <span className="text-xs text-muted-foreground leading-tight hidden sm:block">Claude Skills Generator</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/skills">Browse Skills</Link>
          </Button>
          <Button variant="ghost" asChild>
            <a href="https://github.com/kalilurrahman/kr-claudiator-skills" target="_blank" rel="noopener noreferrer">
              GitHub <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </nav>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container flex flex-col gap-1 py-4">
            <Button variant="ghost" className="justify-start" asChild onClick={() => setMobileOpen(false)}>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild onClick={() => setMobileOpen(false)}>
              <Link to="/skills">Browse Skills</Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <a href="https://github.com/kalilurrahman/kr-claudiator-skills" target="_blank" rel="noopener noreferrer">
                GitHub <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
