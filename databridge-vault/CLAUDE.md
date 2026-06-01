# DataBridge Vault — Claude Code Integration

## What this skill does
DataBridge Vault is the **Infrastructure Layer** for the DataBridge pipeline. It provides:
1. **Proxy Rotation** — round-robin IP proxy pool, so scrapers don't get banned
2. **Session Vault** — stores login cookies per domain, heartbeat-validates them automatically

The crawler calls `GET /api/vault/next` before each scrape to get a fresh proxy + valid session cookie.

## Pipeline Position

```
databridge-vault (3002)
  ┌──────────────────────────┐
  │ Infrastructure Layer     │── proxy + cookies ──▶ databridge-crawler (3000)
  │ Proxy Pool + Session Vault│                        │ Capture with rotating IPs
  └──────────────────────────┘                        ▼
                                                 databridge-purifier (3001)
```

## How to invoke
Start the server: `cd databridge-vault && npm start`, then use `curl` or the API.

## API Endpoints

### Health Check
```bash
curl http://localhost:3002/health
```

### Proxy Management
```bash
# Add proxy to rotation pool
curl -X POST http://localhost:3002/api/proxy/add \
  -H "Content-Type: application/json" \
  -d '{"proxy":"http://user:pass@1.2.3.4:8080"}'

# List all proxies
curl http://localhost:3002/api/proxy/list

# Remove a proxy
curl -X DELETE http://localhost:3002/api/proxy/remove \
  -H "Content-Type: application/json" \
  -d '{"index":0}'
```

### Session Vault
```bash
# Inject cookies for a domain
curl -X POST http://localhost:3002/api/session/inject \
  -H "Content-Type: application/json" \
  -d '{
    "domain":"example.com",
    "cookies":"session=abc;token=xyz",
    "keepAliveUrl":"https://example.com/dashboard"
  }'

# List all sessions
curl http://localhost:3002/api/session/list

# Check session status
curl "http://localhost:3002/api/session/status?domain=example.com"

# Trigger manual heartbeat
curl -X POST http://localhost:3002/api/session/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'
```

### Composite — Get Next Proxy + Session
```bash
curl http://localhost:3002/api/vault/next
```

## Pipeline Integration
```bash
# 1. Get proxy + cookies from vault
VAULT=$(curl -s http://localhost:3002/api/vault/next)
PROXY=$(echo "$VAULT" | jq -r '.data.proxy')
COOKIES=$(echo "$VAULT" | jq -r '.data.session.cookies')

# 2. Feed into crawler (via --proxy-server and Cookie header)
# The crawler can be extended to accept proxy + cookies as parameters
```

## Prerequisites
- Node.js 18+
- `npm install` in the skill directory
- No API keys needed for basic operation

## Implementation notes
- Port 3002 by default (configurable via `PORT` env var)
- Sessions persist to `sessions.json` — survive restarts
- Heartbeat interval: 5 min default (`HEARTBEAT_INTERVAL` env var)
- Initial proxies can be set via `PROXIES` env var (comma-separated)
