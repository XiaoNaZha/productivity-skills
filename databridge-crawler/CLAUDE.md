# DataBridge Crawler (Stage 1/2) — Claude Code Integration

## What this skill does
DataBridge Crawler is the **Capture** stage. It stealthily scrapes web pages behind WAF/Cloudflare protections using Puppeteer with stealth plugins. Outputs raw HTML — feeds directly into [databridge-purifier](../databridge-purifier) for Markdown conversion.

## Pipeline Position

```
databridge-crawler (3000)          databridge-purifier (3001)
  ┌──────────────────────┐          ┌──────────────────────┐
  │ Stage 1: CAPTURE     │── HTML →│ Stage 2: CLEAN        │──▶ LLM / RAG
  │ Bypass WAF/Cloudflare │         │ Strip noise → Markdown │
  └──────────────────────┘          └──────────────────────┘
```

## How to invoke
Start the server first: `cd databridge-crawler && npm start`, then use `curl` or the API.

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Extract Webpage Content
```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "text",
    "selector": "h1",
    "waitFor": 2000
  }'
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | — | Target webpage URL |
| format | string | No | html | `html` or `text` |
| selector | string | No | — | CSS selector for specific element |
| waitFor | number | No | 0 | Extra wait time in ms |

## Prerequisites
- Node.js 18+
- Run `npm install && npx puppeteer browsers install chrome` first
- No API keys needed

## Implementation notes
- Uses `puppeteer-extra` with `puppeteer-extra-plugin-stealth` for anti-detection
- Auto-detects and waits for Cloudflare challenges
- Retries up to 3 times on failure with exponential backoff
- Runs on port 3000 by default (configurable via `PORT` env var)
