import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // P2-A: this site now only serves the redirect page in index.html (moved to the KR Library).
  // public/ is kept in the repo but no longer published; redirect-public/ holds robots.txt,
  // favicon.ico and a sw.js that removes the old offline cache
  // (the vite-plugin-pwa service worker is no longer generated).
  publicDir: "redirect-public",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
