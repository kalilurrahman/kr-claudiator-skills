---
name: ebpf-observability
description: Implement eBPF-based observability for deep kernel-level insights without application instrumentation. Outputs eBPF tool selection, network tracing, performance profiling, and security monitoring patterns.
argument-hint: [Linux kernel version, observability gaps, performance issues, security requirements]
allowed-tools: Read, Write, Bash
---

# eBPF Observability

eBPF (extended Berkeley Packet Filter) runs sandboxed programs in the Linux kernel without modifying kernel source or loading kernel modules. This enables observability that was previously impossible or required heavy instrumentation: network packet tracing, CPU profiling, syscall monitoring, and security policy enforcement — all with minimal overhead.

## What eBPF Enables

```
NETWORK OBSERVABILITY
  Per-connection latency (TCP RTT, handshake time)
  Packet drops and retransmits
  DNS query tracing (without touching application code)
  Service-to-service communication mapping

PERFORMANCE PROFILING
  CPU flame graphs (which functions consume CPU)
  Memory allocation tracing
  Disk I/O patterns (which processes, which files)
  Lock contention

SECURITY MONITORING
  Syscall auditing (process executions, file opens, network connections)
  Privilege escalation detection
  Container escape attempts
  Runtime security policy enforcement (Cilium, Falco)

APPLICATION OBSERVABILITY (zero instrumentation)
  HTTP request/response tracing via user space probes
  Database query timing
  Language-specific JIT profiling (Go, Java, Python)
```

## Tool Selection

```
BCC (BPF Compiler Collection) — Python/C scripting
  bpftrace: awk-like one-liners for tracing
  execsnoop, opensnoop, tcpconnect — pre-built tools

Pixie — Kubernetes-native, auto-instrumentation
  Zero code changes; install once per cluster
  Service maps, SQL queries, HTTP latency — all automatic

Cilium — Network policy + observability
  eBPF-powered networking and security for Kubernetes
  Hubble: network flow visibility

Falco — Runtime security
  Detects anomalous behaviour using eBPF (or kernel module)
  Pre-built rules for known attack patterns

Parca / Pyroscope — Continuous profiling
  Always-on CPU and memory profiling via eBPF
  No code changes required
```

## bpftrace: Kernel-Level Tracing

```bash
# Monitor all DNS queries on the system (no app changes)
bpftrace -e '
  probe::dns_resolve {
    printf("%s -> %s\n", comm, args->hostname);
  }'

# Trace all TCP connection attempts
bpftrace -e '
  kprobe:tcp_connect {
    printf("%s(%d) connecting to %s:%d\n",
      comm, pid,
      ntop(args->uaddr->sin_addr.s_addr),
      ntohs(args->uaddr->sin_port));
  }'

# Profile CPU usage every 10ms (flame graph data)
bpftrace -e '
  profile:hz:100 {
    @[comm, ustack] = count();
  }' -o flamegraph.bt 30

# Find slow file reads (> 1ms)
bpftrace -e '
  kprobe:vfs_read { @start[tid] = nsecs; }
  kretprobe:vfs_read /nsecs - @start[tid] > 1000000/ {
    printf("slow read: %s, %d ms\n", comm, (nsecs - @start[tid]) / 1000000);
    delete(@start[tid]);
  }'

# Monitor HTTP requests without touching application (uprobe on Go runtime)
bpftrace -e '
  uprobe:/proc/$(pidof myapp)/exe:"net/http.(*response).WriteHeader" {
    printf("HTTP response: status=%d\n", arg0);
  }'
```

## Pixie (Zero-Instrumentation Kubernetes Observability)

```bash
# Install Pixie in Kubernetes cluster
curl -fsSL https://withpixie.ai/install.sh | bash
px auth login
px deploy

# Immediately get: HTTP latency, DB queries, pod CPU, network flows
# No application code changes

# Example PxL script: p99 HTTP latency per service
# px run px/http_data_filtered -d 5m -- #   start_time:"-5m" #   namespace:production

# Service dependency map (who calls who)
# px run px/net_flow_graph -d 5m
```

## Cilium Hubble (Network Flow Visibility)

```bash
# Deploy Cilium with Hubble enabled
helm upgrade --install cilium cilium/cilium   --set hubble.relay.enabled=true   --set hubble.ui.enabled=true

# Real-time network flow monitoring
hubble observe --namespace production --follow

# DNS monitoring
hubble observe --protocol dns --follow

# HTTP monitoring with request details
hubble observe --protocol http --follow

# Show which pods are communicating
hubble observe --from-pod production/api-service                --to-pod production/postgres

# Policy violations (dropped packets)
hubble observe --verdict DROPPED --follow
```

## eBPF for Security: Falco Rules

```yaml
# falco_rules.yaml
- rule: Privilege Escalation Attempt
  desc: Process executed with elevated privileges
  condition: >
    spawned_process and
    proc.uid != 0 and
    proc.euid = 0 and
    not proc.name in (sudo, su)
  output: >
    Privilege escalation detected (user=%user.name process=%proc.name
    uid=%proc.uid euid=%proc.euid container=%container.name)
  priority: CRITICAL

- rule: Unexpected Outbound Connection
  desc: Container connecting to unexpected external IP
  condition: >
    outbound and container and
    not fd.rip in (known_good_ips) and
    not fd.rip_name endswith ".internal"
  output: >
    Unexpected outbound connection (ip=%fd.rip port=%fd.rport
    process=%proc.name container=%container.name)
  priority: WARNING

- rule: Sensitive File Access
  desc: Access to known sensitive files
  condition: >
    open_read and
    fd.name in (/etc/shadow, /etc/passwd, /root/.ssh/id_rsa)
  output: >
    Sensitive file read (file=%fd.name user=%user.name
    process=%proc.name container=%container.name)
  priority: CRITICAL
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **eBPF on unsupported kernels** | Requires Linux 4.18+ (recommend 5.8+) | Check kernel version before deploying |
| **Writing custom eBPF without BCC/bpftrace** | Extremely complex; safety risks | Use existing tools; only write custom for unique needs |
| **No resource limits on eBPF programs** | Memory and CPU overhead | Configure map size limits; test overhead before production |
| **eBPF instead of application instrumentation** | eBPF can't see inside application logic | Complement application tracing; not replace it |
| **Ignoring overhead** | eBPF has overhead — usually <5% but varies | Benchmark before deploying in latency-sensitive paths |

## 10 Rules

1. eBPF requires Linux kernel 4.18+; recommend 5.8+ for full feature support.
2. Use existing tools (bpftrace, BCC, Pixie, Cilium) before writing custom eBPF programs.
3. eBPF is sandboxed by the kernel — verified programs cannot crash the kernel.
4. Zero-instrumentation observability with Pixie/eBPF is real — no application changes required.
5. Network flow visibility (Cilium Hubble) reveals service dependencies automatically.
6. eBPF overhead is typically <5% CPU — always benchmark before production deployment.
7. Falco runtime security uses eBPF to detect anomalies without kernel module risks.
8. bpftrace one-liners answer specific performance questions in seconds.
9. Continuous profiling via eBPF (Parca, Pyroscope) catches performance regressions over time.
10. eBPF observability complements application instrumentation — it does not replace it.
