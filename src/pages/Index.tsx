import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
<<<<<<< HEAD
import { getCategoryMeta } from "@/data/categoryMeta";
import type { SkillsIndex, BundledData } from "@/types/skills.types";
import { ArrowRight, Github, Zap, BookOpen, Layers } from "lucide-react";
=======
import { SkillCard, SkillModal } from "@/components/SkillCard";
import type { SkillsIndex, Skill, CategoryData } from "@/types/skills.types";
import {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
  ArrowRight, Github, Zap, Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8

// ─── Data loading (prefers bundled; falls back to index) ──────────────────────

async function loadIndexData(): Promise<SkillsIndex & { usedBundled?: boolean }> {
  try {
    const r = await fetch("/data/skills-data.json");
    if (!r.ok) throw new Error("No bundled");
    const data: BundledData = await r.json();
    const categories = data.categories.map((cat) => ({
      id:       cat.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label:    cat,
      icon:     "Zap",
      dataFile: "",
      count:    data.skills.filter((s) => s.category === cat).length,
    }));
    return {
      version:      data.version,
      totalSkills:  data.totalSkills,
      targetSkills: 200,
      lastUpdated:  new Date().toISOString().split("T")[0],
      categories,
      usedBundled:  true,
    };
  } catch {
    const r = await fetch("/data/skills-index.json");
    return r.json();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function HomePage() {
<<<<<<< HEAD
  const [data, setData] = useState<(SkillsIndex & { usedBundled?: boolean }) | null>(null);

  useEffect(() => {
    loadIndexData().then(setData);
=======
  const [data, setData] = useState<SkillsIndex | null>(null);
  const [skillOfDay, setSkillOfDay] = useState<Skill | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetch("/data/skills-index.json")
      .then((r) => r.json())
      .then(async (d: SkillsIndex) => {
        setData(d);

        // Load all skills to pick Skill of the Day
        const allSkills: Skill[] = [];
        for (const cat of d.categories) {
          try {
            const res = await fetch(cat.dataFile);
            const catData: CategoryData = await res.json();
            allSkills.push(...catData.skills);
          } catch {
            // skip failed category
          }
        }

        if (allSkills.length > 0) {
          const now = new Date();
          const dayOfYear = Math.floor(
            (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
          );
          const idx = dayOfYear % allSkills.length;
          setSkillOfDay(allSkills[idx]);
        }
      });
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
<<<<<<< HEAD

      <main className="flex-1 pt-12">

        {/* ── Hero ── */}
=======
      <main className="flex-1 pt-14 md:pt-16">
        {/* Hero */}
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
        <section className="relative gradient-hero py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_50%)]" />
          </div>
          <div className="relative container max-w-6xl mx-auto px-6 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 border border-primary-foreground/30 rounded-xl mb-5">
<<<<<<< HEAD
              <span className="text-2xl">⚡</span>
=======
              <span className="text-lg text-primary-foreground">⚡</span>
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-4">
              KR Claudiator Skills
            </h1>
<<<<<<< HEAD
            <p className="text-primary-foreground/70 text-sm mb-3">
              Claude Skills Generator by Kalilur Rahman
            </p>
            {data && (
              <p className="text-primary-foreground/80 tracking-[0.15em] uppercase text-xs md:text-sm mb-8">
                {data.totalSkills} Skills · {data.categories.length} Domains · Built for Claude
              </p>
            )}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/skills"
                className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-3.5 text-base font-semibold tracking-wide text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
=======
            <p className="text-primary-foreground/70 text-sm md:text-base max-w-lg mx-auto mb-2">
              AI Prompt Engineering for Enterprise Teams
            </p>
            {data && (
              <p className="text-primary-foreground/60 tracking-[0.15em] uppercase text-xs mb-8">
                {data.totalSkills} Skills &amp; Counting · {data.categories.length} Domains · Built for Claude
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/skills"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-foreground px-8 py-3.5 text-base font-semibold tracking-wide text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
              >
                Browse All Skills
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/kalilurrahman/kr-claudiator-skills"
                target="_blank"
                rel="noopener noreferrer"
<<<<<<< HEAD
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/40 px-6 py-3.5 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 transition-all duration-300"
              >
                <Github className="w-4 h-4" />
                GitHub
=======
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/30 px-8 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-foreground/10"
              >
                <Github className="w-4 h-4" />
                Star on GitHub
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
              </a>
            </div>
          </div>
        </section>

<<<<<<< HEAD
        {/* ── Stats bar ── */}
        {data && (
=======
        {/* Skill of the Day */}
        {skillOfDay && (
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
          <section className="py-10">
            <div className="container max-w-6xl mx-auto px-6">
              <div className="glass-card p-6 gradient-border">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-warning" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-warning font-bold">Skill of the day</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground mb-1">{skillOfDay.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{skillOfDay.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillOfDay.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSkill(skillOfDay)}
                    className="shrink-0 inline-flex items-center gap-2 rounded-lg gradient-hero px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow glow-on-hover transition-all"
                  >
                    View Prompt →
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-3">Come back tomorrow for a new skill</p>
              </div>
            </div>
          </section>
        )}

        {/* Stats bar */}
        {data && (
          <section className="py-8">
            <div className="container max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<<<<<<< HEAD
                <StatCard
                  label="Skills Available"
                  value={data.totalSkills}
                  sub={`→ ${data.targetSkills} planned`}
                  icon={<BookOpen className="w-5 h-5" />}
                />
                <StatCard
                  label="Categories"
                  value={data.categories.length}
                  sub="Domain areas"
                  icon={<Layers className="w-5 h-5" />}
                />
                <StatCard
                  label="Open Source"
                  value={null}
                  sub={null}
                  icon={<Github className="w-5 h-5" />}
                  custom={
                    <a
                      href="https://github.com/kalilurrahman/kr-claudiator-skills"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:text-accent transition-colors"
                    >
                      Star on GitHub →
                    </a>
                  }
                />
=======
                <div className="glass-card p-5 card-hover text-center">
                  <p className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Skills available</p>
                  <p className="text-3xl font-bold text-gradient-brand">{data.totalSkills}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">→ {data.targetSkills} soon</p>
                </div>
                <div className="glass-card p-5 card-hover text-center">
                  <p className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Categories</p>
                  <p className="text-3xl font-bold text-gradient-brand">{data.categories.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Domain areas</p>
                </div>
                <div className="glass-card p-5 card-hover text-center">
                  <p className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Open source</p>
                  <p className="text-3xl font-bold text-gradient-brand">
                    <Github className="w-7 h-7 inline" />
                  </p>
                  <a
                    href="https://github.com/kalilurrahman/kr-claudiator-skills"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:text-accent transition-colors"
                  >
                    Star on GitHub →
                  </a>
                </div>
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
              </div>
            </div>
          </section>
        )}

        {/* ── Category grid ── */}
        {data && (
          <section className="pb-12">
            <div className="container max-w-6xl mx-auto px-6">
<<<<<<< HEAD
              <h2 className="text-lg font-medium text-foreground text-center mb-2">
                Browse by domain
              </h2>
              <p className="text-xs text-muted-foreground text-center mb-6">
                {data.categories.length} specialised domains · {data.totalSkills} ready-to-use skill prompts
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
=======
              <h2 className="text-lg font-semibold text-foreground text-center mb-6">Browse by domain</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
                {data.categories.map((cat) => {
                  const meta = getCategoryMeta(cat.label);
                  return (
                    <Link
                      key={cat.id}
                      to={`/skills?category=${cat.id}`}
<<<<<<< HEAD
                      className="group p-4 border border-border/50 bg-card rounded-xl card-hover text-center no-underline transition-all"
=======
                      className="group glass-card p-5 card-hover text-center no-underline"
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
                    >
                      <span
                        className="flex h-10 w-10 mx-auto shrink-0 items-center justify-center rounded-xl text-xl mb-2 transition-transform group-hover:scale-110"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                      >
                        {meta.emoji}
                      </span>
                      <span className="block text-xs font-medium text-foreground leading-tight">
                        {cat.label}
                      </span>
                      {cat.count != null && (
                        <span
                          className="block font-mono text-[9px] mt-1"
                          style={{ color: meta.dot }}
                        >
                          {cat.count} skills
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Progress banner ── */}
        {data && (
          <section className="pb-12">
            <div className="container max-w-6xl mx-auto px-6">
<<<<<<< HEAD
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    🔄 {data.totalSkills} of {data.targetSkills} planned skills available
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    New skills are added directly from the GitHub repository.
                  </p>
                </div>
                <div className="w-full md:w-48 shrink-0">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{Math.round((data.totalSkills / data.targetSkills) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-hero"
                      style={{ width: `${(data.totalSkills / data.targetSkills) * 100}%` }}
                    />
                  </div>
                </div>
=======
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
                🔄 Currently {data.totalSkills} of {data.targetSkills} planned skills available. New skills added from GitHub.
>>>>>>> 51f94142c86bbd269307705aa342faa8dbd2d8f8
              </div>
            </div>
          </section>
        )}

        {/* ── Feature highlights ── */}
        <section className="pb-16">
          <div className="container max-w-6xl mx-auto px-6">
            <h2 className="text-lg font-medium text-foreground text-center mb-6">
              What's inside Claudiator
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="p-5 border border-border/50 bg-card rounded-xl">
                  <div className="text-2xl mb-3">{f.emoji}</div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <Footer />

      {selectedSkill && (
        <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, custom,
}: {
  label: string;
  value: number | null;
  sub: string | null;
  icon: React.ReactNode;
  custom?: React.ReactNode;
}) {
  return (
    <div className="p-5 border border-border/50 bg-card/50 backdrop-blur-sm card-hover rounded-xl text-center">
      <span className="flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
        {icon}
      </span>
      <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase mb-1">{label}</p>
      {value != null ? (
        <>
          <p className="text-2xl font-serif text-primary">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </>
      ) : (
        custom
      )}
    </div>
  );
}

const FEATURES = [
  {
    emoji: "📋",
    title: "One-click copy",
    desc:  "Copy the full SKILL.md, a Claude tool XML snippet, or just the frontmatter — straight to clipboard.",
  },
  {
    emoji: "🔍",
    title: "Full-text search",
    desc:  "Search across skill names, descriptions, categories, and argument hints across all 129+ skills instantly.",
  },
  {
    emoji: "🎛️",
    title: "Tool filter",
    desc:  "Filter skills by allowed Claude tools (Read, Write, Bash) to find exactly the right skill for your workflow.",
  },
];
