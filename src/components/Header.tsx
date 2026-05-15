import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ExternalLink, Home, Search, MessageSquare, Info, Moon, Sun, Heart, Download } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/useTheme";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function Header() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [favouriteCount, setFavouriteCount] = useState(0);
  const location = useLocation();
  const { isDark, toggle } = useTheme();
  const { canInstall, install } = usePwaInstall();

  useEffect(() => {
    const update = () => {
      const favs = JSON.parse(localStorage.getItem("claudiator_favourites") || "[]");
      setFavouriteCount(favs.length);
    };
    update();
    window.addEventListener("favourites-updated", update);
    return () => window.removeEventListener("favourites-updated", update);
  }, []);

  const navLinks = [
    { label: "Home", to: "/", icon: Home },
    { label: "Skills Library", to: "/skills", icon: Search },
    { label: "Favourites", to: "/favourites", icon: Heart, badge: favouriteCount },
    { label: "About", to: "/about", icon: Info },
    { label: "Feedback", to: "/feedback", icon: MessageSquare },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container max-w-6xl mx-auto px-4 flex items-center justify-between h-12">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-full bg-card border border-primary/40 flex items-center justify-center hover:border-primary transition-colors">
            <span className="font-display text-sm text-primary font-bold tracking-tight">KR</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base font-bold text-foreground hidden sm:block">Claudiator</span>
            <span className="text-[9px] text-muted-foreground tracking-[0.18em] uppercase hidden md:block">Claude Skills · by Kalilur Rahman</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-colors ${
                  active
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {item.badge ? (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <span className="w-px h-5 bg-border mx-1" />

          <a
            href="https://github.com/kalilurrahman/kr-claudiator-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] tracking-wide text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          >
            GitHub
            <ExternalLink className="w-3 h-3" />
          </a>

          {canInstall && (
            <>
              <span className="w-px h-4 bg-border mx-1" />
              <button
                onClick={install}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] tracking-wide text-primary bg-primary/10 hover:bg-primary/20 font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Install App
              </button>
            </>
          )}

          <span className="w-px h-4 bg-border mx-1" />

          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors focus-ring"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded focus-ring"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="p-2 text-foreground" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-6 space-y-5 overflow-y-auto h-full">
                <Link to="/" onClick={() => setSheetOpen(false)} className="flex items-center gap-2.5 no-underline">
                  <div className="w-8 h-8 gradient-hero flex items-center justify-center rounded-lg">
                    <span className="font-sans text-xs text-primary-foreground font-bold">KR</span>
                  </div>
                  <span className="text-sm font-bold text-gradient-brand">KR Claudiator Skills</span>
                </Link>

                <div className="h-px bg-border" />

                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Navigation</span>
                  {navLinks.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setSheetOpen(false)}
                        className={`flex items-center gap-3 py-2 px-2 rounded-lg text-sm transition-colors ${
                          active ? "text-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                        {item.badge ? (
                          <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>

                <div className="h-px bg-border" />

                {canInstall && (
                  <button
                    onClick={() => { install(); setSheetOpen(false); }}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg text-sm text-primary bg-primary/10 hover:bg-primary/20 font-medium transition-colors w-full"
                  >
                    <Download className="w-4 h-4" />
                    Install App
                  </button>
                )}

                <a
                  href="https://github.com/kalilurrahman/kr-claudiator-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-2 px-2 rounded-lg text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  GitHub
                  <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
