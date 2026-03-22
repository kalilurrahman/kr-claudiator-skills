import type { Category } from "@/types/skills.types";

interface CategoryNavProps {
  categories: Category[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  return (
    <nav className="space-y-1">
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
          {cat.label}
        </div>
      ))}
    </nav>
  );
}
