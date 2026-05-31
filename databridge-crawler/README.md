# DataBridge Crawler — Stage 1 (Capture)

> Stealth web scraper that bypasses WAF/Cloudflare protections. Extracts raw HTML from any webpage — feeds directly into [DataBridge Purifier](../databridge-purifier) for Markdown conversion.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🔗 Pipeline Position

```
databridge-crawler (3000)            databridge-purifier (3001)
  ┌──────────────────────┐           ┌──────────────────────┐
  │ Stage 1: CAPTURE     │── HTML → │ Stage 2: CLEAN        │──▶ LLM / RAG
  │ This skill            │          │ Next skill             │
  └──────────────────────┘           └──────────────────────┘
```

## Features

- Stealth mode with `puppeteer-extra-plugin-stealth` to hide automation fingerprints
- Waits for async data to fully load (`networkidle2`)
- Auto-detects and waits for Cloudflare challenges to pass
- Auto-retry on failure (up to 3 attempts with exponential backoff)
- Supports HTML, plain text, or CSS selector extraction

## Quick Start

```bash
npm install
npx puppeteer browsers install chrome
npm start
```

Server runs at `http://localhost:3000`

## API Usage

### Health Check

```bash
curl http://localhost:3000/health
```

### Extract Webpage

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","format":"text"}'
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | Target webpage URL |
| format | string | No | html | Response format: `html` or `text` |
| selector | string | No | - | CSS selector to extract specific element |
| waitFor | number | No | 0 | Extra wait time (ms) after page load |

### Response Example

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "content": "<html>...</html>",
    "extractedAt": "2026-05-31T10:00:00.000Z",
    "format": "html"
  }
}
```

## Pipeline: Feed into Purifier

```bash
# Scrape → pipe directly to DataBridge Purifier for cleaning
curl -s -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article","format":"html"}' \
  | jq -r '.data.content' \
  | jq -Rs '{html: .}' \
  | curl -s -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d @-
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| TIMEOUT | Page load timeout (ms) | 30000 |
| MAX_RETRIES | Max retry attempts | 3 |
| HEADLESS | Headless browser mode | true |

## Testing

```bash
npm test
```

## License

MIT
