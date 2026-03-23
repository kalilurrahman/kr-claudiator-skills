// ─────────────────────────────────────────────────────────────────────────────
// Claudiator — Unified Skill type (v2)
// Supports both legacy split-JSON schema and the new bundled skills-data.json
// ─────────────────────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  description: string;

  // ── New fields (bundled skills-data.json) ──────────────────────────────────
  category?: string;           // "Software Development"
  categorySlug?: string;       // "01-software-dev"
  argumentHint?: string;       // "[resource names, operations needed, …]"
  allowedTools?: string;       // "Read, Write" | "Read, Write, Bash"
  content?: string;            // Full SKILL.md text (embedded — no GitHub fetch)
  lines?: number;              // Line count of the skill file

  // ── Legacy fields (split per-category JSON) ───────────────────────────────
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  useCase?: string;
  promptPreview?: string;
  githubPath?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Index / catalog types
// ─────────────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  label: string;
  icon: string;         // Lucide icon name (legacy) or emoji
  dataFile: string;     // Per-category JSON path (legacy split approach)
  count?: number;       // Total skills in this category
}

export interface SkillsIndex {
  version: string;
  totalSkills: number;
  targetSkills: number;
  lastUpdated: string;
  categories: Category[];
}

export interface CategoryData {
  categoryId: string;
  categoryLabel: string;
  skills: Skill[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundled JSON (skills-data.json) shape — produced by the data-build script
// ─────────────────────────────────────────────────────────────────────────────

export interface BundledData {
  version: string;
  totalSkills: number;
  categories: string[];
  skills: Skill[];
}
