import { toast } from "sonner";
import type { Skill } from "@/types/skills.types";

export const SITE_URL = "https://kr-claudiator-skills.lovable.app";

export function getSkillSlug(skill: Skill): string {
  return skill.name;
}

export function getInstallCommand(skill: Skill): string {
  const slug = getSkillSlug(skill);
  return `mkdir -p ~/.claude/skills/${slug} && curl -sL ${SITE_URL}/skills/${slug}/SKILL.md -o ~/.claude/skills/${slug}/SKILL.md`;
}

export function getSkillContent(skill: Skill): string {
  return (
    skill.content ??
    skill.promptPreview ??
    `# ${skill.displayName ?? skill.name}\n\n${skill.description}`
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export async function copySkillMd(skill: Skill) {
  await copy(getSkillContent(skill));
  toast.success("Copied to clipboard!", { duration: 2000 });
}

export async function copyInstallCommand(skill: Skill) {
  await copy(getInstallCommand(skill));
  toast.success("Install command copied!", { duration: 2000 });
}
