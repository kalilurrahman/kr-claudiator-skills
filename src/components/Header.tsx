import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ExternalLink, Home, Search, MessageSquare, Info, Moon, Sun, Heart } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export function Header() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });
  const [favouriteCount, setFavouriteCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("claudiator_theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem("claudiator_favourites") || "[]");
    setFavouriteCount(favs.length);

    const handler = () => {
      const f = JSON.parse(localStorage.getItem("claudiator_favourites") || "[]");
      setFavouriteCount(f.length);
    };
    window.addEventListener("favourites-updated", handler);
    return () => window.removeEventListener("favourites-updated", handler);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("claudiator_theme", next ? "dark" : "light");
  };

  const navLinks = [
    { label: "Home", to: "/", icon: Home },
    { label: "Skills Library", to: "/skills", icon: Search },
    { label: "Favourites", to: "/favourites", icon: Heart, badge: favouriteCount },
    { label: "About", to: "/about", icon: Info },
    { label: "Feedback", to: "/feedback", icon: MessageSquare },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-primary/10">
      <div className="container max-w-6xl mx-auto px-4 flex items-center justify-between h-14 md:h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 gradient-hero flex items-center justify-center rounded-lg">
            <span className="font-sans text-xs text-primary-foreground font-bold tracking-tight">KR</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gradient-brand hidden sm:block">KR Claudiator Skills</span>
            <span className="text-[9px] text-muted-foreground tracking-wide hidden md:block">AI Prompt Engineering for Enterprise Teams</span>
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors focus-ring"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
