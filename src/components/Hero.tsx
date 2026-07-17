import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Terminal, Cpu, Github, ArrowRight, Bot, Code2, Wand2, Workflow, Zap,
} from "lucide-react";
import heroAgent from "@/assets/hero-agent.jpg";
import type { SkillsIndex } from "@/types/skills.types";
import { getCategoryMeta } from "@/data/categoryMeta";

const CAROUSEL_SLIDES = [
  {
    icon: Sparkles,
    kicker: "New · Claude 5",
    title: "Mythos & Fable playbooks",
    body: "13 fresh skills for 1M-token reasoning, agentic tool use, structured output, and multimodal — tuned for Claude 5 Mythos & Fable.",
  },
  {
    icon: Bot,
    kicker: "AI agents",
    title: "Production-ready Claude agents",
    body: "Drop SKILL.md prompts straight into Claude Code, CoWork, or Desktop and ship the same day.",
  },
  {
    icon: Code2,
    kicker: "Vibe coding",
    title: "From idea to PR in one prompt",
    body: "Architecture, testing, security, observability — each skill encodes the senior reviewer in your team.",
  },
  {
    icon: Workflow,
    kicker: "Composable workflows",
    title: "Stack skills, chain agents",
    body: "Mix DevOps, data, system-design, and leadership skills into multi-agent workflows.",
  },
  {
    icon: Wand2,
    kicker: "Always fresh",
    title: "520+ curated, open-source",
    body: "Hand-tuned by KR Tools. New skills land via GitHub — no signup, no tracking.",
  },
];

interface HeroProps {
  data: (SkillsIndex & { allSkills?: unknown[] }) | null;
}

export function Hero({ data }: HeroProps) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % CAROUSEL_SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const Active = CAROUSEL_SLIDES[slide].icon;

  return (
    <section className="relative gradient-hero overflow-hidden border-b border-border/30 py-14 md:py-20">
      {/* Ambient glows + grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-pulse-slow" />
        <div
          className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-pulse-slow"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 28px, hsl(var(--foreground)/0.6) 28px, hsl(var(--foreground)/0.6) 29px), repeating-linear-gradient(90deg, transparent, transparent 28px, hsl(var(--foreground)/0.6) 28px, hsl(var(--foreground)/0.6) 29px)",
          }}
        />
      </div>

      <div className="relative container max-w-6xl mx-auto px-6 animate-fade-in">
        {/* Live chip + Claude 5 announcement */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Claude Skills Compendium · Live
          </div>
          <Link
            to="/skills?category=13-claude-5"
            className="group inline-flex items-center gap-2 rounded-full border border-[#f472b6]/50 bg-gradient-to-r from-[#f472b6]/15 to-[#a78bfa]/15 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f472b6] backdrop-blur-sm transition-transform hover:-translate-y-px"
          >
            <Sparkles className="h-3 w-3" />
            New · Claude 5 Mythos & Fable
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Two-column hero: copy left, agent image right */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-center lg:text-left">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-foreground mb-5">
              Claudiator — your{" "}
              <span className="text-gradient-brand italic">vibe-coding</span>{" "}
              agent toolkit
            </h1>
            <p className="mx-auto lg:mx-0 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{data?.totalSkills ?? 526}+</strong> production-ready
              SKILL.md prompts across <strong className="text-foreground">{data?.categories.length ?? 19} domains</strong>
              {" "}— tuned for <strong className="text-foreground">Claude 5 Mythos &amp; Fable</strong>, Sonnet 4.5, and Opus 4. Open-source, by Kalilur Rahman.
            </p>

            {/* CTAs */}
            <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <Link
                to="/skills"
                className="btn-gold group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm shadow-md hover:-translate-y-0.5"
              >
                <Terminal className="w-4 h-4" />
                Browse Library
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/guide"
                className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary"
              >
                <Cpu className="w-4 h-4 text-primary" />
                Deployment Guide
              </Link>
              <a
                href="https://github.com/kalilurrahman/kr-claudiator-skills"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-all"
              >
                <Github className="w-4 h-4" />
                Star on GitHub
              </a>
            </div>

            {/* Stat strip */}
            {data && (
              <div className="mt-7 grid grid-cols-3 gap-3 max-w-md mx-auto lg:mx-0">
                <Stat value={`${data.totalSkills}+`} label="Skills" />
                <Stat value={`${data.categories.length}`} label="Domains" />
                <Stat value="100%" label="Open source" />
              </div>
            )}
          </div>

          {/* Right column: AI agent image + capability carousel */}
          <div className="relative">
            <div className="relative mx-auto max-w-md">
              {/* Decorative ring + image */}
              <div className="relative aspect-square rounded-3xl overflow-hidden gradient-border shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)]">
                <img
                  src={heroAgent}
                  alt="AI coding agent radiating skill modules over a glowing terminal"
                  width={1024}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-background/70 via-background/10 to-transparent" />
                {/* Floating skill chips */}
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30">
                  <Zap className="h-3 w-3" /> agent.on
                </div>
                <div className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-foreground border border-border">
                  SKILL.md · v1
                </div>
              </div>

              {/* Carousel card */}
              <div
                key={slide}
                className="animate-fade-in mt-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
                    <Active className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-primary font-semibold mb-0.5">
                      {CAROUSEL_SLIDES[slide].kicker}
                    </p>
                    <p className="font-display text-base font-semibold text-foreground leading-snug">
                      {CAROUSEL_SLIDES[slide].title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {CAROUSEL_SLIDES[slide].body}
                    </p>
                  </div>
                </div>
                {/* Dots */}
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {CAROUSEL_SLIDES.map((s, i) => (
                    <button
                      key={s.kicker}
                      onClick={() => setSlide(i)}
                      aria-label={`Show slide ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === slide ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-primary/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Domain pills */}
        {data && (
          <div className="mt-12">
            <p className="mb-4 flex items-center justify-center gap-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-px w-10 bg-border/60" />
              Jump to a domain
              <span className="inline-block h-px w-10 bg-border/60" />
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {data.categories.slice(0, 10).map((cat) => {
                const meta = getCategoryMeta(cat.label);
                return (
                  <Link
                    key={cat.id}
                    to={`/skills?category=${cat.id}`}
                    className="group flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-secondary hover:text-foreground"
                  >
                    <span>{meta.emoji}</span>
                    {cat.label}
                    {cat.count != null && (
                      <span className="font-mono text-[9px] opacity-60">{cat.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Trust row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> Hand-curated SKILL.md
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-primary" /> Claude Code · CoWork · Desktop
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" /> One-click copy
          </span>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm px-3 py-2.5 text-center">
      <div className="font-display text-xl font-bold text-foreground leading-none">{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
