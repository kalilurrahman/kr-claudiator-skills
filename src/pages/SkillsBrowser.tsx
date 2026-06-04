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
import { PersonaFilterBanner } from "@/components/PersonaFilterBanner";
import { getPersona } from "@/lib/personas";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activePersona = searchParams.get("persona");
  const persona = getPersona(activePersona);
  const clearPersona = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("persona");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [index, setIndex] = useState<SkillsIndex | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [categoryCache, setCategoryCache] = useState<Record<string, Skill[]>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dataMode, setDataMode] = useState<"bundled" | "split" | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toolFilter, setToolFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [complexityFilter, setComplexityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "az" | "category">("newest");
  const [loading, setLoading] = useState(true);

  // Debounce search input (200ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);


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

  // ── Group / Product detection helpers ─────────────────────────────────────
  const CATEGORY_GROUPS: Record<string, RegExp> = {
    Engineering: /software|architect|system design|api|test/i,
    DevOps: /devops|infra|sre|deploy/i,
    Data: /data|analytics|database/i,
    Security: /security/i,
    Design: /design|ux|ui/i,
    Finance: /finance|fin/i,
    Career: /career|leadership|product management/i,
    Writing: /writing|documentation|content/i,
  };

  const skillProduct = (s: Skill): string => {
    const hay = `${s.tags?.join(" ") ?? ""} ${s.allowedTools ?? ""}`.toLowerCase();
    if (hay.includes("cowork") && hay.includes("claude code")) return "Both";
    if (hay.includes("cowork")) return "CoWork";
    if (hay.includes("claude code")) return "Claude Code";
    return "Both";
  };

  const skillGroup = (s: Skill): string[] => {
    const cat = s.category ?? "";
    return Object.entries(CATEGORY_GROUPS)
      .filter(([, re]) => re.test(cat))
      .map(([k]) => k);
  };

  const displaySkills = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();

    let base: Skill[];
    if (q) {
      base = allSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.displayName?.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.summary?.toLowerCase().includes(q) ||
          s.audience?.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.category?.toLowerCase().includes(q) ||
          s.argumentHint?.toLowerCase().includes(q) ||
          s.whenToUse?.some((t) => t.toLowerCase().includes(q)) ||
          s.outputs?.some((t) => t.toLowerCase().includes(q))
      );
    } else if (persona) {
      base = allSkills.filter((s) => {
        const hay = [
          s.category ?? "",
          s.categorySlug ?? "",
          s.name ?? "",
          (s.tags ?? []).join(" "),
          s.argumentHint ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return persona.tags.some((t) => hay.includes(t.toLowerCase()));
      });
    } else if (
      activeCategory &&
      productFilter.length === 0 &&
      groupFilter.length === 0 &&
      complexityFilter.length === 0
    ) {
      base = categoryCache[activeCategory] ?? [];
    } else if (productFilter.length || groupFilter.length || complexityFilter.length) {
      base = allSkills;
    } else {
      base = categoryCache[activeCategory ?? ""] ?? [];
    }

    if (toolFilter.length > 0) {
      base = base.filter((s) =>
        toolFilter.every(
          (f) => s.allowedTools?.includes(f) || s.tags?.includes(f)
        )
      );
    }
    if (productFilter.length > 0) {
      base = base.filter((s) => productFilter.includes(skillProduct(s)));
    }
    if (groupFilter.length > 0) {
      base = base.filter((s) => {
        const g = skillGroup(s);
        return groupFilter.some((f) => g.includes(f));
      });
    }
    if (complexityFilter.length > 0) {
      base = base.filter(
        (s) => s.difficulty && complexityFilter.includes(s.difficulty)
      );
    }

    const sorted = [...base];
    switch (sortBy) {
      case "az":
        sorted.sort((a, b) =>
          (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
        );
        break;
      case "category":
        sorted.sort((a, b) =>
          (a.category ?? "").localeCompare(b.category ?? "")
        );
        break;
      case "popular":
        sorted.sort((a, b) => (b.lines ?? 0) - (a.lines ?? 0));
        break;
      case "newest":
      default:
        // keep dataset order (newest appended last → reverse)
        sorted.reverse();
        break;
    }

    return sorted;
  }, [
    debouncedQuery,
    activeCategory,
    categoryCache,
    allSkills,
    toolFilter,
    productFilter,
    groupFilter,
    complexityFilter,
    sortBy,
    persona,
  ]);

  const totalLoaded = allSkills.length;
  const anyFilterActive =
    !!debouncedQuery ||
    toolFilter.length > 0 ||
    productFilter.length > 0 ||
    groupFilter.length > 0 ||
    complexityFilter.length > 0;

  const clearAllFilters = () => {
    setSearchQuery("");
    setToolFilter([]);
    setProductFilter([]);
    setGroupFilter([]);
    setComplexityFilter([]);
  };

  const toggleIn = (
    list: string[],
    setList: (v: string[]) => void,
    val: string
  ) => {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };



  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <SeoHead
        title="Browse Claude Skills Library | Claudiator"
        description="Search and filter 500+ Claude Skills across 12 engineering domains. Copy SKILL.md prompts in one click."
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

          {/* Sticky filter bar */}
          <div className="sticky top-12 z-40 -mx-4 px-4 py-3 mb-5 bg-background/85 backdrop-blur-md border-b border-border/60">
            {/* Search + filter toggle */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder='Search skills, descriptions, tags… Press "/" to focus'
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

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                aria-label="Sort skills"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="az">A–Z</option>
                <option value="category">Category</option>
              </select>

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
                  <span className="hidden sm:inline">Tools</span>
                  {toolFilter.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                      {toolFilter.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Filter chips: Claude Product / Category / Complexity */}
            <div className="space-y-2">
              <ChipGroup
                label="Product"
                options={["Claude Code", "CoWork", "Both"]}
                selected={productFilter}
                onToggle={(v) => toggleIn(productFilter, setProductFilter, v)}
              />
              <ChipGroup
                label="Category"
                options={["Engineering", "DevOps", "Data", "Security", "Design", "Finance", "Career", "Writing"]}
                selected={groupFilter}
                onToggle={(v) => toggleIn(groupFilter, setGroupFilter, v)}
              />
              <ChipGroup
                label="Complexity"
                options={["beginner", "advanced"]}
                labels={["Beginner", "Advanced"]}
                selected={complexityFilter}
                onToggle={(v) => toggleIn(complexityFilter, setComplexityFilter, v)}
              />
            </div>

            {/* Results count + clear all */}
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[11px] font-mono font-medium text-primary">
                Showing {displaySkills.length} of {totalLoaded} skills
              </span>
              {anyFilterActive && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-medium text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
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
            <div id="skills-browser" className="flex-1 scroll-mt-20">
              {persona && (
                <PersonaFilterBanner personaName={persona.title} onDismiss={clearPersona} />
              )}
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
                <div className="text-center py-16 px-4">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-base font-semibold text-foreground mb-1">
                    No skills match your filters.
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Try broadening your search.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-2 rounded-lg gradient-hero px-4 py-2 text-xs font-semibold text-primary-foreground shadow glow-on-hover transition-all"
                  >
                    Reset Filters
                  </button>
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

// ─── ChipGroup helper ─────────────────────────────────────────────────────────
function ChipGroup({
  label,
  options,
  labels,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  labels?: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => {
          const display = labels?.[i] ?? opt;
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

