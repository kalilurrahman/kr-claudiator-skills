import type { Skill } from "@/types/skills.types";
import { Layers } from "lucide-react";

interface Stack {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  skillIds: string[];
}

export const SKILL_STACKS: Stack[] = [
  {
    id: "healthcare-rcm",
    title: "Healthcare RCM Stack",
    emoji: "🏥",
    blurb: "End-to-end revenue-cycle design from front-end to denials and KPIs.",
    skillIds: [
      "pack/healthcare-rcm-operations",
      "pack/denial-management-playbook",
      "pack/provider-enrollment-ops",
      "pack/rcm-metrics-kpis",
    ],
  },
  {
    id: "gcc",
    title: "GCC Build & Run",
    emoji: "🌐",
    blurb: "Design a Global Capability Centre and transition work into it safely.",
    skillIds: ["pack/gcc-operating-model", "pack/gcc-transition-playbook"],
  },
  {
    id: "ai-foundation",
    title: "AI Agent Foundation",
    emoji: "🤖",
    blurb: "Prompting, MCP server design, and retrieval-augmented knowledge.",
    skillIds: [
      "pack/prompt-engineering-playbook",
      "pack/mcp-agent-architecture",
      "pack/rag-knowledge-systems",
    ],
  },
  {
    id: "consulting-delivery",
    title: "Consulting Delivery Kit",
    emoji: "💼",
    blurb: "Proposals, SOWs, exec briefs and documentation that ship deals.",
    skillIds: [
      "pack/proposal-sow-playbooks",
      "pack/executive-briefs",
      "pack/documentation-systems",
      "pack/enterprise-app-implementation",
    ],
  },
  {
    id: "cxo-strategy",
    title: "CXO Strategy Boardroom",
    emoji: "👑",
    blurb: "Board-grade playbooks for CEO, CFO, COO — strategy, investment cases, QBR.",
    skillIds: [
      "14-executive-playbooks/ceo-quarterly-business-review",
      "14-executive-playbooks/cfo-technology-investment-case",
      "14-executive-playbooks/coo-operating-model-redesign",
      "14-executive-playbooks/cxo-crisis-communication-playbook",
    ],
  },
  {
    id: "cto-cio",
    title: "CTO & CIO Command Deck",
    emoji: "🧭",
    blurb: "Technology strategy, build-vs-buy, org design, and transformation roadmap.",
    skillIds: [
      "14-executive-playbooks/cto-technology-strategy",
      "14-executive-playbooks/cto-build-vs-buy-decision",
      "14-executive-playbooks/cto-engineering-org-design",
      "14-executive-playbooks/cio-digital-transformation-roadmap",
      "14-executive-playbooks/cio-vendor-portfolio-rationalisation",
    ],
  },
  {
    id: "ciso-cdo-cpo",
    title: "CISO · CDO · CPO Trident",
    emoji: "🛡️",
    blurb: "Security strategy, enterprise data strategy, and product operating model.",
    skillIds: [
      "14-executive-playbooks/ciso-security-strategy-board",
      "14-executive-playbooks/cdo-data-strategy",
      "14-executive-playbooks/cpo-product-operating-model",
      "14-executive-playbooks/cxo-ai-governance-council",
      "14-executive-playbooks/cio-ai-adoption-strategy",
      "14-executive-playbooks/cto-tech-debt-portfolio",
    ],
  },
];


interface SkillStacksProps {
  allSkills: Skill[];
  onSelectSkill: (skill: Skill) => void;
}

export function SkillStacks({ allSkills, onSelectSkill }: SkillStacksProps) {
  const byId = new Map(allSkills.map((s) => [s.id, s]));
  const stacks = SKILL_STACKS
    .map((stack) => ({ ...stack, skills: stack.skillIds.map((id) => byId.get(id)).filter(Boolean) as Skill[] }))
    .filter((s) => s.skills.length > 0);

  if (stacks.length === 0) return null;

  return (
    <section className="pb-12">
      <div className="container max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-medium text-foreground text-center">Recommended skill stacks</h2>
        </div>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Curated bundles for the most common Claudiator use cases. Click any chip to open the skill.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stacks.map((stack) => (
            <div key={stack.id} className="glass-card p-5 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{stack.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{stack.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{stack.blurb}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stack.skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => onSelectSkill(skill)}
                    className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/60 transition-all"
                  >
                    {skill.displayName ?? skill.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
