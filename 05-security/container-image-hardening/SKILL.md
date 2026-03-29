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
