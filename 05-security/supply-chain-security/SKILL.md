---
name: supply-chain-security
description: Secure the software supply chain against dependency attacks, compromised pipelines, and malicious packages. Covers SBOM generation, dependency pinning, artifact signing, SLSA framework, secret scanning, and private registry configuration.
argument-hint: [tech stack, build system, compliance requirement, SLSA target level]
allowed-tools: Read, Write, Bash
---

# Software Supply Chain Security

Supply chain attacks target the dependencies, build systems, and delivery pipelines that software teams trust implicitly. SolarWinds, Log4Shell, and the XZ Utils backdoor showed that compromising one supplier can reach thousands of downstream targets. Supply chain security makes your build process an explicit, auditable, and verifiable chain of trust.

## Threat Model

| Attack vector | Example | Primary control |
|--------------|---------|----------------|
| Malicious package | Typosquatting, dependency confusion | Pinning + private registry allowlist |
| Compromised dependency | XZ Utils backdoor, left-pad removal | Integrity verification, SBOM + CVE scanning |
| Poisoned build environment | CI runner compromise | Ephemeral builders, hermetic builds, SLSA |
| Artifact tampering | Unsigned binary swapped in transit | Code signing, artifact attestation |
| Secrets in pipeline | API key leaked in CI logs | Secret scanning, OIDC tokens |
| Compromised registry | Malicious package published to npm/PyPI | Hash pinning, private mirror |

## SLSA Framework Levels

| Level | Requirements | Protection gained |
|-------|-------------|------------------|
| SLSA 1 | Provenance generated | Documents the build process |
| SLSA 2 | Hosted build, signed provenance | Harder to tamper with artefacts |
| SLSA 3 | Hardened build, non-forgeable provenance | Resistant to insider build-time attacks |
| SLSA 4 | Two-person review, hermetic builds | Highest assurance; suitable for critical infrastructure |

## Process

1. **Inventory all dependencies** — generate an SBOM for every build artefact.
2. **Pin all dependency versions with hashes** — lockfiles for every package manager.
3. **Verify integrity at install time** — checksums, signatures, hash pinning.
4. **Scan for vulnerabilities continuously** — not only on commit but on a daily schedule.
5. **Use a private registry with an allowlist** — block unknown packages from reaching builds.
6. **Sign all release artefacts** — Sigstore/cosign for containers; GPG for binaries.
7. **Generate and publish provenance** — SLSA attestations for every release.
8. **Scan for secrets in code and CI** — pre-commit hooks and CI checks, always.
9. **Harden the CI/CD pipeline** — ephemeral runners, least-privilege permissions, OIDC tokens.
10. **Monitor for new vulnerabilities post-release** — Dependabot, Renovate, or custom SBOM/CVE alerting.

## SBOM Generation

```bash
# Generate SBOM from a container image (Syft)
syft myapp:1.2.3 -o spdx-json=sbom.spdx.json
syft myapp:1.2.3 -o cyclonedx-json=sbom.cyclonedx.json

# Generate SBOM from source directory
syft dir:./src -o syft-json=sbom.syft.json

# Scan SBOM for known vulnerabilities (Grype)
grype sbom:sbom.spdx.json
grype sbom:sbom.spdx.json --fail-on high    # fail CI on HIGH+ CVEs

# Generate SBOM from Python project
pip-licenses --format=json --output-file=sbom-python.json
cyclonedx-py -e --format json -o sbom-python-cyclonedx.json
```

## Dependency Pinning and Lockfiles

```bash
# Python — pin with SHA256 hashes (pip-compile)
pip-compile requirements.in \
  --generate-hashes \
  --output-file requirements.txt
# pip install -r requirements.txt verifies hashes at install time

# Node — always use npm ci (never npm install in CI)
npm ci                  # installs exactly what is in package-lock.json; fails if out of sync

# Go — go.sum is automatically maintained; verify it
go mod tidy && go mod verify

# Rust — commit Cargo.lock for applications (not libraries)
cargo fetch --locked    # fails if Cargo.lock is out of date

# Docker — pin base images by digest, not mutable tag
# BAD:  FROM python:3.12-slim         (tag can be silently changed)
# GOOD: FROM python:3.12-slim@sha256:a4c5be58d9c1...
docker pull python:3.12-slim
docker inspect python:3.12-slim --format='{{index .RepoDigests 0}}'
# → python:3.12-slim@sha256:<digest>
```

## Container Image Signing (Sigstore / cosign)

```bash
# Keyless signing using OIDC identity (recommended for GitHub Actions)
cosign sign --yes myregistry/myapp:1.2.3

# Verify signature before deploying
cosign verify myregistry/myapp:1.2.3 \
  --certificate-identity \
    "https://github.com/myorg/myapp/.github/workflows/release.yml@refs/heads/main" \
  --certificate-oidc-issuer \
    "https://token.actions.githubusercontent.com"

# Attach SBOM attestation to image
cosign attest --yes \
  --predicate sbom.spdx.json \
  --type spdxjson \
  myregistry/myapp:1.2.3

# Sign with an organisation key (for air-gapped environments)
cosign generate-key-pair              # generates cosign.key + cosign.pub
cosign sign --key cosign.key myregistry/myapp:1.2.3
cosign verify --key cosign.pub myregistry/myapp:1.2.3
```

## SLSA Provenance in GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digests: ${{ steps.hash.outputs.digests }}
    steps:
      - uses: actions/checkout@v4

      - name: Build release artefacts
        run: |
          make build
          ls ./dist/

      - name: Generate SHA256 hashes
        id: hash
        run: echo "digests=$(sha256sum ./dist/* | base64 -w0)" >> $GITHUB_OUTPUT

      - uses: actions/upload-artifact@v4
        with: { name: dist, path: ./dist/ }

  # SLSA level 3 provenance — non-forgeable because it runs on a hosted builder
  provenance:
    needs: [build]
    permissions:
      actions: read
      id-token: write
      contents: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0
    with:
      base64-subjects: "${{ needs.build.outputs.digests }}"
      upload-assets: true     # attach provenance to GitHub release

  sign-container:
    needs: [build]
    runs-on: ubuntu-latest
    permissions:
      id-token: write     # required for keyless OIDC signing
      packages: write
    steps:
      - name: Sign container and attest SBOM
        run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.sha }}
          syft ghcr.io/${{ github.repository }}:${{ github.sha }} -o spdx-json=sbom.json
          cosign attest --yes --predicate sbom.json --type spdxjson \
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

## Secret Scanning

```yaml
# .github/workflows/secret-scan.yml
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }     # full history — scan all commits

      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: TruffleHog (verified secrets only)
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          extra_args: --only-verified
```

```yaml
# .pre-commit-config.yaml — block secrets before they reach the repo
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: detect-private-key
      - id: detect-aws-credentials
```

## Vulnerability Scanning in CI

```yaml
# Run on every PR and on a daily schedule
jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python audit
        run: pip-audit --requirement requirements.txt --format json -o pip-audit.json

      - name: Node audit
        run: npm audit --json > npm-audit.json || true   # capture output even on failure

      - name: Container scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myregistry/myapp:latest
          format: sarif
          severity: CRITICAL,HIGH
          exit-code: '1'
          output: trivy.sarif

      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: trivy.sarif }
```

## Private Registry and Allowlist

```ini
# .npmrc — route all npm traffic through private registry
registry=https://artifactory.company.com/artifactory/api/npm/npm-virtual/
always-auth=true

# pip.conf — route all pip traffic through private registry
[global]
index-url = https://artifactory.company.com/artifactory/api/pypi/pypi-virtual/simple
trusted-host = artifactory.company.com
```

```yaml
# Artifactory X-Ray policy (enforced at registry level)
# Block packages with: CRITICAL CVEs, unapproved licences, or unknown origin
# Alert on: new major versions of critical dependencies
# Quarantine: packages added to block list after initial approval
```

## OIDC — No Long-Lived CI Secrets

```yaml
# Replace long-lived AWS credentials in CI with OIDC short-lived tokens
jobs:
  deploy:
    permissions:
      id-token: write   # required for OIDC token request
      contents: read
    steps:
      - name: Authenticate to AWS via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: us-east-1
          # No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY stored in GitHub Secrets
          # GitHub exchanges the OIDC JWT for a short-lived STS token automatically
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Unpinned dependencies | Tag changes silently; supply chain attack surface | Pin with hashes; lockfiles everywhere |
| No SBOM | Cannot answer "are we affected?" when a CVE drops | Generate SBOM on every build; attach to release |
| Long-lived CI secrets | Compromised runner exposes permanent credentials | OIDC tokens; short-lived credentials; least privilege |
| No artefact signing | Build artefacts can be tampered in transit or at rest | cosign for containers; GPG for binaries |
| Vulnerability scan only on commit | New CVEs appear after your last push | Schedule daily scans against the published SBOM |
| Mutable tags in Dockerfiles | `FROM python:3.12` silently changes on rebuild | Always pin by digest |

## Rules

- **Pin everything with cryptographic hashes** — version ranges are an open invitation to supply chain attacks.
- **Generate an SBOM on every build** — without it you cannot answer "are we affected?" when a new CVE is published.
- **Sign all release artefacts** — containers, binaries, and SBOMs must be signed; verify signatures before deployment.
- **Use OIDC instead of long-lived CI secrets** — stolen tokens are a leading attack vector; short-lived credentials limit blast radius.
- **Scan on a schedule, not only on commit** — new CVEs are disclosed continuously; daily scans are the minimum.
- **Private registry with allowlist** — never allow CI builds to pull arbitrary packages from the public internet.
- **Scan for secrets before they reach the repo** — pre-commit hooks with gitleaks; mandatory in CI too.
- **SLSA level 2 is the minimum for production** — hosted build + signed provenance is achievable for most teams today.
- **Monitor dependency changes for new transitive deps** — a package that adds a new transitive dependency is a signal to investigate.
- **Treat build infrastructure as production** — the CI system has access to secrets and production deploy paths; it must be hardened accordingly.
