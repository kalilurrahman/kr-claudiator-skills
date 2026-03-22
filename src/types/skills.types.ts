export interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  useCase: string;
  promptPreview: string;
  githubPath: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  dataFile: string;
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
