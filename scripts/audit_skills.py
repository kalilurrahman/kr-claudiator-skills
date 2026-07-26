#!/usr/bin/env python3
"""Audit skill content: one honest count, drift detection, quality flags.

Usage:  python3 scripts/audit_skills.py [--json]

Reports:
  - repo skill count (SKILL.md files under category dirs) per category
  - site skill count (public/data/skills-data.json) per category
  - drift: skills only in repo, skills only in site data
  - exact-duplicate contents across the repo
  - stubs (< 100 lines) that need rebuild or deletion
Exit code 1 if duplicates or stubs are found (CI-friendly).
"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data" / "skills-data.json"
CATEGORY_DIR_RE = re.compile(r"^\d{2}-[a-z0-9-]+$")
STUB_LINES = 100


def repo_skills():
    skills = {}
    for cat_dir in sorted(ROOT.iterdir()):
        if not (cat_dir.is_dir() and CATEGORY_DIR_RE.match(cat_dir.name)):
            continue
        for f in sorted(cat_dir.glob("*/SKILL.md")):
            skills[f"{cat_dir.name}/{f.parent.name}"] = f
    return skills


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    repo = repo_skills()
    site = {s["id"]: s for s in json.loads(DATA.read_text())["skills"]}

    repo_by_cat = Counter(k.split("/")[0] for k in repo)
    site_by_cat = Counter(s["categorySlug"] for s in site.values())

    only_repo = sorted(set(repo) - set(site))
    only_site = sorted(set(site) - set(repo))

    hashes = defaultdict(list)
    stubs = []
    for skill_id, path in repo.items():
        text = path.read_text()
        hashes[hashlib.sha256(text.encode()).hexdigest()].append(skill_id)
        if len(text.splitlines()) < STUB_LINES:
            stubs.append((skill_id, len(text.splitlines())))
    dupes = sorted(v for v in hashes.values() if len(v) > 1)

    report = {
        "repo_total": len(repo),
        "site_total": len(site),
        "repo_by_category": dict(sorted(repo_by_cat.items())),
        "site_by_category": dict(sorted(site_by_cat.items())),
        "only_in_repo": only_repo,
        "only_in_site": only_site,
        "exact_duplicates": dupes,
        "stubs_under_100_lines": sorted(stubs, key=lambda x: x[1]),
    }

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"repo skills: {report['repo_total']}   site skills: {report['site_total']}")
        print(f"only in repo: {len(only_repo)}   only in site data: {len(only_site)}")
        if dupes:
            print(f"\nEXACT DUPLICATES ({len(dupes)} groups):")
            for group in dupes:
                print("  " + "  ==  ".join(group))
        if stubs:
            print(f"\nSTUBS < {STUB_LINES} lines ({len(stubs)}):")
            for skill_id, n in sorted(stubs, key=lambda x: x[1]):
                print(f"  {n:4d}  {skill_id}")

    sys.exit(1 if (dupes or stubs) else 0)


if __name__ == "__main__":
    main()
