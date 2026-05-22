import { useEffect, useRef, useState } from "react";
import { Menu, X, Sun, Moon, Palette, Type, Check } from "lucide-react";
import { useTheme, type ThemeId, type FontId } from "@/contexts/ThemeContext";

interface Props {
  className?: string;
}

export function AppearanceMenu({ className = "" }: Props) {
  const { theme, setTheme, themes, font, setFont, fonts, mode, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Appearance"
        aria-label="Open appearance menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          open
            ? "border-primary/50 text-primary bg-secondary/60"
            : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
      >
        {open ? <X className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl animate-fade-in"
        >
          <div className="px-3 py-2.5 border-b border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mode</span>
              <button
                type="button"
                onClick={toggleMode}
                aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
                className="flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                {mode === "dark" ? (<><Moon className="h-3.5 w-3.5" />Dark</>) : (<><Sun className="h-3.5 w-3.5" />Light</>)}
              </button>
            </div>
          </div>

          <div className="border-b border-border/60">
            <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Palette className="h-3 w-3" />Theme
            </div>
            <div className="max-h-[260px] overflow-y-auto pb-1 custom-scrollbar">
              {themes.map((t) => {
                const active = t.id === theme.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as ThemeId)}
                    role="menuitemradio"
                    aria-checked={active}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                      active ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <span className="text-sm leading-none">{t.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{t.label}</span>
                      <span className="block text-[9px] text-muted-foreground/80 truncate">{t.description}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Type className="h-3 w-3" />Text style
            </div>
            <div className="pb-1">
              {fonts.map((f) => {
                const active = f.id === font.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f.id as FontId)}
                    role="menuitemradio"
                    aria-checked={active}
                    style={{ fontFamily: f.stack }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                      active ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{f.label}</span>
                      <span className="block text-[9px] text-muted-foreground/80 truncate">{f.description}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppearanceMenu;
