# DataBridge Purifier (Stage 2/2) — Claude Code Integration

## What this skill does
DataBridge Purifier is the **Clean** stage. It takes dirty HTML (from [databridge-crawler](../databridge-crawler) or any source) and converts it into clean, RAG-ready Markdown. Strips nav, footer, ads, scripts, and other noise using a 3-tier DOM filtering engine.

## Pipeline Position

```
databridge-crawler (3000)          databridge-purifier (3001)
  ┌──────────────────────┐          ┌──────────────────────┐
  │ Stage 1: CAPTURE     │── HTML →│ Stage 2: CLEAN        │──▶ LLM / RAG
  │ Bypass WAF/Cloudflare │         │ Strip noise → Markdown │
  └──────────────────────┘          └──────────────────────┘
```

## How to invoke
Start the server: `cd databridge-purifier && npm start`, then use `curl` or the API.

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### Convert HTML to Clean Markdown
```bash
# From raw HTML
curl -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d '{"html":"<html>...dirty html...</html>"}'

# From URL (fetches + converts)
curl -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'

# With options
curl -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","options":{"preserveImages":false,"headingStyle":"atx"}}'
```

## Pipeline with databridge-crawler
```
databridge-crawler (port 3000) → databridge-purifier (port 3001) → LLM / RAG
```
Both skills expose standard Express APIs — chain them via Make.com, n8n, or shell pipes.

## Prerequisites
- Node.js 18+
- `npm install` in the skill directory

## Noise Filtering
- **Tier 1**: Hard strips `script`, `style`, `nav`, `footer`, `iframe`, `noscript`
- **Tier 2**: Heuristic strips elements with ad/sidebar/social/comment class patterns
- **Tier 3**: Removes empty elements after stripping

## Implementation notes
- Uses `cheerio` for DOM parsing, `turndown` for HTML→Markdown conversion
- Prefers `article`, `main`, or content-class selectors over full body
- Returns `stats` showing what was stripped and size reduction
- Port 3001 by default (configurable via `PORT` env var)
