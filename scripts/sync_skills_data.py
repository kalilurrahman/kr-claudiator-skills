#!/usr/bin/env python3
"""Sync repo SKILL.md content into the shipped site data files.

Usage:
  python3 scripts/sync_skills_data.py <skill-id> [<skill-id> ...]
  python3 scripts/sync_skills_data.py --all-repo

A skill id is "<category-dir>/<skill-dir>", e.g. "04-ai-ml/llm-prompt-caching".
For each id, reads <id>/SKILL.md and updates the matching entry (content, lines,
description, argumentHint, allowedTools from frontmatter) in every data file
that contains that id. Aggregate files' totalSkills are left untouched (no
entries are added or removed here — this is a content sync, not a catalog edit).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILES = [
    ROOT / "public" / "data" / "skills-data.json",
    ROOT / "public" / "data" / "skills-data.min.json",
    ROOT / "public" / "data" / "skills-meta.json",
]


def parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    fm = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                fm[k.strip()] = v.strip()
    return fm


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    if args == ["--all-repo"]:
        ids = sorted(
            f"{p.parent.parent.name}/{p.parent.name}"
            for p in ROOT.glob("[0-9][0-9]-*/*/SKILL.md")
        )
    else:
        ids = args

    contents = {}
    for skill_id in ids:
        path = ROOT / skill_id / "SKILL.md"
        if not path.exists():
            print(f"SKIP {skill_id}: no SKILL.md")
            continue
        contents[skill_id] = path.read_text()

    for data_file in DATA_FILES:
        if not data_file.exists():
            continue
        data = json.loads(data_file.read_text())
        updated = 0
        for s in data.get("skills", []):
            text = contents.get(s.get("id"))
            if text is None:
                continue
            fm = parse_frontmatter(text)
            s["content"] = text.rstrip("\n")
            s["lines"] = len(text.rstrip("\n").splitlines())
            if fm.get("description"):
                s["description"] = fm["description"]
            if fm.get("argument-hint"):
                s["argumentHint"] = fm["argument-hint"]
            if fm.get("allowed-tools"):
                s["allowedTools"] = fm["allowed-tools"]
            updated += 1
        if updated:
            minified = data_file.name.endswith(".min.json")
            data_file.write_text(
                json.dumps(data, separators=(",", ":"))
                if minified
                else json.dumps(data, indent=2)
            )
            print(f"{data_file.relative_to(ROOT)}: {updated} entries updated")


if __name__ == "__main__":
    main()
