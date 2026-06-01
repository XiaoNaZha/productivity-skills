# DataBridge Vault — Infrastructure Layer

> Proxy rotation + session cookie vault with automatic heartbeat keep-alive. The infrastructure backbone that feeds [databridge-crawler](../databridge-crawler) with rotating IPs and fresh login sessions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🔗 Pipeline Position

```
databridge-vault (3002)
  ┌──────────────────────────┐
  │ Infrastructure Layer     │── proxy + cookies ──▶ databridge-crawler (3000)
  │ Proxy Pool (RR)          │                        │ Capture with rotating IPs
  │ Session Vault (heartbeat)│                        ▼
  └──────────────────────────┘                   databridge-purifier (3001)
```

The vault is a **sidecar service** — the crawler calls `GET /api/vault/next` before every scrape to get:
- A fresh proxy IP (round-robin)
- A validated session cookie (heartbeat-verified)

## Features

- **Round-Robin Proxy Pool** — automatic IP rotation to avoid rate limits and bans
- **Session Vault** — store login cookies per domain, auto-validate via heartbeat
- **File Persistence** — sessions survive server restarts (`sessions.json`)
- **Background Heartbeat** — periodic keep-alive checks, auto-marks expired sessions
- **Atomic Writes** — no data corruption on crash

## Quick Start

```bash
npm install
npm start
# → Server running at http://localhost:3002
```

### Seed with proxies
```bash
# Via environment variable
PROXIES="http://u1:p1@proxy1:8080,http://u2:p2@proxy2:3128" npm start

# Or via API after startup
curl -X POST http://localhost:3002/api/proxy/add \
  -H "Content-Type: application/json" \
  -d '{"proxy":"http://user:pass@1.2.3.4:8080"}'
```

## API Reference

### Proxy Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy/add` | Add proxy to rotation pool |
| GET | `/api/proxy/list` | List all proxies in pool |
| DELETE | `/api/proxy/remove` | Remove a proxy by URL or index |

### Session Vault

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/inject` | Store cookies + keep-alive URL for a domain |
| GET | `/api/session/list` | List all sessions with status |
| GET | `/api/session/status?domain=X` | Get session for specific domain |
| DELETE | `/api/session/remove` | Remove a session |
| POST | `/api/session/heartbeat` | Trigger manual heartbeat (all or specific domain) |

### Composite

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault/next` | Next proxy + best active session |

## Session Heartbeat

1. You inject a session via `POST /api/session/inject` with cookies + keep-alive URL
2. Vault immediately checks the URL with those cookies
3. Every 5 minutes (configurable), vault re-checks all sessions
4. Sessions returning HTTP 200 → `active`; anything else → `expired`
5. Only `active` sessions are returned from `/api/vault/next`

## Integration with Crawler

```bash
# Before each scrape, get a fresh proxy + cookies
VAULT=$(curl -s http://localhost:3002/api/vault/next)

PROXY=$(echo "$VAULT" | jq -r '.data.proxy')
COOKIES=$(echo "$VAULT" | jq -r '.data.session.cookies')

# Feed into crawler
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://protected-site.com\",\"format\":\"html\"}"
```

On Make.com: Vault (3002) → Crawler (3000) → Purifier (3001) → LLM

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3002 |
| PROXIES | Comma-separated initial proxies | (empty) |
| HEARTBEAT_INTERVAL | Heartbeat interval (ms) | 300000 (5 min) |
| HEARTBEAT_TIMEOUT | Per-heartbeat request timeout (ms) | 10000 |
| MAX_PROXIES | Max proxies in pool | 100 |
| MAX_SESSIONS | Max sessions in vault | 50 |
| SESSIONS_FILE | Persistence file path | ./sessions.json |

## Testing

```bash
npm test
```

## License

MIT
