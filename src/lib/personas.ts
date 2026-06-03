export interface Persona {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  tags: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "backend",
    emoji: "⚙️",
    title: "Backend Engineer",
    subtitle: "Your top 8 skills →",
    tags: ["api-design", "async-patterns", "database", "testing", "security"],
  },
  {
    id: "aiml",
    emoji: "🤖",
    title: "AI/ML Engineer",
    subtitle: "Your top 8 skills →",
    tags: ["model-serving", "mlops", "data-pipeline", "evaluation", "rag"],
  },
  {
    id: "pm",
    emoji: "🗺️",
    title: "Product Manager",
    subtitle: "Your top 8 skills →",
    tags: ["prd", "roadmap", "okr", "user-research", "go-to-market"],
  },
  {
    id: "devops",
    emoji: "🚀",
    title: "DevOps / Platform",
    subtitle: "Your top 8 skills →",
    tags: ["ci-cd", "kubernetes", "terraform", "monitoring", "incident"],
  },
];

export function getPersona(id: string | null | undefined): Persona | null {
  if (!id) return null;
  return PERSONAS.find((p) => p.id === id) ?? null;
}
