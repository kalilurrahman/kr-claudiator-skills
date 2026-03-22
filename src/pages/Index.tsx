import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { SkillsIndex } from "@/types/skills.types";
import {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
  ArrowRight, Github, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Code2, Server, BarChart2, Brain, Shield, Layers, CheckCircle2, Plug,
};

export function HomePage() {
  const [data, setData] = useState<SkillsIndex | null>(null);

  useEffect(() => {
    fetch("/data/skills-index.json")
      .then((r) => r.json())
      .then((d: SkillsIndex) => setData(d));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-12">
        {/* Hero */}
        <section className="relative gradient-hero py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_50%)]" />
          </div>
          <div className="relative container max-w-6xl mx-auto px-6 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 border border-primary-foreground/30 rounded-sm mb-5">
              <span className="font-serif text-lg text-primary-foreground">⚡</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-primary-foreground mb-4">
              Claudiator
            </h1>
            {data && (
              <p className="text-primary-foreground/80 tracking-[0.15em] uppercase text-xs md:text-sm mb-6">
                {data.totalSkills} Skills · {data.categories.length} Domains · Built for Claude
              </p>
            )}
            <Link
              to="/skills"
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-3.5 text-base font-semibold tracking-wide text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
            >
              Browse All Skills
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Stats bar */}
        {data && (
          <section className="py-10">
            <div className="container max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 border border-border/50 bg-card/50 backdrop-blur-sm card-hover rounded-lg text-center">
                  <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase mb-1">Skills Available</p>
                  <p className="text-2xl font-serif text-primary">{data.totalSkills}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">→ {data.targetSkills} soon</p>
                </div>
                <div className="p-5 border border-border/50 bg-card/50 backdrop-blur-sm card-hover rounded-lg text-center">
                  <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase mb-1">Categories</p>
                  <p className="text-2xl font-serif text-primary">{data.categories.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Domain areas</p>
                </div>
                <div className="p-5 border border-border/50 bg-card/50 backdrop-blur-sm card-hover rounded-lg text-center">
                  <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase mb-1">Open Source</p>
                  <p className="text-2xl font-serif text-primary">
                    <Github className="w-6 h-6 inline" />
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
              <h2 className="text-lg font-medium text-foreground text-center mb-6">Browse by domain</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.categories.map((cat) => {
                  const Icon = iconMap[cat.icon] || Zap;
                  return (
                    <Link
                      key={cat.id}
                      to={`/skills?category=${cat.id}`}
                      className="group p-4 border border-border/50 bg-card rounded-lg card-hover text-center no-underline"
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
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
                🔄 Currently {data.totalSkills} of {data.targetSkills} planned skills available. New skills added from GitHub.
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
