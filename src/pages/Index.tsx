import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SkillCard, SkillModal } from "@/components/SkillCard";
import type { SkillsIndex, Skill, CategoryData } from "@/types/skills.types";
import {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
  ArrowRight, Github, Zap, Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
};

export function HomePage() {
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
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-14 md:pt-16">
        {/* Hero */}
        <section className="relative gradient-hero py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_50%)]" />
          </div>
          <div className="relative container max-w-6xl mx-auto px-6 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 border border-primary-foreground/30 rounded-xl mb-5">
              <span className="text-lg text-primary-foreground">⚡</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-4">
              KR Claudiator Skills
            </h1>
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
              >
                Browse All Skills
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/kalilurrahman/kr-claudiator-skills"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/30 px-8 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-foreground/10"
              >
                <Github className="w-4 h-4" />
                Star on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Skill of the Day */}
        {skillOfDay && (
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
              </div>
            </div>
          </section>
        )}

        {/* Category grid */}
        {data && (
          <section className="pb-12">
            <div className="container max-w-6xl mx-auto px-6">
              <h2 className="text-lg font-semibold text-foreground text-center mb-6">Browse by domain</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.categories.map((cat) => {
                  const Icon = iconMap[cat.icon] || Zap;
                  return (
                    <Link
                      key={cat.id}
                      to={`/skills?category=${cat.id}`}
                      className="group glass-card p-5 card-hover text-center no-underline"
                    >
                      <span className="flex h-10 w-10 mx-auto shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium text-foreground">{cat.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Progress banner */}
        {data && (
          <section className="pb-12">
            <div className="container max-w-6xl mx-auto px-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
                🔄 Currently {data.totalSkills} of {data.targetSkills} planned skills available. New skills added from GitHub.
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />

      {selectedSkill && (
        <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
