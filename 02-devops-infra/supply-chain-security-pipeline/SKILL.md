---
name: supply-chain-security-pipeline
description: Secure the software supply chain from source code to production deployment. Outputs SLSA compliance controls, artifact signing, dependency vetting, and provenance attestation pipeline.
argument-hint: [SLSA level target, build system, registry, compliance requirements]
allowed-tools: Read, Write, Bash
---

# Software Supply Chain Security Pipeline

The software supply chain is everything from developer workstations to production: source code, build systems, dependencies, containers, and deployment pipelines. Attacks on the supply chain (SolarWinds, XZ Utils) compromise software before it reaches customers. SLSA (Supply-chain Levels for Software Artifacts) provides a framework for hardening each step.

## SLSA Levels

```
SLSA Level 1: Documentation of provenance
  - Build process documented
  - Provenance (build metadata) generated

SLSA Level 2: Tamper resistance
  - Hosted build service (not local builds)
  - Signed provenance

SLSA Level 3: Hardened builds
  - Build service hardened against insider threats
  - Source integrity verified
  - Non-falsifiable provenance

SLSA Level 4: Two-person review
  - Two-party review of all changes
  - Hermetic, reproducible builds

Target: Level 2 for most teams; Level 3 for regulated/high-risk products
```

## Complete Pipeline

```yaml
# .github/workflows/secure-supply-chain.yml
name: Secure Supply Chain

on:
  push:
    branches: [main]

permissions:
  id-token: write    # For OIDC token (Cosign keyless signing)
  contents: read
  packages: write
  attestations: write

jobs:
  build-and-attest:
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Step 1: Dependency audit
      - name: Audit dependencies
        run: |
          pip-audit --vulnerability-service osv -r requirements.txt
          # Or for Node: npm audit --audit-level=high

      # Step 2: Check for known malicious packages
      - name: Malicious package check
        run: |
          pip install guarddog
          guarddog pypi verify -r requirements.txt

      # Step 3: Build in ephemeral environment
      - name: Set up QEMU and Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Step 4: Build with SBOM
      - name: Build and push with SBOM
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          sbom: true           # Generate SBOM
          provenance: true     # Generate SLSA provenance
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Step 5: Vulnerability scan on built image
      - name: Scan image for CVEs
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
          format: sarif
          output: trivy.sarif
          exit-code: '1'
          severity: CRITICAL,HIGH
          ignore-unfixed: true

      # Step 6: Sign image with Cosign (keyless via OIDC)
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign image
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Step 7: Attest SBOM
      - name: Attest SBOM
        run: |
          cosign attest --yes \
            --type spdxjson \
            --predicate sbom.spdx.json \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Step 8: Generate SLSA provenance
      - name: Generate SLSA provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
```

## Admission Control — Verify Before Deploy

```yaml
# Kyverno policy: only deploy signed images with valid attestations
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: check-image-signature
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [production]
      verifyImages:
        - imageReferences: ["ghcr.io/company/*"]
          attestors:
            - count: 1
              entries:
                - keyless:
                    subject: "https://github.com/company/*/.github/workflows/*.yml@refs/heads/main"
                    issuer: "https://token.actions.githubusercontent.com"
          attestations:
            - predicateType: https://slsa.dev/provenance/v0.2
              conditions:
                - all:
                    - key: "{{ builder.id }}"
                      operator: Equals
                      value: "https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@refs/tags/v1.9.0"
```

## Dependency Vetting

```bash
# Vet new dependencies before adding to requirements
# Check for: maintainer reputation, recent activity, known vulnerabilities

# Python: guarddog scans for typosquatting, malicious code patterns
guarddog pypi scan numpy

# npm: use socket.dev for deep dependency analysis
npx @socketsecurity/cli npm numpy

# Check if package is in OSS Insights (governance score)
curl "https://oss-insight.io/api/v1/projects/pypi/numpy"

# Pin exact versions (hash pinning for maximum security)
# requirements.txt
# numpy==1.26.4 --hash=sha256:2a02aba9ed12e4ac4eb3ea9421c420301a0c6460d9830d74a9df87efa4912010
pip install --require-hashes -r requirements.txt
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Local/dev machine builds** | Build environment not reproducible or auditable | All production builds in CI only |
| **Mutable image tags** | `latest` tag can be overwritten | Always pin to digest `image@sha256:...` |
| **No SBOM** | Unknown what's in your artifact | Generate SBOM on every build |
| **Unpinned dependencies** | Supply chain attack via dependency update | Hash-pin all dependencies |
| **No admission control** | Unsigned images can be deployed | Kyverno/OPA policy enforces signing |

## 10 Rules

1. All production builds run in CI — never from developer machines.
2. Sign every artifact with Cosign (keyless via OIDC) — no long-lived signing keys.
3. Generate SBOM on every build — know exactly what's in your artifact.
4. Verify signatures at deploy time with admission control — not just at build time.
5. Pin dependencies to hashes — version pinning alone is insufficient.
6. Scan built images for CVEs before pushing to registry.
7. Attest SLSA provenance — machines verify the build chain, not humans.
8. Vet new dependencies before adding — check for typosquatting and maintainer reputation.
9. Deploy by digest — `image@sha256:...` not `image:tag` — tags are mutable.
10. Reproducible builds are the goal — same source + same inputs = same artifact.
