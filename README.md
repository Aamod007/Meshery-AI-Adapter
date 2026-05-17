# LLM Infrastructure Assistant

An LLM-powered infrastructure assistant that accepts natural language prompts, fetches live CRD schemas from a connected Kubernetes cluster, and returns valid, validated YAML manifests ready for `kubectl apply`.

## Features
- **Natural Language to YAML:** Generates valid Kubernetes YAML from English prompts.
- **Pluggable LLM Adapter:** Supports Ollama (local), OpenAI, and Anthropic.
- **Schema-Grounded System Prompt:** Injects live CRD schemas from your cluster into the system prompt.
- **YAML Validation:** Parses and runs `kubectl apply --dry-run=server` before presenting the YAML.
- **Apply & Rollback:** One-click apply with a 60-second undo window.
- **Minimal React Frontend:** Syntax-highlighted YAML editor and cluster status sidebar.

## Prerequisites
- Go 1.22+
- Node.js 20+
- Docker & kind
- Ollama (latest)
- kubectl 1.29+

## Running Locally

1. Create a local cluster: `kind create cluster --config deploy/kind-config.yaml`
2. Start the dev servers: `make dev`

Access the UI at `http://localhost:5173`.
