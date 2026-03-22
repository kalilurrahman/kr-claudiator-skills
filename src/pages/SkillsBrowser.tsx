import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CategoryNav } from "@/components/CategoryNav";
import { SkillCard, SkillModal } from "@/components/SkillCard";
import { SkillsProgressBar } from "@/components/SkillsProgressBar";
import { GitHubBanner } from "@/components/GitHubBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import type { SkillsIndex, Skill, CategoryData } from "@/types/skills.types";

export function SkillsBrowser() {
  const [searchParams] = useSearchParams();
  const [index, setIndex] = useState<SkillsIndex | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryCache, setCategoryCache] = useState<Record<string, CategoryData>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load index
  useEffect(() => {
    fetch("/data/skills-index.json")
      .then((r) => r.json())
      .then((d: SkillsIndex) => {
        setIndex(d);
        const catParam = searchParams.get("category");
        const initial = catParam && d.categories.some((c) => c.id === catParam)
          ? catParam
          : d.categories[0]?.id ?? null;
        if (initial) handleSelectCategory(initial, d);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCategory = useCallback(
    (id: string, indexData?: SkillsIndex) => {
      setActiveCategory(id);
      const idx = indexData ?? index;
      if (!idx) return;

      // Don't re-fetch if already cached
      if (categoryCache[id]) return;

      const cat = idx.categories.find((c) => c.id === id);
      if (!cat) return;

      fetch(cat.dataFile)
        .then((r) => r.json())
        .then((data: CategoryData) => {
          setCategoryCache((prev) => ({ ...prev, [id]: data }));
        });
    },
    [index, categoryCache]
  );

  const handleSearchFocus = () => {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Gather all loaded skills for search
  const allLoadedSkills = Object.values(categoryCache).flatMap((c) => c.skills);

  // Filter
  const q = searchQuery.toLowerCase().trim();
  const displaySkills = q
    ? allLoadedSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      )
    : activeCategory && categoryCache[activeCategory]
    ? categoryCache[activeCategory].skills
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-12 pb-16 md:pb-0">
        <div className="container max-w-6xl mx-auto px-4 py-6 animate-fade-in">
          {/* Progress bar */}
          {index && (
            <div className="mb-5">
              <SkillsProgressBar current={index.totalSkills} target={index.targetSkills} />
            </div>
          )}

          {/* Search */}
          <div className="mb-5">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search skills by name, description, or tag…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Search covers loaded categories only. Click a category to load more.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            {/* Sidebar — desktop */}
            {index && (
              <aside className="hidden md:block w-56 shrink-0">
                <div className="sticky top-16">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold block mb-2 px-3">Categories</span>
                  <CategoryNav
                    categories={index.categories}
                    activeId={activeCategory}
                    loadedIds={new Set(Object.keys(categoryCache))}
                    onSelect={(id) => handleSelectCategory(id)}
                  />
                </div>
              </aside>
            )}

            {/* Tab strip — mobile */}
            {index && (
              <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-2">
                <div className="flex gap-1.5 min-w-max">
                  {index.categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors border ${
                        activeCategory === cat.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skill grid */}
            <div className="flex-1">
              {displaySkills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displaySkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onClick={() => setSelectedSkill(skill)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground">
                    {q
                      ? "No skills match your search. Skills grow over time — check back soon!"
                      : "Select a category to browse skills."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GitHub banner */}
        {index && <GitHubBanner lastUpdated={index.lastUpdated} />}
      </main>
      <Footer />

      {/* Mobile bottom nav */}
      <MobileBottomNav onSearchFocus={handleSearchFocus} />

      {/* Modal */}
      {selectedSkill && (
        <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
