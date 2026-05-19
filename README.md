# Meshery AI Adapter — LLM Infrastructure Assistant

[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.29+-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![License](https://img.shields.io/badge/License-Apache--2.0-green)](LICENSE)

> An LLM-powered infrastructure assistant that accepts natural language prompts, fetches live CRD schemas from a connected Kubernetes cluster, and returns valid, validated YAML manifests ready for `kubectl apply`.

This project is the portfolio analog of the **[Meshery AI Adapter](https://github.com/meshery/meshery)** LFX mentorship project — demonstrating Go adapter patterns, Kubernetes client usage, LLM API integration, and React UI development.

---

## Demo

### CRD-Aware Generation (Lead with this)

The system discovers the `MesheryPattern` CRD from your cluster at runtime and injects its schema into the LLM's system prompt. The model then generates a valid `MesheryPattern` spec from a natural language prompt — **without any hardcoded knowledge of the CRD**.

### Full Round-Trip

```
English prompt → Valid YAML → Server-side dry-run → kubectl apply → Live WebSocket status → Rollback
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Natural Language → YAML** | Generate valid Kubernetes YAML from English prompts |
| **Pluggable LLM Adapters** | Ollama (local, no API key), OpenAI, and Anthropic behind a single Go interface |
| **Schema-Grounded Prompts** | Live CRD schemas fetched from your cluster are injected into the system prompt |
| **Server-Side Validation** | Two-stage validation: YAML parsing + `kubectl apply --dry-run=server` |
| **One-Click Apply** | Apply manifests to your cluster with a single button |
| **60s Rollback Window** | Undo any apply within 60 seconds — restores pre-apply state via SQLite snapshots |
| **Live WebSocket Status** | Real-time resource rollout tracking (e.g., `0/3 → 3/3 replicas available`) |
| **Embedded React UI** | Monaco YAML editor, chat interface, cluster status sidebar — served from a single Go binary |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React UI)                        │
│   ┌──────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│   │  Chat input  │   │  YAML editor  │   │  Cluster sidebar  │  │
│   │  + history   │   │  + apply btn  │   │  + provider HUD   │  │
│   └──────┬───────┘   └───────┬───────┘   └─────────┬─────────┘  │
└──────────┼───────────────────┼─────────────────────┼────────────┘
           │   REST / JSON     │                     │ WebSocket
           ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Go HTTP Server (:8080)                       │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   /generate │  │   /apply     │  │   /ws  (status stream) │  │
│  │   handler   │  │   handler    │  │                        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────────┘  │
│         │                │                                        │
│  ┌──────▼──────┐  ┌──────▼──────────────────────┐               │
│  │   Prompt    │  │        Cluster Manager        │               │
│  │   Builder   │  │  (apply · rollback · watch)   │               │
│  └──────┬──────┘  └──────────────┬───────────────┘               │
│         │                        │                                │
│  ┌──────▼──────┐         ┌───────▼───────┐                       │
│  │  LLM Adapter│         │  k8s client   │                       │
│  │  (interface)│         │  (client-go)  │                       │
│  └──┬──┬───┬───┘         └───────┬───────┘                       │
│     │  │   │                     │                                │
└─────┼──┼───┼─────────────────────┼────────────────────────────────┘
      │  │   │                     │
      ▼  ▼   ▼                     ▼
  Ollama OpenAI Anthropic    Kubernetes Cluster
  (local) (API)  (API)       (kind / real)
```

---

## Quick Start

### Prerequisites

- **Go** 1.22+
- **Node.js** 20+
- **Docker** + **kind**
- **Ollama** (latest) — or API keys for OpenAI/Anthropic
- **kubectl** 1.29+

### 1. Create a local cluster

```bash
kind create cluster --config deploy/kind-config.yaml
```

### 2. Pull a local model (no API key needed)

```bash
ollama pull llama3.2
```

### 3. Start the server

```bash
make dev
```

The Go server runs at `http://localhost:8080`. The React dev server (with hot reload) runs at `http://localhost:5173` and proxies API calls to the Go backend.

### 4. Try it

Open `http://localhost:5173` and type:

```
Create a Deployment for nginx with 3 replicas and a liveness probe on port 80
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROVIDER` | `ollama` | LLM provider: `ollama`, `openai`, or `anthropic` |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model name |
| `OPENAI_API_KEY` | — | Required if `PROVIDER=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `ANTHROPIC_API_KEY` | — | Required if `PROVIDER=anthropic` |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20240620` | Anthropic model name |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig |
| `PORT` | `8080` | HTTP server port |
| `DB_PATH` | `./data/snapshots.db` | SQLite database for apply snapshots |

---

## API Reference

### `POST /api/generate`

Generate YAML from a natural language prompt.

**Request:**
```json
{
  "prompt": "Deploy nginx with CPU limit 100m and memory limit 128Mi",
  "validate": true
}
```

**Response (200):**
```json
{
  "yaml": "apiVersion: apps/v1\nkind: Deployment\n...",
  "validation": { "passed": true, "errors": null },
  "meta": {
    "provider": "ollama/llama3.2",
    "input_tokens": 68,
    "output_tokens": 184,
    "latency_ms": 6680
  }
}
```

**Response (422 — validation failed):**
```json
{
  "yaml": "...",
  "validation": {
    "passed": false,
    "errors": [{
      "resource": "apps/v1/Deployment",
      "field": ".spec.template.spec.containers[0].resources.limits.cpu",
      "message": "Invalid quantity: 'lots'"
    }]
  }
}
```

### `POST /api/apply`

Apply a YAML manifest to the connected cluster.

**Request:**
```json
{ "yaml": "apiVersion: v1\nkind: ConfigMap\n..." }
```

**Response:**
```json
{
  "apply_id": "apply-1779089449307915500",
  "resources": ["default/ConfigMap/app-config"],
  "applied_at": "2026-05-18T13:00:49.332938+05:30",
  "can_undo_until": "2026-05-18T13:01:49.332938+05:30"
}
```

### `DELETE /api/apply/:id`

Roll back a previous apply (within 60-second window).

### `GET /api/health`

```json
{
  "provider": "ollama/llama3.2",
  "provider_ok": true,
  "cluster_ok": true,
  "cluster_context": "kind-llm-infra"
}
```

### `GET /api/ws`

WebSocket endpoint for live resource status streaming after apply.

---

## How Schema-Grounded Generation Works

This is the core innovation — the model doesn't guess at field names; it reads them from your cluster.

1. **Parse the prompt** — `ExtractTypes()` identifies mentioned resource types (builtins like `Deployment`, `Service`, and CamelCase CRD patterns like `MesheryPattern`)
2. **Fetch live schemas** — `FetchSchemas()` queries the cluster's discovery API (`/openapi/v2`) for each type's OpenAPI schema
3. **Trim & inject** — Schemas are trimmed to required fields + descriptions (stays under 2,000 tokens) and prepended to the system prompt
4. **Generate** — The LLM produces YAML grounded in the actual schema, not training data

If the cluster is unreachable, the system falls back to a static base prompt — generation still works, just without CRD awareness.

---

## Validation Pipeline

Two-stage validation catches errors before they reach the cluster:

1. **Syntax** — YAML parsing catches malformed output
2. **Server-side dry-run** — `kubectl apply --dry-run=server` validates against the live API

If validation fails, the UI shows the offending field path and offers a **"Retry with error context"** button that re-prompts the LLM with the error appended.

---

## Apply & Rollback

### Apply Flow
1. Decode multi-document YAML
2. For each resource: snapshot pre-apply state → server-side apply with `FieldManager: "llm-infra"`
3. Save snapshots to SQLite
4. Start background WebSocket watch loop streaming resource status

### Rollback Flow
1. Enforce 60-second TTL window (returns `410 Gone` after expiry)
2. For each snapshot:
   - If resource didn't exist before → `Delete()`
   - If resource existed before → `MergePatch()` back to original state
   - If patch fails with `NotFound` → `Create()` to recreate

---

## Repository Structure

```
├── cmd/server/main.go              # Entrypoint: wiring, server start
├── internal/
│   ├── adapter/                    # LLM provider implementations
│   │   ├── interface.go            # ModelProvider interface + factory
│   │   ├── ollama.go               # Ollama adapter (local inference)
│   │   ├── openai.go               # OpenAI adapter
│   │   ├── anthropic.go            # Anthropic adapter
│   │   └── adapter_test.go         # Table-driven tests with mock HTTP
│   ├── prompt/                     # System prompt construction
│   │   ├── builder.go              # Assembles system prompt + schema injection
│   │   └── schema.go               # Fetches + trims CRD schemas from cluster
│   ├── k8s/                        # Kubernetes interactions
│   │   ├── client.go               # Cluster client (kubeconfig / in-cluster)
│   │   ├── apply.go                # Apply, rollback, snapshots
│   │   ├── validate.go             # Server-side dry-run validation
│   │   └── watch.go                # WebSocket resource status polling
│   ├── server/                     # HTTP layer
│   │   ├── server.go               # Router (gorilla/mux) + middleware
│   │   ├── generate.go             # POST /api/generate
│   │   ├── apply.go                # POST /api/apply + DELETE /api/apply/:id
│   │   ├── ws.go                   # WebSocket hub
│   │   └── middleware.go           # CORS, logging
│   └── store/                      # State persistence
│       ├── store.go                # SQLite (modernc.org/sqlite, pure Go)
│       └── store_test.go
├── web/                            # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInput.tsx       # Prompt input + error retry
│   │   │   ├── YamlEditor.tsx      # Monaco editor + apply button
│   │   │   ├── ClusterSidebar.tsx  # Health indicators
│   │   │   ├── ApplyHistory.tsx    # Undo buttons
│   │   │   └── LiveStatusPanel.tsx # WebSocket status stream
│   │   ├── store.ts                # Zustand state management
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── embed.go                    # go:embed for React build
├── deploy/
│   ├── Dockerfile                  # 3-stage: Node → Go → distroless
│   ├── kind-config.yaml            # Local dev cluster
│   └── k8s/rbac.yaml               # ServiceAccount + ClusterRole
├── tests/e2e/roundtrip_test.go     # End-to-end tests
├── Makefile
└── README.md
```

---

## Makefile Targets

```bash
make dev        # Start Go server + React dev server with hot reload
make build      # Build Go binary + React production bundle
make test       # Run all Go tests
make test-e2e   # Run end-to-end tests (requires kind cluster)
make lint       # golangci-lint + eslint
make docker     # Build multi-stage Docker image
make clean      # Remove build artifacts
```

---

## Docker

```bash
# Build image
make docker

# Load into kind
kind load docker-image llm-infra-assistant:dev

# Deploy
kubectl apply -f deploy/k8s/rbac.yaml
kubectl port-forward svc/llm-infra-assistant 8080:8080
```

The Dockerfile uses 3 stages:
1. **Node 20 Alpine** — builds React production bundle
2. **Go 1.22 Alpine** — builds static binary with embedded `web/dist`
3. **Distroless static** — minimal final image (~15MB)

---

## Testing

### Run all tests

```bash
make test        # Unit tests (adapter, store)
make test-e2e    # End-to-end (requires kind cluster + Ollama)
```

### Test Coverage

| Package | Tests | Coverage |
|---------|-------|----------|
| `adapter` | Mock HTTP server tests for all 3 providers | ✓ |
| `store` | SQLite CRUD + TTL expiry | ✓ |
| `e2e` | Full round-trip: prompt → YAML → apply → rollback | ✓ |

---

## Key Design Decisions

### Why Go?

Meshery, Kubernetes controllers, and most CNCF infrastructure tooling is written in Go. Building the backend in Go means the code structure, patterns (interfaces, context propagation, error handling), and dependencies are immediately legible to LFX mentors.

### Why a single binary?

The Go server embeds the React build with `go:embed` and serves it at `/`. No nginx, no separate static hosting. This mirrors how Meshery's server works.

### Why SQLite?

The rollback window is 60 seconds — persistence is only needed to survive a process restart during that window. `modernc.org/sqlite` is pure Go (no CGO), so the binary works in distroless Docker images.

### Why Ollama as default?

The Meshery AI Adapter LFX project explicitly lists "local LLMs via Ollama" as a requirement (for data privacy). Defaulting to Ollama means the project works with no API keys, making it easy to demo.

---

## Known Issues & Fixes

### Rollback Resource Version Conflict (Fixed)

**Problem:** Rollback of an updated resource failed with `409 Conflict` because the snapshot contained a stale `resourceVersion`.

**Fix:** Unmarshal snapshot to `unstructured.Unstructured`, clear `resourceVersion`, then marshal back before patching.

### WebSocket Context Cancellation (Fixed)

**Problem:** The watch goroutine used `r.Context()` (HTTP request context) which gets canceled when the response is sent, causing `context canceled` errors in the WebSocket stream.

**Fix:** Use `context.WithTimeout(context.Background(), 125*time.Second)` for the detached watch goroutine.

---

## License

Apache-2.0
