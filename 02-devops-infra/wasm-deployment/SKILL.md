---
name: wasm-deployment
description: Deploy WebAssembly workloads for edge computing, plugin systems, and portable compute. Outputs WASM runtime selection, compilation pipeline, deployment patterns, and security sandboxing.
argument-hint: [use case, languages, edge vs server, existing infrastructure, performance requirements]
allowed-tools: Read, Write, Bash
---

# WebAssembly (WASM) Deployment

WebAssembly is a portable binary format that runs at near-native speed in a sandboxed environment. Originally for browsers, WASM now runs on servers, at CDN edges, and as a plugin system. Its key properties: near-native performance, memory isolation, and language-agnostic compilation make it useful for edge compute, plugin systems, and portable workloads.

## Use Cases

```
EDGE COMPUTE (Cloudflare Workers, Fastly Compute)
  Run code at 300+ CDN locations; <1ms startup
  Use when: Sub-50ms global latency required; stateless transforms
  Languages: JavaScript, TypeScript, Rust, Python, Go → WASM

PLUGIN SYSTEMS (Envoy, Kubernetes admission, SaaS extensibility)
  Safely run untrusted third-party code
  Use when: Need sandboxed extensibility without process isolation overhead
  Languages: Rust, Go, AssemblyScript → WASM

PORTABLE COMPUTE (WASI — WebAssembly System Interface)
  Docker-like portability: compile once, run anywhere
  Use when: Want truly OS-independent deployment
  Languages: Rust, Go, C/C++ → WASM + WASI

BROWSER (original use case)
  High-performance web apps (gaming, video, ML)
  Use when: Need near-native performance in browser
  Languages: Rust, C/C++ via Emscripten
```

## Rust to WASM Compilation

```rust
// src/lib.rs — Image processing module for edge deployment
use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageOutputFormat};
use std::io::Cursor;

#[wasm_bindgen]
pub fn resize_image(input: &[u8], max_width: u32, max_height: u32) -> Vec<u8> {
    let img = image::load_from_memory(input)
        .expect("Failed to load image");

    let resized = img.thumbnail(max_width, max_height);

    let mut output = Cursor::new(Vec::new());
    resized.write_to(&mut output, ImageOutputFormat::Jpeg(85))
        .expect("Failed to encode");

    output.into_inner()
}
```

```bash
# Compile to WASM
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release

# For browser (with JavaScript bindings)
cargo install wasm-pack
wasm-pack build --target web

# For WASI (server/edge without JS runtime)
rustup target add wasm32-wasi
cargo build --target wasm32-wasi --release

# Optimise WASM binary size
cargo install wasm-opt
wasm-opt -Oz target/wasm32-unknown-unknown/release/module.wasm -o optimised.wasm
```

## Cloudflare Workers (Edge WASM)

```typescript
// worker.ts — Runs at edge; compiled to WASM via Wasm Bindgen
import { resize_image } from "./pkg/image_processor.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405 });
    }

    const imageData = new Uint8Array(await request.arrayBuffer());
    const url = new URL(request.url);

    const maxWidth  = parseInt(url.searchParams.get("w") ?? "800");
    const maxHeight = parseInt(url.searchParams.get("h") ?? "600");

    // resize_image is compiled to WASM — runs in <5ms at edge
    const resized = resize_image(imageData, maxWidth, maxHeight);

    return new Response(resized, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      }
    });
  }
};
```

```toml
# wrangler.toml
name = "image-processor"
main = "src/worker.ts"
compatibility_date = "2024-03-15"

[build]
command = "wasm-pack build --target bundler"
```

## WASM Plugin System

```rust
// Plugin host: safely execute untrusted WASM plugins
use wasmtime::{Engine, Linker, Module, Store};
use std::fs;

fn run_plugin(plugin_path: &str, input: &[u8]) -> Vec<u8> {
    let engine = Engine::default();
    let module = Module::from_file(&engine, plugin_path)
        .expect("Failed to load plugin");

    let mut store: Store<()> = Store::new(&engine, ());
    let linker = Linker::new(&engine);

    let instance = linker.instantiate(&mut store, &module)
        .expect("Failed to instantiate plugin");

    // Pass input to plugin's memory
    let memory = instance.get_memory(&mut store, "memory")
        .expect("Plugin must export memory");
    let input_ptr = 0u32;
    memory.write(&mut store, input_ptr as usize, input)
        .expect("Failed to write input");

    // Call plugin's process function
    let process_fn = instance.get_typed_func::<(u32, u32), u32>(&mut store, "process")
        .expect("Plugin must export 'process'");
    let output_ptr = process_fn.call(&mut store, (input_ptr, input.len() as u32))
        .expect("Plugin execution failed");

    // Read output from plugin's memory
    let mut output_len_bytes = [0u8; 4];
    memory.read(&store, output_ptr as usize, &mut output_len_bytes).unwrap();
    let output_len = u32::from_le_bytes(output_len_bytes) as usize;

    let mut output = vec![0u8; output_len];
    memory.read(&store, (output_ptr + 4) as usize, &mut output).unwrap();
    output
}

// Security: WASM is sandboxed — no filesystem, network, or system call access
// unless explicitly granted via WASI permissions
```

## WASI Server Deployment (Wasmtime)

```bash
# Install wasmtime runtime
curl https://wasmtime.dev/install.sh -sSf | bash

# Run WASM binary compiled with WASI
wasmtime run   --allow-precompiled   --dir /tmp::/ \                   # Map host /tmp to WASM /; restrict access
  --env LOG_LEVEL=info   my-server.wasm -- --port 8080

# Security: WASI uses capability-based security
# Only explicitly granted resources (files, sockets) are accessible
# --dir /data::/app grants read of /data as /app inside WASM
# No other filesystem access possible

# Container for WASM workloads (OCI-compatible)
FROM scratch
COPY my-app.wasm /app.wasm
ENTRYPOINT ["/app.wasm"]
# No OS layer needed — minimal attack surface
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **WASM for stateful workloads** | WASM execution is stateless; state is external | Use for stateless transformations; store state outside |
| **Unoptimised WASM binaries** | 10MB+ modules cause slow cold starts | wasm-opt -Oz; strip debug symbols |
| **No resource limits** | Untrusted plugin consumes all memory/CPU | Set fuel limits; memory limits in Wasmtime |
| **Ignoring WASM cold start** | First invocation slow (module compilation) | Pre-compile (AOT); cache compiled modules |
| **WASM where Docker is simpler** | Over-engineering for standard workloads | Use WASM for edge, plugins, untrusted code; Docker for services |

## 10 Rules

1. WASM excels at edge compute (CDN), plugin systems, and portable compute — not general backend services.
2. Compile to WASM from Rust, Go, or C/C++ for best performance; avoid interpreted languages.
3. Optimise WASM binary size with `wasm-opt -Oz` — smaller = faster cold starts.
4. WASI capability model is the security primitive — only grant what the module needs.
5. For Cloudflare Workers: compile once, deploy globally, 0ms cold start.
6. Plugin systems using WASM are safer than dlopen() — memory isolation is enforced.
7. Fuel limits in Wasmtime prevent infinite loops in untrusted plugins.
8. Pre-compile (AOT) for latency-sensitive server deployments — JIT compilation adds latency.
9. WASM modules are portable: same .wasm file runs in browser, on server, at edge.
10. Test WASM modules with wasmtime locally before deploying to edge — same runtime guarantees.
