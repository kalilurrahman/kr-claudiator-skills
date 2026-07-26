#!/usr/bin/env python3
"""Generate static per-skill files: public/skills/<slug>/SKILL.md

The site's "Install" button emits:
  curl -sL <SITE_URL>/skills/<slug>/SKILL.md
so these files must exist as real static paths. The slug algorithm must match
getSkillSlug() in src/lib/skillActions.ts (lowercase, non-alphanumerics -> "-").

Also writes public/skills/index.json (slug -> id/category manifest).
Name collisions (same slug from two skill ids) keep the first occurrence and
are reported — resolve them by renaming one of the source skills.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data" / "skills-data.json"
OUT = ROOT / "public" / "skills"


def slugify(name: str) -> str:
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def main():
    skills = json.loads(DATA.read_text())["skills"]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    manifest = {}
    collisions = []
    for s in skills:
        slug = slugify(s["name"])
        if slug in manifest:
            collisions.append((slug, manifest[slug]["id"], s["id"]))
            continue
        (OUT / slug).mkdir()
        content = s["content"]
        (OUT / slug / "SKILL.md").write_text(
            content if content.endswith("\n") else content + "\n"
        )
        manifest[slug] = {"id": s["id"], "category": s["category"]}

    (OUT / "index.json").write_text(json.dumps(manifest, indent=1))
    print(f"wrote {len(manifest)} skills to public/skills/")
    for slug, kept, dropped in collisions:
        print(f"COLLISION on '{slug}': kept {kept}, dropped {dropped}")


if __name__ == "__main__":
    main()
