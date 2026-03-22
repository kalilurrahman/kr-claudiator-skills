import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ExternalLink, Home, Search, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export function Header() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Home", to: "/", icon: Home },
    { label: "Browse Skills", to: "/skills", icon: Search },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container max-w-6xl mx-auto px-4 flex items-center justify-between h-12">
        {/* Logo — matching portfolio KR monogram style */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 gradient-hero flex items-center justify-center rounded">
            <span className="font-serif text-xs text-primary-foreground font-semibold">KR</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground tracking-wide hidden sm:block">CLAUDIATOR</span>
            <span className="text-[9px] text-muted-foreground tracking-wide hidden md:block">Claude Skills Generator</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] tracking-wide uppercase transition-colors ${
                  active
                    ? "text-primary bg-primary/10 font-medium"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </Link>
            );
          })}

          <span className="w-px h-4 bg-border mx-1" />

          <a
            href="https://github.com/kalilurrahman/kr-claudiator-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] tracking-wide uppercase text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          >
            GitHub
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="p-1.5 text-foreground" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[260px] p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-5 space-y-4 overflow-y-auto h-full">
                <Link to="/" onClick={() => setSheetOpen(false)} className="flex items-center gap-2 no-underline">
                  <div className="w-7 h-7 gradient-hero flex items-center justify-center rounded">
                    <span className="font-serif text-xs text-primary-foreground font-semibold">KR</span>
                  </div>
                  <span className="text-xs font-medium text-foreground tracking-wide">CLAUDIATOR</span>
                </Link>

                <div className="h-px bg-border" />

                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Navigation</span>
                  {navLinks.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setSheetOpen(false)}
                        className={`flex items-center gap-2.5 py-1.5 text-sm transition-colors ${
                          active ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="h-px bg-border" />

                <a
                  href="https://github.com/kalilurrahman/kr-claudiator-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 py-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  GitHub
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
