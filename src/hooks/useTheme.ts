// Legacy shim — re-exports the multi-theme context API so existing
// imports continue to work (isDark / toggle) while new code can use
// the richer ThemeContext directly.
export { useTheme } from "@/contexts/ThemeContext";
