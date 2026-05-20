import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, X, SlidersHorizontal } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SeoHead } from "@/components/SeoHead";
import { CategoryNav } from "@/components/CategoryNav";
import { SkillCard } from "@/components/SkillCard";
import { SkillModal } from "@/components/SkillModal";
import { SkillsProgressBar } from "@/components/SkillsProgressBar";
import { GitHubBanner } from "@/components/GitHubBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SkeletonGrid } from "@/components/SkeletonCard";
import type { Skill, Category, SkillsIndex, BundledData } from "@/types/skills.types";

// ─── Data mode detection ─────────────────────────────────────────────────────
const BUNDLED_URL = "/data/skills-data.json";
const INDEX_URL = "/data/skills-index.json";

function buildCategoriesFromBundled(data: BundledData): Category[] {
  return data.categories.map((cat) => ({
    id: cat.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label: cat,
    icon: "Zap",
    dataFile: "",
    count: data.skills.filter((s) => s.category === cat).length,
  }));
}

function buildIndexFromBundled(data: BundledData, cats: Category[]): SkillsIndex {
  return {
    version: data.version,
    totalSkills: data.totalSkills,
    targetSkills: 500,
    lastUpdated: new Date().toISOString().split("T")[0],
    categories: cats,
  };
}

// ──────────────────────────────────────────────────────────────────────────────

export function SkillsBrowser() {
  const [searchParams] = useSearchParams();

  const [index, setIndex] = useState<SkillsIndex | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [categoryCache, setCategoryCache] = useState<Record<string, Skill[]>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dataMode, setDataMode] = useState<"bundled" | "split" | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toolFilter, setToolFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(BUNDLED_URL)
      .then((r) => {
        if (!r.ok) throw new Error("No bundled data");
        return r.json() as Promise<BundledData>;
      })
      .then((data) => {
        const cats = buildCategoriesFromBundled(data);
        const idx = buildIndexFromBundled(data, cats);
        setIndex(idx);
        setAllSkills(data.skills);
        setDataMode("bundled");

        const cache: Record<string, Skill[]> = {};
        cats.forEach((cat) => {
          cache[cat.id] = data.skills.filter((s) => s.category === cat.label);
        });
        setCategoryCache(cache);

        const catParam = searchParams.get("category");
        const match = cats.find((c) => c.id === catParam);
        setActiveCategory(match?.id ?? cats[0]?.id ?? null);
        setLoading(false);
      })
      .catch(() => {
        fetch(INDEX_URL)
          .then((r) => r.json())
          .then((idx: SkillsIndex) => {
            setIndex(idx);
            setDataMode("split");
            const catParam = searchParams.get("category");
            const match = idx.categories.find((c) => c.id === catParam);
            const init = match?.id ?? idx.categories[0]?.id ?? null;
            if (init) fetchSplitCategory(init, idx);
            setLoading(false);
          });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch single category (legacy split mode) ────────────────────────────
  const fetchSplitCategory = useCallback(
    (id: string, idx?: SkillsIndex) => {
      setActiveCategory(id);
      const source = idx ?? index;
      if (!source) return;
      if (categoryCache[id]) return;
      const cat = source.categories.find((c) => c.id === id);
      if (!cat?.dataFile) return;
      setLoading(true);
      fetch(cat.dataFile)
        .then((r) => r.json())
        .then((d: { skills: Skill[] }) => {
          setCategoryCache((prev) => ({ ...prev, [id]: d.skills }));
          setAllSkills((prev) => {
            const existing = new Set(prev.map((s) => s.id));
            return [...prev, ...d.skills.filter((s) => !existing.has(s.id))];
          });
        })
        .finally(() => setLoading(false));
    },
    [index, categoryCache]
  );

  const handleSelectCategory = useCallback(
    (id: string) => {
      if (dataMode === "bundled") {
        setActiveCategory(id);
        setSearchQuery("");
      } else {
        fetchSplitCategory(id);
        setSearchQuery("");
      }
    },
    [dataMode, fetchSplitCategory]
  );

  const handleSearchFocus = () => {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Keyboard: "/" focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const allTools = useMemo(() => {
    const tools = new Set<string>();
    allSkills.forEach((s) => {
      s.allowedTools?.split(",").forEach((t) => tools.add(t.trim()));
      s.tags?.forEach((t) => tools.add(t));
    });
    return [...tools].filter(Boolean).sort();
  }, [allSkills]);

  const displaySkills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let base: Skill[];
    if (q) {
      base = allSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.category?.toLowerCase().includes(q) ||
          s.argumentHint?.toLowerCase().includes(q)
      );
    } else if (activeCategory) {
      base = categoryCache[activeCategory] ?? [];
    } else {
      base = [];
    }

    if (toolFilter.length > 0) {
      base = base.filter((s) =>
        toolFilter.every(
          (f) => s.allowedTools?.includes(f) || s.tags?.includes(f)
        )
      );
    }

    return base;
  }, [searchQuery, activeCategory, categoryCache, allSkills, toolFilter]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <SeoHead
        title="Browse Claude Skills Library | Claudiator"
        description="Search and filter 434+ Claude Skills across 12 engineering domains. Copy SKILL.md prompts in one click."
        canonical="https://kr-claudiator-skills.lovable.app/skills"
      />
      <Header />

      <main className="flex-1 pt-12 pb-16 md:pb-0">
        <div className="container max-w-6xl mx-auto px-4 py-6 animate-fade-in">
          <header className="mb-5">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Browse Claude Skills Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search, filter, and copy SKILL.md prompts across {index?.categories.length ?? 9} engineering domains.
            </p>
          </header>

          {/* Progress bar */}
          {index && (
            <div className="mb-5">
              <SkillsProgressBar current={index.totalSkills} target={index.targetSkills} />
            </div>
          )}

          {/* Search + filter row */}
          <div className="mb-5 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder='Search skills… Press "/" to focus'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {allTools.length > 0 && (
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  filterOpen || toolFilter.length > 0
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {toolFilter.length > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                    {toolFilter.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Tool filter chips */}
          {filterOpen && allTools.length > 0 && (
            <div className="mb-4 p-3 bg-card border border-border rounded-lg">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Filter by tool / tag
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTools.map((tool) => (
                  <button
                    key={tool}
                    onClick={() =>
                      setToolFilter((prev) =>
                        prev.includes(tool)
                          ? prev.filter((t) => t !== tool)
                          : [...prev, tool]
                      )
                    }
                    className={`font-mono text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                      toolFilter.includes(tool)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {tool}
                  </button>
                ))}
                {toolFilter.length > 0 && (
                  <button
                    onClick={() => setToolFilter([])}
                    className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="mb-5 text-[10px] text-muted-foreground">
            {searchQuery
              ? `Search covers all ${allSkills.length} loaded skills.`
              : dataMode === "split"
              ? "Search covers loaded categories only. Click a category to load more."
              : `${allSkills.length} skills loaded across ${index?.categories.length ?? 0} categories.`}
          </p>

          <div className="flex flex-col md:flex-row gap-5">
            {/* Desktop sidebar */}
            {index && (
              <aside className="hidden md:block w-64 shrink-0">
                <div className="sticky top-16">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold block mb-2 px-3">
                    Categories
                  </span>
                  <CategoryNav
                    categories={index.categories}
                    activeId={activeCategory}
                    loadedIds={new Set(Object.keys(categoryCache))}
                    onSelect={handleSelectCategory}
                    useEmoji={true}
                  />
                </div>
              </aside>
            )}

            {/* Mobile tab strip */}
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
                      {cat.count != null && (
                        <span className="ml-1 opacity-60 text-[9px]">{cat.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skill grid */}
            <div className="flex-1">
              {/* Grid header */}
              {displaySkills.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-foreground">
                    {searchQuery
                      ? `"${searchQuery}"`
                      : index?.categories.find((c) => c.id === activeCategory)?.label ?? "All Skills"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {displaySkills.length} skill{displaySkills.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {loading ? (
                <SkeletonGrid />
              ) : displaySkills.length > 0 ? (
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
                <div className="text-center py-20">
                  <p className="text-2xl mb-3">
                    {searchQuery ? "🔍" : "📂"}
                  </p>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {searchQuery ? "No skills match" : "Select a category"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery
                      ? "Try different keywords or clear the search"
                      : "Choose a category from the sidebar to browse skills."}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-primary hover:text-accent transition-colors"
                    >
                      Clear filters →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {index && <GitHubBanner lastUpdated={index.lastUpdated} />}
      </main>

      <Footer />

      <MobileBottomNav onSearchFocus={handleSearchFocus} />

      {selectedSkill && (
        <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
