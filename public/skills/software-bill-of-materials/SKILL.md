---
name: software-bill-of-materials
description: Generate, manage, and use Software Bill of Materials (SBOM) to track component inventory and vulnerability exposure. Outputs SBOM generation pipeline, vulnerability correlation, policy enforcement, and consumer guidance.
argument-hint: [artifact types, SBOM format, consumer requirements, CI system, vulnerability database]
allowed-tools: Read, Write, Bash
---

# Software Bill of Materials (SBOM)

An SBOM is a formal, machine-readable inventory of all software components in an artifact — like an ingredients list for software. SBOMs enable rapid response when a new vulnerability affects a component: you know immediately which of your products are affected. They are now required by US Executive Order 14028 for software sold to the federal government.

## SBOM Formats

```
SPDX (Software Package Data Exchange)
  ISO standard; GitHub native; broad tooling support
  Format: JSON, YAML, RDF, tag-value
  Use: Default choice for most organisations

CycloneDX
  OWASP standard; richer security metadata
  Format: JSON, XML
  Use: Security-focused workflows; VEX support

SWID (Software Identification)
  ISO/IEC 19770-2
  Use: Enterprise asset management; NIST frameworks
```

## SBOM Generation Pipeline

```yaml
# .github/workflows/sbom.yml
name: SBOM Generation

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  generate-sbom:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: write
      packages: write

    steps:
      - uses: actions/checkout@v4

      # 1. Generate SBOM for source dependencies
      - name: Generate Python SBOM
        run: |
          pip install cyclonedx-bom
          cyclonedx-py environment -o sbom-python.json --format json

      # 2. Build container image
      - name: Build container
        uses: docker/build-push-action@v5
        id: build
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          sbom: true      # Docker Buildx generates SBOM automatically
          provenance: true

      # 3. Generate container SBOM with Syft
      - name: Generate container SBOM
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh
          syft ghcr.io/${{ github.repository }}:${{ github.sha }}             -o spdx-json=sbom-container.spdx.json             -o cyclonedx-json=sbom-container.cdx.json

      # 4. Scan SBOM for vulnerabilities
      - name: Vulnerability scan
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh
          grype sbom:sbom-container.spdx.json             --fail-on high             --output table

      # 5. Attest SBOM to container image
      - name: Attest SBOM
        uses: sigstore/cosign-installer@v3
        run: |
          cosign attest --yes             --type spdxjson             --predicate sbom-container.spdx.json             ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # 6. Upload SBOM as release artifact
      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: |
            sbom-python.json
            sbom-container.spdx.json
            sbom-container.cdx.json
```

## Vulnerability Correlation

```python
import json
import httpx
from dataclasses import dataclass

@dataclass
class ComponentVuln:
    component: str
    version: str
    cve_id: str
    severity: str
    cvss_score: float
    fixed_in: str | None

def correlate_sbom_with_vulnerabilities(sbom_path: str) -> list[ComponentVuln]:
    """Query OSV.dev for all components in the SBOM."""
    with open(sbom_path) as f:
        sbom = json.load(f)

    vulns = []
    # Parse SPDX packages
    packages = sbom.get("packages", [])

    for pkg in packages:
        name = pkg.get("name", "")
        version = pkg.get("versionInfo", "")
        ecosystem = detect_ecosystem(pkg)

        if not (name and version and ecosystem):
            continue

        # Query OSV.dev
        resp = httpx.post(
            "https://api.osv.dev/v1/query",
            json={"version": version, "package": {"name": name, "ecosystem": ecosystem}}
        )

        for osv_vuln in resp.json().get("vulns", []):
            severity = osv_vuln.get("database_specific", {}).get("severity", "UNKNOWN")
            cvss = extract_cvss_score(osv_vuln)

            vulns.append(ComponentVuln(
                component=f"{name}@{version}",
                version=version,
                cve_id=osv_vuln.get("id", ""),
                severity=severity,
                cvss_score=cvss,
                fixed_in=get_fixed_version(osv_vuln),
            ))

    return sorted(vulns, key=lambda v: v.cvss_score, reverse=True)

def detect_ecosystem(pkg: dict) -> str | None:
    """Detect package ecosystem from SPDX external reference."""
    for ref in pkg.get("externalRefs", []):
        locator = ref.get("referenceLocator", "")
        if "pypi" in locator: return "PyPI"
        if "npm" in locator: return "npm"
        if "golang" in locator: return "Go"
        if "maven" in locator: return "Maven"
    return None
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Generate SBOM only at release** | Vulnerabilities discovered late | Generate on every build; scan in CI |
| **SBOM without attestation** | Can be tampered; unverifiable | Sign and attest with Cosign |
| **No vulnerability correlation** | SBOM is an inventory; not useful without CVE data | Automated vuln scanning against SBOM |
| **SBOM not shared with customers** | Customers can't assess their exposure | Publish SBOM with each release |
| **Ignoring transitive dependencies** | Direct deps clean; transitive vulns exist | Syft/Trivy capture full dependency tree |

## 10 Rules

1. Generate SBOM on every build — not just releases.
2. Include transitive dependencies — they are the most common source of vulnerabilities.
3. Sign and attest SBOM to the artifact — enables downstream verification.
4. Automate vulnerability correlation — SBOM is only valuable with CVE scanning.
5. Alert on new CVEs affecting your SBOM inventory — don't wait for the next build.
6. Publish SBOM with every release — customers have a right to know what's in your software.
7. Use SPDX or CycloneDX — these are the two interoperable standards.
8. SBOM covers source, build tools, and runtime — not just application dependencies.
9. Track SBOM age — an 18-month-old SBOM is not an SBOM; it is a liability.
10. SBOM feeds into your incident response — new CVE? Query the SBOM to find affected products in seconds.

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Software Bill Of Materials** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Generate, manage, and use Software Bill of Materials (SBOM) to track component inventory and vulnerability exposure. Outputs SBOM generation pipeline, vulnerabi
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
