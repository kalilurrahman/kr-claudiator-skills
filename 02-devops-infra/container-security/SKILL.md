---
name: container-security
description: Harden container images and Kubernetes workloads against attacks. Outputs secure Dockerfile patterns, admission policies, runtime security rules, and vulnerability scanning pipeline.
argument-hint: [container runtime, orchestrator, compliance requirements, image registry]
allowed-tools: Read, Write, Bash
---

# Container Security

Containers share a kernel. A misconfigured container running as root with mounted host paths is one exploit away from full node compromise. Container security is defence-in-depth: secure images, least-privilege runtime, network policies, and continuous scanning.

## Process

1. **Harden the image.** Minimal base, non-root user, no unnecessary packages, no secrets baked in.
2. **Scan for vulnerabilities.** Scan in CI on every build. Block on critical CVEs. Scan the registry continuously.
3. **Apply least-privilege runtime.** Drop capabilities, read-only root filesystem, no privilege escalation.
4. **Enforce with admission control.** OPA/Gatekeeper or Kyverno policies block non-compliant pods at deploy time.
5. **Restrict network.** NetworkPolicies — default deny, explicit allow.
6. **Runtime threat detection.** Falco or similar for anomaly detection at runtime.
7. **Audit and rotate.** Image signing, SBOM generation, secrets rotation.

## Secure Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Build (full dependencies)
FROM node:20-alpine AS builder

WORKDIR /build

# Install dependencies separately for layer caching
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

# Stage 2: Runtime (minimal)
FROM node:20-alpine AS runtime

# Create non-root user with fixed UID (predictable for policy enforcement)
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

# Copy only what's needed from builder
COPY --from=builder --chown=appuser:appgroup /build/dist ./dist
COPY --from=builder --chown=appuser:appgroup /build/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /build/package.json .

# Drop to non-root user
USER 10001

# Expose only required port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# No shell in CMD — prevents shell injection
CMD ["node", "dist/server.js"]
```

```dockerfile
# Python secure Dockerfile
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runtime

# Never run as root
RUN useradd -r -u 10001 -g nogroup appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:nogroup . .

USER 10001
ENV PATH=/home/appuser/.local/bin:$PATH

# Avoid writing .pyc files to container layer
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

EXPOSE 8080
CMD ["gunicorn", "app:application", "--bind", "0.0.0.0:8080", "--workers", "4"]
```

## Vulnerability Scanning Pipeline

```yaml
# .github/workflows/container-security.yml
name: Container Security Scan

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * *'  # Daily scan of registry images

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL,HIGH
          exit-code: '1'           # Fail CI on critical/high CVEs
          ignore-unfixed: true     # Only block on fixable CVEs

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-results.sarif

      - name: Lint Dockerfile with Hadolint
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile

      - name: Check for secrets in image
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            trufflesecurity/trufflehog:latest \
            docker --image myapp:${{ github.sha }} --fail

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: myapp:${{ github.sha }}
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Sign image with Cosign
        if: github.ref == 'refs/heads/main'
        uses: sigstore/cosign-installer@v3
        run: |
          cosign sign --yes myapp:${{ github.sha }}
```

## Kubernetes Security Context

```yaml
# Secure Pod specification
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  template:
    spec:
      # Pod-level security
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault      # Restrict syscalls
        supplementalGroups: []

      # No automounting of service account token unless needed
      automountServiceAccountToken: false

      containers:
        - name: api
          image: myapp:1.2.3
          
          # Container-level security
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true   # Prevents runtime writes
            capabilities:
              drop:
                - ALL               # Drop all Linux capabilities
              add:
                - NET_BIND_SERVICE  # Only add if binding port < 1024

          # Always set resource limits
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi

          # Writable temp dirs as emptyDir
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/cache

      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir:
            sizeLimit: 100Mi
```

## Kyverno Admission Policies

```yaml
# Block containers running as root
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root-user
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-runAsNonRoot
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [production, staging]
      validate:
        message: "Containers must not run as root (runAsNonRoot: true required)"
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  allowPrivilegeEscalation: false

---
# Require image from approved registry
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-approved-registry
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image-registry
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "Images must come from approved registries"
        pattern:
          spec:
            containers:
              - image: "123456789.dkr.ecr.us-east-1.amazonaws.com/*"

---
# Require resource limits
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-limits
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "CPU and memory limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    cpu: "?*"
                    memory: "?*"
```

## Falco Runtime Security

```yaml
# falco-rules.yaml — custom rules
- rule: Shell Spawned in Container
  desc: Alert when shell is spawned in production container
  condition: >
    spawned_process and
    container and
    container.image.repository != "debug-tools" and
    (proc.name = sh or proc.name = bash or proc.name = zsh)
  output: >
    Shell spawned in container (user=%user.name container=%container.name
    image=%container.image.repository:%container.image.tag
    proc=%proc.cmdline)
  priority: WARNING
  tags: [shell, container]

- rule: Sensitive File Read
  desc: Detect reads of sensitive files
  condition: >
    open_read and
    container and
    fd.name in (/etc/shadow, /etc/passwd, /etc/kubernetes/admin.conf, /root/.kube/config)
  output: >
    Sensitive file read (file=%fd.name user=%user.name container=%container.name)
  priority: CRITICAL
  tags: [file, container]

- rule: Outbound Connection to Unexpected Destination
  desc: Container making unexpected external connection
  condition: >
    outbound and
    container and
    not fd.rip in (allowed_ips)
  output: >
    Unexpected outbound connection (ip=%fd.rip port=%fd.rport container=%container.name)
  priority: WARNING
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Running as root** | Root in container = easier privilege escalation | `runAsNonRoot: true`, fixed UID |
| **Secrets in image layers** | `docker history` exposes them; leaked in registries | Use secrets manager; never ENV secrets |
| **No image tag pinning** | `latest` can change unexpectedly | Pin to digest: `image@sha256:abc...` |
| **Privileged containers** | Full host access — container escape trivial | Never use `privileged: true` in production |
| **No resource limits** | Noisy neighbour starves other pods; OOM kills node | Always set requests and limits |
| **Scanning only at build time** | New CVEs emerge post-build | Continuous registry scanning |
| **Writable root filesystem** | Malware can persist in container | `readOnlyRootFilesystem: true` + emptyDir for temp |

## 10 Rules

1. Never run production containers as root — use a fixed non-root UID.
2. Minimal base images only — alpine or distroless. No curl, wget, or package managers in runtime images.
3. Scan every image in CI and block on critical/high CVEs with fixes available.
4. Set explicit CPU and memory limits — no container runs without resource constraints.
5. Read-only root filesystem in production — writable paths via emptyDir volumes only.
6. Drop ALL capabilities; add back only the specific ones needed.
7. Never bake secrets into images — use secrets manager references at runtime.
8. Pin images to immutable digests in production, not tags.
9. Enforce policies with admission controllers — policy-as-code that cannot be bypassed.
10. Runtime detection (Falco) catches what static analysis misses — deploy it and alert on anomalies.
