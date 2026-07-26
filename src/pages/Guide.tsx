import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SeoHead } from "@/components/SeoHead";
import {
  Terminal,
  FolderTree,
  Wand2,
  CheckCircle2,
  Copy,
  Check,
  Download,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Workflow,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";

interface CodeBlockProps {
  code: string;
  lang?: string;
  label?: string;
}

function CodeBlock({ code, lang = "bash", label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border/60 bg-[hsl(220_22%_8%)]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-card/40">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label ?? lang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors focus-ring"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-foreground/90 font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-base font-bold text-primary">
        {n}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SeoHead
        title="Claude Skills Deployment Guide — Claudiator"
        description="Step-by-step guide to install and use SKILL.md prompts in Claude Code, Claude Desktop, and Claude CoWork. Folder structure, frontmatter, invocation, and CI tips."
        canonical="https://claudiator.kalilurrahman.com/guide"
      />
      <Header />

      <main className="flex-1 pt-12">
        {/* Hero */}
        <section className="relative gradient-hero py-16 md:py-20 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          </div>

          <div className="relative container max-w-4xl mx-auto px-6">
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Deployment & Usage Guide
              </span>
            </div>

            <h1 className="text-center font-display text-3xl md:text-5xl font-bold text-foreground mb-3 tracking-tight">
              Ship Claude Skills in <span className="text-gradient-brand italic">minutes</span>
            </h1>
            <p className="text-center text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A practical, end-to-end guide for installing Claudiator SKILL.md
              files in <strong className="text-foreground">Claude Code</strong>,
              <strong className="text-foreground"> Claude Desktop</strong>, and
              <strong className="text-foreground"> Claude CoWork</strong> — with
              folder structure, frontmatter rules, invocation patterns, and CI
              tips.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/skills"
                className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm shadow-md hover:-translate-y-0.5"
              >
                <BookOpen className="w-4 h-4" />
                Browse 500+ Skills
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#install"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-all"
              >
                <Download className="w-4 h-4" />
                Jump to Install
              </a>
            </div>
          </div>
        </section>

        {/* What is a skill */}
        <section className="py-12">
          <div className="container max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">
              What is a Claude Skill?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              A Claude Skill is a single <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/60 text-primary">SKILL.md</code>{" "}
              file with YAML frontmatter and a procedural body. Claude
              automatically discovers skills in its workspace, loads them when
              their description matches your task, and follows their
              instructions. Think of each skill as a small, focused "expert"
              that activates only when relevant.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              {[
                {
                  icon: <FolderTree className="w-5 h-5" />,
                  title: "Drop-in install",
                  desc: "Just files in a folder — no plugins, no daemon, no API keys.",
                },
                {
                  icon: <Wand2 className="w-5 h-5" />,
                  title: "Auto-discovery",
                  desc: "Claude reads frontmatter and surfaces the right skill at the right time.",
                },
                {
                  icon: <ShieldCheck className="w-5 h-5" />,
                  title: "Scoped tools",
                  desc: "The allowed-tools field limits what each skill can do — Read, Write, Bash.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-colors"
                >
                  <div className="text-primary mb-2">{f.icon}</div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Install steps */}
        <section id="install" className="py-12 border-t border-border/40 bg-card/20">
          <div className="container max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Install in Claude Code
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Three commands. Less than two minutes.
            </p>

            <div className="space-y-10">
              <Step n={1} title="Clone the skill library">
                <p>From your project root, pull the SKILL.md files into <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/60 text-primary">.claude/skills/</code>:</p>
                <CodeBlock
                  label="terminal"
                  code={`mkdir -p .claude/skills\ngit clone --depth 1 https://github.com/kalilurrahman/kr-claudiator-skills.git \\\n  .claude/skills/kr-claudiator-skills`}
                />
                <p className="text-xs">
                  Prefer a single skill? Copy just one folder under{" "}
                  <code className="font-mono text-xs px-1 rounded bg-secondary/60 text-primary">.claude/skills/&lt;skill-name&gt;/</code>.
                </p>
              </Step>

              <Step n={2} title="Verify folder structure">
                <p>Each skill is a directory with at least one <code className="font-mono text-xs px-1 rounded bg-secondary/60 text-primary">SKILL.md</code> at its root:</p>
                <CodeBlock
                  label="layout"
                  code={`.claude/skills/\n└── kr-claudiator-skills/\n    ├── 01-software-dev/\n    │   ├── api-design/\n    │   │   └── SKILL.md\n    │   └── monorepo-strategy/\n    │       └── SKILL.md\n    ├── 05-security/\n    │   └── threat-modeling/\n    │       └── SKILL.md\n    └── ...`}
                />
              </Step>

              <Step n={3} title="Trigger the skill">
                <p>
                  Start a Claude Code session and describe a task that matches
                  a skill's <em>description</em> line. Claude loads the matching
                  SKILL.md automatically:
                </p>
                <CodeBlock
                  label="chat"
                  code={`> Help me threat-model the payment service. We have OAuth, Stripe webhooks, and a job queue.\n\n# Claude responds:\n> I'll use the threat-modeling skill (matches: "threat-model the payment service").\n> Loading SKILL.md from .claude/skills/.../05-security/threat-modeling/...`}
                />
                <p className="text-xs">
                  You can also force a skill explicitly:{" "}
                  <code className="font-mono text-xs px-1 rounded bg-secondary/60 text-primary">
                    Use the threat-modeling skill on …
                  </code>
                </p>
              </Step>
            </div>
          </div>
        </section>

        {/* Anatomy */}
        <section className="py-12">
          <div className="container max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Anatomy of a SKILL.md
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Every file in this library follows the same shape. You can copy,
              fork, and adapt them for your own org.
            </p>
            <CodeBlock
              label="SKILL.md"
              lang="markdown"
              code={`---\nname: threat-modeling\ndescription: Run a STRIDE threat model on a service and produce a ranked mitigation backlog.\nargument-hint: [service name, data classification, trust boundaries]\nallowed-tools: Read, Write\n---\n\n# Threat Modeling\n\n## When to use\nRun a STRIDE threat model on a service and produce a ranked mitigation backlog.\n\n## Process\n1. Identify assets, actors, and trust boundaries.\n2. Enumerate threats with STRIDE.\n3. Rank by likelihood × impact.\n4. Propose mitigations and assign owners.\n5. Schedule a re-review trigger.\n\n## Output template\n- Asset register\n- Threat table (STRIDE × asset)\n- Ranked mitigation backlog\n- Re-review trigger\n\n## Rules\n1. Always name the trust boundary.\n2. Always quantify likelihood and impact.\n...`}
            />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { k: "name", v: "Lowercase, hyphens only, ≤ 64 chars." },
                { k: "description", v: "The retrieval signal — match user intent in one sentence." },
                { k: "argument-hint", v: "What inputs the agent should ask for first." },
                { k: "allowed-tools", v: "Comma-list: Read, Write, Bash. Keep it minimal." },
              ].map((row) => (
                <div
                  key={row.k}
                  className="p-3 rounded-lg border border-border/50 bg-card/30"
                >
                  <code className="font-mono text-xs text-primary">{row.k}</code>
                  <p className="text-xs text-muted-foreground mt-1">{row.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Other tools */}
        <section className="py-12 border-t border-border/40 bg-card/20">
          <div className="container max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-6">
              Deploy in other Claude surfaces
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Terminal className="w-5 h-5" />,
                  title: "Claude Code",
                  desc: "Place skills under .claude/skills/ at the project root. Auto-loaded per workspace.",
                  badge: "Recommended",
                },
                {
                  icon: <Workflow className="w-5 h-5" />,
                  title: "Claude Desktop",
                  desc: "Drop the SKILL.md body into a Project's custom instructions, or attach the file directly.",
                  badge: "Manual",
                },
                {
                  icon: <Cpu className="w-5 h-5" />,
                  title: "Claude CoWork / API",
                  desc: "Use Copy as Claude Tool from any skill modal — wrap the body in a <skill> tag inside your system prompt.",
                  badge: "Programmatic",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="p-5 rounded-xl border border-border/50 bg-card/50 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-primary">{c.icon}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {c.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{c.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="font-display text-lg font-semibold text-foreground mt-10 mb-3">
              CoWork / API pattern
            </h3>
            <CodeBlock
              label="system prompt"
              lang="markdown"
              code={`You are an engineering assistant. The following skills are available.\nUse the one whose description best matches the user's task.\n\n<skill name="threat-modeling">\n{{ paste SKILL.md body here }}\n</skill>\n\n<skill name="incident-postmortem">\n{{ paste SKILL.md body here }}\n</skill>`}
            />
          </div>
        </section>

        {/* Tips */}
        <section className="py-12">
          <div className="container max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-6">
              Pro tips
            </h2>

            <div className="space-y-3">
              {[
                "Keep allowed-tools tight. Most skills only need Read + Write — only add Bash when the skill truly needs shell access.",
                "Write descriptions as retrieval signals, not titles. Include the verb and the trigger (e.g. 'Run a STRIDE threat model on a service…').",
                "Version control your .claude/skills/ folder so the whole team shares the same playbook.",
                "Combine skills with project-level CLAUDE.md to capture repo-specific conventions Claude should always apply.",
                "For CI: lint SKILL.md frontmatter (name, description, allowed-tools) in pre-commit to catch drift early.",
                "Fork the Claudiator repo and tune skills to your stack — anti-patterns and rules sections are the easiest to specialise.",
              ].map((tip, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-border/40">
          <div className="container max-w-3xl mx-auto px-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
              Ready to ship?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Browse 500+ ready-to-copy SKILL.md files across 12 engineering and leadership domains.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/skills"
                className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm shadow-md hover:-translate-y-0.5"
              >
                Open the library
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/kalilurrahman/kr-claudiator-skills"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-all"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default GuidePage;
