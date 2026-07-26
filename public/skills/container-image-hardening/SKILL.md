---
name: container-image-hardening
description: Harden container images to reduce attack surface. Outputs Dockerfile best practices, distroless migration, SBOM generation, image signing, and scanning pipeline.
argument-hint: [language runtime, base image, compliance requirements, registry]
allowed-tools: Read, Write, Bash
---

# Container Image Hardening

A container image is your application's attack surface. Bloated images contain unnecessary tools that attackers can leverage after a breach. Hardened images are minimal, run as non-root, have no package managers or shells, and are signed and scanned before deployment.

## Minimal Base Images

```dockerfile
# Option 1: Distroless — no shell, no package manager, minimal OS
FROM gcr.io/distroless/python3-debian12
# Size: ~50MB vs ~900MB for python:3.12

# Option 2: Alpine — minimal Linux
FROM python:3.12-alpine
# Size: ~50MB; note: musl libc differences may cause compatibility issues

# Option 3: Slim — Debian without dev tools
FROM python:3.12-slim
# Size: ~150MB; good balance of compatibility and size

# Multi-stage: Build in full image, copy to minimal runtime
FROM python:3.12 AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
COPY . .
RUN python -m compileall .

FROM gcr.io/distroless/python3-debian12 AS runtime
COPY --from=builder /install /usr/local
COPY --from=builder /build/app /app
USER nonroot  # Distroless has nonroot user built-in
CMD ["/app/main.py"]
```

## Image Scanning Pipeline

```yaml
# .github/workflows/image-security.yml
name: Image Security

on:
  push:
    branches: [main]

jobs:
  build-scan-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: |
          docker build -t myapp:${{ github.sha }} .

      # Lint Dockerfile
      - uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

      # Scan for vulnerabilities
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: sarif
          output: trivy.sarif
          severity: CRITICAL,HIGH
          exit-code: "1"

      # Scan for secrets
      - name: Secret scan
        run: |
          docker run --rm             -v /var/run/docker.sock:/var/run/docker.sock             trufflesecurity/trufflehog:latest             docker --image myapp:${{ github.sha }} --fail

      # Generate SBOM
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: myapp:${{ github.sha }}
          format: spdx-json

      # Sign image
      - name: Sign with Cosign
        uses: sigstore/cosign-installer@v3
      - run: |
          cosign sign --yes             --key ${{ secrets.COSIGN_KEY }}             myapp:${{ github.sha }}

      # Push only if all checks pass
      - name: Push image
        run: |
          docker tag myapp:${{ github.sha }} registry.example.com/myapp:${{ github.sha }}
          docker push registry.example.com/myapp:${{ github.sha }}
```

## Dockerfile Anti-Pattern Fixes

```dockerfile
# BAD: Root user, package manager present, no pinned version
FROM ubuntu:latest
RUN apt-get update && apt-get install -y curl wget vim
COPY app /app
CMD ["/app/server"]

# GOOD: Non-root, minimal, pinned digest, no extra tools
FROM gcr.io/distroless/base-debian12@sha256:abc123  # Pinned digest
COPY --chown=nonroot:nonroot app /app
USER nonroot
EXPOSE 8080
CMD ["/app/server"]

# Dockerfile security linting (Hadolint rules)
# DL3007: Use pinned version in FROM
# DL3008: Pin versions in apt-get install
# DL3013: Pin versions in pip install
# SC2086: Double quote variables to prevent word splitting
```

## Image Signing and Verification

```bash
# Sign at push time (CI)
cosign sign --key cosign.key registry.example.com/myapp:v1.2.3

# Verify before deployment (admission webhook)
cosign verify   --key cosign.pub   registry.example.com/myapp:v1.2.3

# Kyverno policy: only signed images deploy
kubectl apply -f - <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
    - name: verify-signature
      match:
        any:
          - resources: {kinds: [Pod], namespaces: [production]}
      verifyImages:
        - imageReferences: ["registry.example.com/*"]
          attestors:
            - count: 1
              entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      YOUR_COSIGN_PUBLIC_KEY
                      -----END PUBLIC KEY-----
EOF
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **FROM latest** | Unpredictable; silent updates | Pin to digest: `FROM image@sha256:...` |
| **Running as root** | Container escape easier | Non-root user + fixed UID |
| **Package managers in runtime** | apt/yum enable install of tools post-breach | Distroless or remove package managers |
| **Secrets in layers** | `docker history` exposes them | Build args or secrets mounts; never ENV |
| **No image scanning** | Vulnerable dependencies ship to production | Scan in CI; block on critical/high CVEs |

## 10 Rules

1. Pin base images to digest — tags are mutable; `@sha256:` is immutable.
2. Non-root user with fixed UID in every production image.
3. Distroless or Alpine for production — no shell, no package manager.
4. Multi-stage builds — build tools never appear in runtime image.
5. Scan every image in CI — block on critical/high CVEs with available fixes.
6. Sign images at push; verify at deploy — unsigned images don't run in production.
7. Generate SBOM on every build — know what's in your supply chain.
8. No secrets in Dockerfile ENV or ARG — use runtime secrets injection.
9. Read-only root filesystem in Kubernetes securityContext.
10. Lint Dockerfile in CI with Hadolint — catches common mistakes before review.

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

The canonical workflow for **Container Image Hardening** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Harden container images to reduce attack surface. Outputs Dockerfile best practices, distroless migration, SBOM generation, image signing, and scanning pipeline
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
