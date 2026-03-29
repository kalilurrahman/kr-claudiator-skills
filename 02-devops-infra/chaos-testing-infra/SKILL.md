---
name: chaos-testing-infra
description: Run chaos engineering experiments on infrastructure to find weaknesses before incidents do. Outputs experiment catalogue, blast radius controls, steady-state hypotheses, and GameDay procedures.
argument-hint: [target systems, blast radius tolerance, observability coverage, team maturity]
allowed-tools: Read, Write
---

# Chaos Testing Infra

Chaos engineering deliberately introduces controlled failure into production (or production-like) systems to build confidence in resilience. The goal is to find weaknesses before they cause incidents.

## Process

1. **Define steady state.** Identify the system's normal behaviour: p99 latency, error rate, throughput. This is what you verify is maintained during the experiment.
2. **Hypothesise.** "We believe the system will continue to handle 99% of requests within 500ms when one of three database replicas is killed."
3. **Design the experiment.** Minimum scope to test the hypothesis. Always start in staging.
4. **Run with abort criteria.** Define what will automatically stop the experiment (error rate >5%, latency >1s).
5. **Observe.** Compare steady state against actual behaviour during chaos.
6. **Analyse.** Did the system behave as hypothesised? If not, you found a weakness.
7. **Fix, then repeat.** Fix the weakness and re-run to confirm.

## Experiment Catalogue

| Experiment | Tool | Blast Radius | Hypothesis |
|-----------|------|-------------|-----------|
| Kill random pod | Chaos Monkey / litmus | Single pod | Service continues with remaining replicas |
| Network latency +500ms | tc netem / Toxiproxy | Single service dependency | Timeouts fire before thread pool exhausts |
| CPU spike to 90% | stress-ng | Single node | HPA scales before error rate rises |
| Kill one DB replica | manual / operator | DB read replica | App switches to remaining replica within 5s |
| Disk full | fallocate | Single node | App degrades gracefully; alerts fire |

## Litmus Chaos (Kubernetes)

```yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: pod-kill-test
spec:
  appinfo:
    appns: production
    applabel: app=api-service
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-kill
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "false"
  monitoring: true
  annotationCheck: "true"
```

## Abort Criteria

Always define automatic and manual abort criteria before running:
- **Automatic:** Error rate >5% for 60 seconds, p99 latency >2000ms
- **Manual:** Any customer-reported impact, on-call override
- **Rollback:** Documented recovery steps before experiment begins

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Chaos in production first | Real user impact before learning | Start in staging; graduate to prod with confidence |
| No steady state defined | Cannot measure failure | Define p99/error rate baseline before experiment |
| No abort criteria | Runaway experiment causes real incident | Abort criteria automated and tested |
| Chaos as punishment | Team fears rather than learns | Blameless; framed as resilience investment |

## 10 Rules

1. Define steady state before any experiment — you need a baseline to compare against.
2. Start in staging; only run in production once you have confidence.
3. Automated abort criteria always — never rely on manual monitoring alone.
4. Minimum blast radius — the smallest experiment that tests the hypothesis.
5. One experiment at a time — concurrent chaos makes attribution impossible.
6. GameDay: quarterly scheduled chaos with the full team observing.
7. Fix weaknesses found before running new experiments.
8. Chaos is continuous — not a one-time audit.
9. Every chaos experiment produces a written report.
10. Celebrate findings — finding a weakness in staging is a win, not a failure.

