import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeId =
  | "kr-gold"
  | "kr-financial-slate"
  | "kr-forest"
  | "kr-sunset"
  | "kr-mono"
  | "terminal"
  | "matrix"
  | "arctic"
  | "crimson"
  | "slate";

export type FontId = "kr" | "system" | "serif" | "mono" | "editorial";
export type Mode = "dark" | "light";

export interface Theme {
  id: ThemeId;
  label: string;
  emoji: string;
  description: string;
  isDark: boolean;
}

export interface FontOption {
  id: FontId;
  label: string;
  description: string;
  stack: string;
}

export const THEMES: Theme[] = [
  { id: "kr-gold",            label: "KR Gold",            emoji: "🥇", description: "Gold on midnight — KR default",  isDark: true  },
  { id: "kr-financial-slate", label: "KR Slate",           emoji: "🟦", description: "Cool blue executive",            isDark: true  },
  { id: "kr-forest",          label: "KR Forest",          emoji: "🌲", description: "Emerald terminal",                isDark: true  },
  { id: "kr-sunset",          label: "KR Sunset",          emoji: "🌅", description: "Warm orange dusk",                isDark: true  },
  { id: "kr-mono",            label: "KR Mono",            emoji: "◾", description: "Pure monochrome",                 isDark: true  },
  { id: "terminal",           label: "Bloomberg Terminal", emoji: "🟡", description: "Dark amber — the classic",        isDark: true  },
  { id: "matrix",             label: "Midnight Matrix",    emoji: "🟢", description: "Neon green on black",             isDark: true  },
  { id: "crimson",            label: "Crimson",            emoji: "🔴", description: "Executive dark red",              isDark: true  },
  { id: "slate",              label: "GitHub Slate",       emoji: "⚫", description: "Neutral developer dark",          isDark: true  },
  { id: "arctic",             label: "Arctic",             emoji: "🔵", description: "Clean light — blue & white",      isDark: false },
];

export const FONTS: FontOption[] = [
  { id: "kr",        label: "KR Tools",      description: "DM Sans + Cormorant heads",     stack: "'DM Sans', system-ui, sans-serif" },
  { id: "system",    label: "System Sans",   description: "Inter / system UI",             stack: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: "serif",     label: "Editorial",     description: "Cormorant Garamond serif",      stack: "'Cormorant Garamond', Georgia, serif" },
  { id: "editorial", label: "Playfair",      description: "Playfair Display elegance",     stack: "'Playfair Display', Georgia, serif" },
  { id: "mono",      label: "Terminal Mono", description: "JetBrains Mono — code style",   stack: "'JetBrains Mono', Menlo, Consolas, monospace" },
];

const STORAGE_KEY = "claudiator_theme";
const FONT_STORAGE_KEY = "claudiator_font";

const DARK_DEFAULT: ThemeId = "kr-gold";
const LIGHT_DEFAULT: ThemeId = "arctic";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: ThemeId) => void;
  themes: Theme[];
  font: FontOption;
  setFont: (id: FontId) => void;
  fonts: FontOption[];
  mode: Mode;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
  /** Legacy alias for compatibility with old useTheme hook */
  isDark: boolean;
  /** Legacy alias for toggleMode */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.find((t) => t.id === stored)) return stored as ThemeId;
      if (stored === "light") return LIGHT_DEFAULT;
    } catch { /* ignore */ }
    return DARK_DEFAULT;
  });

  const [fontId, setFontId] = useState<FontId>(() => {
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY) as FontId | null;
      if (stored && FONTS.find((f) => f.id === stored)) return stored;
    } catch { /* ignore */ }
    return "kr";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", themeId);
    const isDark = THEMES.find((t) => t.id === themeId)?.isDark ?? true;
    root.style.colorScheme = isDark ? "dark" : "light";
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
  }, [themeId]);

  useEffect(() => {
    const f = FONTS.find((x) => x.id === fontId) ?? FONTS[0];
    document.documentElement.style.setProperty("--font-app", f.stack);
    document.documentElement.setAttribute("data-font", fontId);
  }, [fontId]);

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const setFont = (id: FontId) => {
    setFontId(id);
    try { localStorage.setItem(FONT_STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
  const mode: Mode = theme.isDark ? "dark" : "light";

  const setMode = (m: Mode) => {
    if (m === mode) return;
    const isKr = themeId.startsWith("kr-");
    const candidates = THEMES.filter((t) => t.isDark === (m === "dark"));
    const krMatch = candidates.find((t) => t.id.startsWith("kr-"));
    const next =
      m === "dark" && isKr && krMatch ? krMatch.id :
      m === "dark" ? DARK_DEFAULT : LIGHT_DEFAULT;
    setTheme(next);
  };

  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{
        theme, setTheme, themes: THEMES,
        font, setFont, fonts: FONTS,
        mode, toggleMode, setMode,
        isDark: mode === "dark",
        toggle: toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
