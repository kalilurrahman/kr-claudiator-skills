---
name: devsecops-pipeline
description: Build security gates into CI/CD pipelines. Outputs SAST, DAST, dependency scanning, secret detection, and container scanning pipeline with triage workflow.
argument-hint: [language stack, CI system, deployment target, compliance requirements]
allowed-tools: Read, Write, Bash
---

# DevSecOps Pipeline

DevSecOps embeds security testing into every stage of the development pipeline — not as a gate before release, but as continuous feedback during development. The goal is to find and fix vulnerabilities when they're cheapest to address: at commit time, not in production.

## Process

1. **Pre-commit:** Secret detection, code formatting, basic linting. Fast — <5 seconds.
2. **Pull request:** SAST, dependency vulnerability scan, licence compliance. Blocks merge on critical findings.
3. **Build:** Container image scanning, SBOM generation, image signing.
4. **Staging deploy:** DAST against the running application.
5. **Production:** Runtime threat detection, continuous dependency monitoring.

## Pre-Commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
        name: Detect secrets
        # Blocks commit if credentials found in diff

  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.67.0
    hooks:
      - id: trufflehog
        name: Detect high-entropy secrets

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
        args: ['--maxkb=500']

# Install: pre-commit install
# Run manually: pre-commit run --all-files
```

## Full CI/CD Security Pipeline

```yaml
# .github/workflows/devsecops.yml
name: DevSecOps Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:

env:
  IMAGE_NAME: ${{ github.repository }}:${{ github.sha }}

jobs:
  # ─── STAGE 1: SAST (Static Analysis) ───────────────────────────────
  sast:
    name: Static Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      # CodeQL — multi-language SAST
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: python, javascript
          queries: security-and-quality

      - name: Build for CodeQL
        uses: github/codeql-action/autobuild@v3

      - name: Run CodeQL
        uses: github/codeql-action/analyze@v3
        with:
          output: codeql.sarif
          upload: false

      # Semgrep — fast, rule-based SAST
      - name: Semgrep SAST
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/python
            p/javascript
            p/secrets
          auditOn: push
          generateSarif: "1"

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif

      # Bandit — Python-specific security linting
      - name: Bandit (Python)
        if: hashFiles('**/*.py') != ''
        run: |
          pip install bandit
          bandit -r src/ -f json -o bandit.json -ll  # Medium severity and above
          python3 -c "
          import json, sys
          with open('bandit.json') as f: r = json.load(f)
          critical = [i for i in r.get('results',[]) if i['issue_severity']=='HIGH']
          if critical:
              print(f'BLOCKING: {len(critical)} high-severity findings')
              for c in critical: print(f'  {c[\"filename\"]}:{c[\"line_number\"]} - {c[\"issue_text\"]}')
              sys.exit(1)
          print(f'SAST passed ({len(r[\"results\"])} total findings, 0 HIGH)')
          "

  # ─── STAGE 2: Dependency Scanning ───────────────────────────────────
  dependency-scan:
    name: Dependency Security
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Snyk — vulnerability + licence scan
      - name: Snyk scan
        uses: snyk/actions/python@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=upgradable

      # OWASP Dependency Check
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: ${{ github.repository }}
          path: '.'
          format: 'SARIF'
          args: >
            --failOnCVSS 7
            --enableRetired

      # Licence compliance
      - name: Check licence compliance
        run: |
          pip install pip-licenses
          pip-licenses --fail-on "GPL;AGPL" --format=json \
            | python3 -c "
          import json,sys; data=json.load(sys.stdin)
          violations = [p for p in data if any(l in p['License'] for l in ['GPL','AGPL'])]
          if violations:
              print('BLOCKING: GPL/AGPL licences detected:')
              for v in violations: print(f'  {v[\"Name\"]} {v[\"Version\"]}: {v[\"License\"]}')
              sys.exit(1)
          "

  # ─── STAGE 3: Secret Detection ──────────────────────────────────────
  secret-scan:
    name: Secret Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comprehensive scan

      - name: Gitleaks full history scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

      - name: TruffleHog scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified

  # ─── STAGE 4: Container Scanning ────────────────────────────────────
  container-scan:
    name: Container Security
    runs-on: ubuntu-latest
    needs: [sast, dependency-scan, secret-scan]
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t $IMAGE_NAME .

      - name: Trivy container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}
          format: sarif
          output: trivy.sarif
          severity: CRITICAL,HIGH
          exit-code: '1'
          ignore-unfixed: true

      - name: Hadolint Dockerfile lint
        uses: hadolint/hadolint-action@v3.1.0

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.IMAGE_NAME }}

      - name: Sign image with Cosign
        if: github.ref == 'refs/heads/main'
        uses: sigstore/cosign-installer@v3
        run: cosign sign --yes ${{ env.IMAGE_NAME }}

      - name: Push image
        if: success()
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USER }} --password-stdin
          docker push ${{ env.IMAGE_NAME }}

  # ─── STAGE 5: DAST (Dynamic Analysis) ───────────────────────────────
  dast:
    name: Dynamic Analysis
    runs-on: ubuntu-latest
    needs: container-scan
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Start application
        run: docker-compose -f docker-compose.staging.yml up -d
        
      - name: Wait for app health
        run: |
          for i in {1..30}; do
            curl -sf http://localhost:8080/health && break || sleep 2
          done

      - name: OWASP ZAP baseline scan
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:8080'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'         # Include alpha-level passive scan rules
          fail_action: true
          allow_issue_writing: true

      - name: Nuclei vulnerability scan
        run: |
          docker run -v $(pwd):/app projectdiscovery/nuclei:latest \
            -u http://localhost:8080 \
            -t cves/,exposures/,misconfigurations/ \
            -severity high,critical \
            -json -o /app/nuclei.json
          python3 -c "
          import json
          findings = [json.loads(l) for l in open('nuclei.json') if l.strip()]
          critical = [f for f in findings if f.get('info',{}).get('severity') in ['critical','high']]
          if critical:
              print(f'BLOCKING: {len(critical)} critical/high DAST findings')
              import sys; sys.exit(1)
          "

  # ─── STAGE 6: Infrastructure Security ───────────────────────────────
  iac-security:
    name: IaC Security
    runs-on: ubuntu-latest
    if: hashFiles('terraform/**') != ''
    steps:
      - uses: actions/checkout@v4

      - name: Checkov IaC scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          soft_fail: false
          output_format: sarif
          output_file_path: checkov.sarif

      - name: tfsec
        uses: aquasecurity/tfsec-action@v1.0.3
        with:
          working_directory: terraform/
          format: sarif
          sarif_file: tfsec.sarif
```

## Triage Workflow

```markdown
## Security Finding Triage

### Severity Classification
| CVSS Score | Finding Type | Action | SLA |
|-----------|-------------|--------|-----|
| 9.0-10.0 (Critical) | Any | Block deployment; immediate fix | 24 hours |
| 7.0-8.9 (High) | Exploitable remotely | Block PR merge | 7 days |
| 7.0-8.9 (High) | Requires auth/local | Fix in next sprint | 14 days |
| 4.0-6.9 (Medium) | Any | Fix in next quarter | 90 days |
| <4.0 (Low) | Any | Log + fix when convenient | Backlog |

### False Positive Process
1. Finding identified as false positive
2. Add to `.security-ignore` with justification + expiry date
3. Security lead approves
4. Re-evaluate on expiry
```

```yaml
# .gitleaks.toml — allowlist for false positives
[allowlist]
  description = "Known false positives"
  paths = [
    '''tests/fixtures/test_keys.py''',  # Test fixtures only
  ]
  regexes = [
    '''EXAMPLE_API_KEY''',  # Placeholder in docs
  ]
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **All security scans on main branch only** | Finds issues too late | Run SAST on every PR; block merge |
| **Blocking on all findings** | Pipeline never passes; engineers bypass | Critical/High blocks merge; Medium/Low are warnings |
| **No false positive management** | Noise leads to alert fatigue | Formal allowlist process with expiry dates |
| **DAST against production** | Real user data; breaking changes | DAST only against staging/ephemeral environments |
| **Security as last step** | Shifts cost right; findings are expensive | Pre-commit + PR + build scanning |
| **Separate security team reviews everything** | Bottleneck; slow feedback | Automated gates; security team reviews policy, not each finding |
| **Ignoring dependency transitive vulns** | Direct deps are clean but transitive aren't | Scan the full dependency tree |

## 10 Rules

1. Pre-commit hooks catch secrets and obvious issues before they ever reach the repo.
2. SAST runs on every PR — not just on main — so developers get immediate feedback.
3. Block merge on Critical and High severity findings with available fixes; warn on Medium.
4. Dependency scanning includes transitive dependencies — not just direct imports.
5. Container images are scanned before they are pushed, not after.
6. False positive management is a formal process with justification and expiry — not an informal override.
7. DAST targets only staging or ephemeral environments — never production.
8. SBOM generation is automatic on every build — you need to know what's in your supply chain.
9. Image signing with Cosign — only signed images deploy to production.
10. Security gates are owned by the platform team but findings are fixed by the development team.
