import { Terminal, FolderTree, Copy, Wand2 } from "lucide-react";

const TIPS = [
  {
    icon: Terminal,
    title: "Open in Claude Code",
    desc: "Copy the SKILL.md, paste it into a new file under .claude/skills/<name>/SKILL.md, then reference it by name in your prompt.",
  },
  {
    icon: FolderTree,
    title: "Drop into CoWork",
    desc: "In Claude CoWork, add the skill as a tool with the bundled <skill> XML snippet — the modal's “Claude Tool” button outputs it for you.",
  },
  {
    icon: Copy,
    title: "Copy, then customise",
    desc: "Every skill is a starting point. Edit the argument-hint, tighten the procedure, and remove sections that don't fit your domain.",
  },
  {
    icon: Wand2,
    title: "Chain into stacks",
    desc: "Combine companion skills into a single workflow — e.g. RAG → MCP Agent → Prompt Engineering — to assemble an end-to-end agent.",
  },
];

export function HowToUse() {
  return (
    <section className="pb-12">
      <div className="container max-w-6xl mx-auto px-6">
        <h2 className="text-lg font-medium text-foreground text-center mb-1">
          How to use these skills
        </h2>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Four ways to put a Claudiator skill to work in under a minute.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIPS.map((tip) => {
            const Icon = tip.icon;
            return (
              <div key={tip.title} className="p-5 border border-border/50 bg-card rounded-xl card-hover">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                  <Icon className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground mb-1">{tip.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{tip.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
