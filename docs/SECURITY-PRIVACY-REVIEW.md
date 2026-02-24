# Security & Privacy Review (Public Mirror)

Date: 2026-02-24
Scope: Static review of `backend/`, `extension/`, `scripts/`, and docs for the public mirror.

## Executive Summary

This mirror already includes a preflight secret scanner and appears intentionally local-first. The most important concrete issue found was **session ID path traversal risk** in file-backed session operations. That has been remediated in this branch by centralizing session path validation and safe resolution.

Additional risks remain mostly architectural/operational:

1. **No auth on local HTTP API** (assumes trusted localhost only).
2. **Wide-open CORS** by default.
3. **No explicit security headers** (CSP, frame-ancestors, etc.).
4. **Privacy exposure by design**: captures URLs, titles, page excerpts, and stores them unencrypted on disk.

## Findings

### 1) Path traversal via unsanitized session IDs (Fixed)
- **Severity:** High
- **Where:** Session file access paths in memory/disposition/effort modules.
- **Why it matters:** Request parameters could be abused to traverse out of `memory/sessions` and read/write arbitrary JSON paths if this service is reachable outside a trusted machine.
- **Remediation in this branch:** Added centralized `resolveSessionPath()` guard and replaced direct path concatenation in affected modules.

### 2) Unauthenticated API endpoints
- **Severity:** High (if port is exposed beyond localhost), Medium (strict localhost-only use)
- **Where:** Express routes in `backend/server.js`.
- **Why it matters:** Anyone with network access to the service can request session data or modify state.
- **Recommended next step:** Bind to localhost explicitly, add optional API token for mutating endpoints, and/or require same-origin extension calls.

### 3) CORS policy is permissive
- **Severity:** Medium
- **Where:** `app.use(cors())` in `backend/server.js`.
- **Why it matters:** If the backend is exposed on a network interface, arbitrary origins may interact with API endpoints.
- **Recommended next step:** Restrict allowed origins to extension origin + localhost UI origin.

### 4) Missing hardening headers
- **Severity:** Medium
- **Where:** HTML responses from render routes.
- **Why it matters:** In-browser hardening is weaker without CSP / frame restrictions / MIME sniff protections.
- **Recommended next step:** Add middleware for `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` (or `frame-ancestors` in CSP), and `Referrer-Policy`.

### 5) Sensitive local memory at rest
- **Severity:** Medium (privacy)
- **Where:** `memory/sessions/*.json`, `memory/intentions.json`, and user-state files under `~/.memento`.
- **Why it matters:** Browsing context, inferred tasks, and project metadata are highly sensitive.
- **Recommended next step:** Document retention/deletion controls, add optional encryption-at-rest for persisted artifacts, and provide one-command purge.

### 6) Third-party CDN script for Mermaid
- **Severity:** Low/Medium (supply chain)
- **Where:** `backend/renderers/mapRenderer.js` includes jsDelivr Mermaid script.
- **Why it matters:** Runtime dependency on third-party script host for local UI rendering.
- **Recommended next step:** Bundle Mermaid locally or pin with SRI + strict CSP.

## Privacy Review Notes

- Captured payload includes URL, title, and page excerpt (up to first 8000 chars) by design.
- LLM routing can be local (Ollama) or remote (Anthropic), so data egress depends on selected engine.
- Public-mirror hygiene exists (`scripts/preflight-public.js`) but should be part of CI gating for releases.

## Suggested Roadmap

1. **Immediate:** keep path traversal guard (done), tighten CORS, bind service to localhost.
2. **Near-term:** add optional auth token and security headers.
3. **Mid-term:** configurable privacy modes (redaction, excluded domains, retention window, encryption).
4. **Release process:** enforce `npm run preflight:public` in CI before public push.
