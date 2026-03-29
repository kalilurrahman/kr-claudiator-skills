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
